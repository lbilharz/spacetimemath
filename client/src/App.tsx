import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { tables } from './module_bindings/index.js';
import RegisterPage from './pages/RegisterPage.js';
import LobbyPage from './pages/LobbyPage.js';
import ProgressPage from './pages/ProgressPage.js';
import SprintPage from './pages/SprintPage.js';
import ResultsPage from './pages/ResultsPage.js';
import AccountPage from './pages/AccountPage.js';
import ClassroomPage from './pages/ClassroomPage.js';
import BottomNav from './components/BottomNav.js';
import TopBar from './components/TopBar.js';
import OnboardingOverlay from './components/OnboardingOverlay.js';

export type Page = 'register' | 'lobby' | 'progress' | 'sprint' | 'results' | 'account' | 'classroom';

const TABBED_PAGES: Page[] = ['lobby', 'progress', 'account'];

/** Pathname → Page (only stable, deep-linkable pages) */
const PATH_MAP: Record<string, Page> = {
  '/': 'lobby',
  '/progress': 'progress',
  '/account': 'account',
  '/classroom': 'classroom',
};

/** Page → canonical pathname */
const PAGE_PATH: Partial<Record<Page, string>> = {
  lobby:     '/',
  progress:  '/progress',
  account:   '/account',
  classroom: '/classroom',
  sprint:    '/sprint',
  results:   '/results',
};

export default function App() {
  const { t } = useTranslation();
  const { identity, isActive, connectionError } = useSpacetimeDB();
  const [players] = useTable(tables.players);
  const [classroomMembers] = useTable(tables.classroom_members);
  const [page, setPage] = useState<Page>('register');
  const [sessionId, setSessionId] = useState<bigint | null>(null);
  const [classroomId, setClassroomId] = useState<bigint | null>(null);
  const [sprintOrigin, setSprintOrigin] = useState<'lobby' | 'classroom'>('lobby');
  const tierAtSprintStartRef = useRef<number>(0);
  // Ref so event handlers can read current player without stale closure
  const myPlayerRef = useRef<{ learningTier?: number } | undefined>(undefined);

  const myIdentityHex = identity?.toHexString();
  const myPlayer = myIdentityHex
    ? players.find(p => p.identity.toHexString() === myIdentityHex)
    : undefined;

  useEffect(() => { myPlayerRef.current = myPlayer; }, [myPlayer]);

  const inClassroom = classroomId !== null && myIdentityHex
    ? (classroomMembers as any[]).some(
        m => m.playerIdentity.toHexString() === myIdentityHex && m.classroomId === classroomId
      )
    : false;

  // ── Navigation ──────────────────────────────────────────────────────────────

  const navigate = (newPage: Page, hash?: string) => {
    const path = PAGE_PATH[newPage] ?? '/';
    window.history.pushState(null, '', hash ? `${path}#${hash}` : path);
    setPage(newPage);
  };

  // After each page transition: scroll to hash or reset to top
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const t = setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
      return () => clearTimeout(t);
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [page]);

  // Global SPA link interceptor — <a href="/progress#scoring-guide"> works anywhere
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('/') && !href.startsWith('#')) return;
      e.preventDefault();
      const [rawPath, rawHash] = href.split('#');
      const path = rawPath || window.location.pathname;
      const targetPage = PATH_MAP[path] ?? 'lobby';
      if (!myPlayerRef.current && targetPage !== 'register') return;
      navigate(targetPage, rawHash || undefined);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Browser back / forward
  useEffect(() => {
    const handlePop = () => {
      const path = window.location.pathname;
      const target = PATH_MAP[path] ?? 'lobby';
      const safe: Page = TABBED_PAGES.includes(target) ? target : 'lobby';
      setPage(myPlayerRef.current ? safe : 'register');
      const hash = window.location.hash.slice(1);
      if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Auto-navigate to URL-indicated page after login.
  // NOTE: we cannot call navigate() here because it strips query params like ?join=CODE.
  // Instead we push the URL manually, preserving search params so LobbyPage can auto-join.
  useEffect(() => {
    if (myPlayer && page === 'register') {
      const fromUrl = PATH_MAP[window.location.pathname];
      const target: Page = (fromUrl && TABBED_PAGES.includes(fromUrl)) ? fromUrl : 'lobby';
      const path = PAGE_PATH[target] ?? '/';
      const search = window.location.search; // preserve e.g. ?join=8652EV
      window.history.pushState(null, '', search ? `${path}${search}` : path);
      setPage(target);
    }
  }, [myPlayer?.identity, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reconnect guard ─────────────────────────────────────────────────────────
  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        timer = setTimeout(() => { if (!isActiveRef.current) window.location.reload(); }, 3000);
      } else {
        clearTimeout(timer);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { document.removeEventListener('visibilitychange', handleVisibility); clearTimeout(timer); };
  }, []);

  // ── Sprint helpers ──────────────────────────────────────────────────────────
  const goToSprint = (id: bigint, origin: 'lobby' | 'classroom') => {
    tierAtSprintStartRef.current = myPlayer?.learningTier ?? 0;
    setSessionId(id);
    setSprintOrigin(origin);
    navigate('sprint');
  };

  const goToClassroom = (id: bigint) => {
    setClassroomId(id);
    navigate('classroom');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (connectionError) {
    return (
      <div className="loading" style={{ flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 24 }}>⚠️</span>
        <span>{t('app.connectionError')}</span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t('app.connectionErrorHint')}</span>
      </div>
    );
  }

  if (!isActive) {
    return <div className="loading"><span>{t('app.connecting')}</span></div>;
  }

  const showBottomNav = TABBED_PAGES.includes(page) && !!myPlayer;
  const backTarget: Page | null =
    page === 'classroom' ? 'lobby'
    : page === 'results'  ? (inClassroom ? 'classroom' : sprintOrigin as Page)
    : null;

  return (
    <>
      {myPlayer && !myPlayer.onboardingDone && (
        <OnboardingOverlay onDone={() => {
          tierAtSprintStartRef.current = myPlayer.learningTier ?? 0;
          navigate('sprint');
        }} />
      )}

      {myPlayer && (
        <TopBar myPlayer={myPlayer} active={page} onNavigate={(tab) => navigate(tab)} />
      )}

      {backTarget && (
        <div className="pageback">
          <button
            onClick={() => navigate(backTarget)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: 14, padding: 0,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            ← {page === 'classroom' ? t('common.lobby') : t('common.back')}
          </button>
        </div>
      )}

      <main className={`content-area${showBottomNav ? ' has-bottom-nav' : ''}`}>
        {page === 'register'  && <RegisterPage onRegistered={() => navigate('lobby')} />}
        {page === 'lobby'     && (
          <LobbyPage
            myPlayer={myPlayer}
            myIdentityHex={myIdentityHex}
            onStartSprint={(id) => goToSprint(id, 'lobby')}
            onEnterClassroom={goToClassroom}
          />
        )}
        {page === 'progress'  && myIdentityHex && (
          <ProgressPage
            myIdentityHex={myIdentityHex}
            playerLearningTier={myPlayer?.learningTier ?? 0}
          />
        )}
        {page === 'classroom' && (
          <ClassroomPage
            myIdentityHex={myIdentityHex!}
            classroomId={classroomId!}
            onStartSprint={(id) => goToSprint(id, 'classroom')}
            onLeave={() => navigate('lobby')}
          />
        )}
        {page === 'sprint'    && (
          <SprintPage
            myIdentityHex={myIdentityHex!}
            onFinished={(id) => { setSessionId(id); navigate('results'); }}
          />
        )}
        {page === 'results'   && (
          <ResultsPage
            sessionId={sessionId!}
            myIdentityHex={myIdentityHex!}
            playerLearningTier={myPlayer?.learningTier ?? 0}
            newlyUnlockedTier={
              (myPlayer?.learningTier ?? 0) > tierAtSprintStartRef.current
                ? myPlayer!.learningTier
                : undefined
            }
            onNextSprint={() => {
              tierAtSprintStartRef.current = myPlayer?.learningTier ?? 0;
              navigate('sprint');
            }}
            onBack={() => navigate(inClassroom ? 'classroom' : sprintOrigin as Page)}
          />
        )}
        {page === 'account'   && (
          <AccountPage
            myPlayer={myPlayer!}
            myIdentityHex={myIdentityHex!}
            onEnterClassroom={goToClassroom}
            onBack={() => navigate('lobby')}
          />
        )}
      </main>

      {showBottomNav && <BottomNav active={page} onNavigate={(tab) => navigate(tab)} />}
    </>
  );
}

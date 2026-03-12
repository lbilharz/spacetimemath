import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpacetimeDB, useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from './module_bindings/index.js';
import { capturedToken } from './auth.js';
import RegisterPage from './pages/RegisterPage.js';
import LobbyPage from './pages/LobbyPage.js';
import ProgressPage from './pages/ProgressPage.js';
import SprintPage from './pages/SprintPage.js';
import ResultsPage from './pages/ResultsPage.js';
import AccountPage from './pages/AccountPage.js';
import ClassroomPage from './pages/ClassroomPage.js';
import ClassroomsPage from './pages/ClassroomsPage.js';
import ClassSprintResultsPage from './pages/ClassSprintResultsPage.js';
import BottomNav from './components/BottomNav.js';
import TopBar from './components/TopBar.js';
import OnboardingOverlay from './components/OnboardingOverlay.js';
import SplashGrid from './components/SplashGrid.js';

export type Page = 'register' | 'lobby' | 'classrooms' | 'progress' | 'sprint' | 'results' | 'account' | 'classroom' | 'classsprintresults';
const TABBED_PAGES: Page[] = ['lobby', 'classrooms', 'progress', 'account'];

/** Pathname → Page (only stable, deep-linkable pages) */
const PATH_MAP: Record<string, Page> = {
  '/':           'lobby',
  '/classrooms': 'classrooms',
  '/progress':   'progress',
  '/account':    'account',
  '/classroom':  'classroom',
};

/** Page → canonical pathname */
const PAGE_PATH: Partial<Record<Page, string>> = {
  lobby:      '/',
  classrooms: '/classrooms',
  progress:   '/progress',
  account:    '/account',
  classroom:  '/classroom',
  sprint:     '/sprint',
  results:    '/results',
};

export default function App() {
  const { t } = useTranslation();
  const { identity, isActive, connectionError } = useSpacetimeDB();
  const [players] = useTable(tables.players);
  const [classrooms] = useTable(tables.classrooms);
  const [classroomMembers] = useTable(tables.classroom_members);
  const [classSprints] = useTable(tables.class_sprints);
  const [recoveryKeys] = useTable(tables.recovery_keys);
  const createRecoveryKey = useSTDBReducer(reducers.createRecoveryKey);
  const [page, setPage] = useState<Page>('register');
  const [sessionId, setSessionId] = useState<bigint | null>(null);
  const [classroomId, setClassroomId] = useState<bigint | null>(null);
  const [sprintOrigin, setSprintOrigin] = useState<'lobby' | 'classroom'>('lobby');
  const [activeClassSprintId, setActiveClassSprintId] = useState<bigint | null>(null);
  const [incomingClassSprint, setIncomingClassSprint] = useState<any>(null);
  const seenClassSprintIds = useRef(new Set<bigint>());
  const tierAtSprintStartRef = useRef<number>(0);
  // Ref so event handlers can read current player without stale closure
  const myPlayerRef = useRef<{ learningTier?: number } | undefined>(undefined);

  const myIdentityHex = identity?.toHexString();
  const myPlayer = myIdentityHex
    ? players.find(p => p.identity.toHexString() === myIdentityHex)
    : undefined;

  // Persist "joined via classroom link" flag early — ?join= disappears once LobbyPage processes it.
  // Cleared as soon as onboarding completes (see OnboardingOverlay render below).
  useEffect(() => {
    if (window.location.search.includes('join=')) {
      localStorage.setItem('_joinedViaClassroom', '1');
    }
  }, []);

  // Hold the splash for at least 2.5 s on first load (not on WS reconnect).
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSplashDone(true), 2500);
    return () => clearTimeout(id);
  }, []);

  // Cache the last known player so we can keep rendering during a reconnect.
  // When the WebSocket drops (background), isActive flips to false and the
  // subscription clears — but we know who the user is and can skip the spinner.
  const [cachedPlayer, setCachedPlayer] = useState(myPlayer);
  useEffect(() => { if (myPlayer) setCachedPlayer(myPlayer); }, [myPlayer]);
  const effectivePlayer = myPlayer ?? cachedPlayer;

  useEffect(() => { myPlayerRef.current = effectivePlayer; }, [effectivePlayer]);

  // Silently generate a recovery key for any existing user who doesn't have one yet.
  // New registrations already do this in RegisterPage; this catches everyone else.
  useEffect(() => {
    if (!myPlayer || !capturedToken) return;
    const hasKey = (recoveryKeys as any[]).some(
      (k: any) => k.owner.toHexString() === myIdentityHex
    );
    if (!hasKey) createRecoveryKey({ token: capturedToken });
  }, [myPlayer?.identity, recoveryKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  const inClassroom = classroomId !== null && myIdentityHex
    ? (classroomMembers as any[]).some(
        m => m.playerIdentity.toHexString() === myIdentityHex && m.classroomId === classroomId
      )
    : false;

  // ── Class sprint detection (student alert) ───────────────────────────────────
  useEffect(() => {
    if (!myIdentityHex || page === 'sprint' || page === 'register') return;

    const myClassroomIds = (classroomMembers as any[])
      .filter(m => m.playerIdentity.toHexString() === myIdentityHex)
      .map(m => m.classroomId);

    const activeForMe = (classSprints as any[]).find(
      s => s.isActive
        && myClassroomIds.includes(s.classroomId)
        && !seenClassSprintIds.current.has(s.id)
    );

    if (activeForMe) {
      // Only show alert to non-teacher students
      const classroom = (classrooms as any[]).find(c => c.id === activeForMe.classroomId);
      const isTeacher = classroom?.teacher.toHexString() === myIdentityHex;
      if (!isTeacher) {
        seenClassSprintIds.current.add(activeForMe.id);
        setIncomingClassSprint(activeForMe);
      }
    }
  }, [classSprints, classroomMembers, page]); // eslint-disable-line react-hooks/exhaustive-deps

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
    tierAtSprintStartRef.current = effectivePlayer?.learningTier ?? 0;
    setSessionId(id);
    setSprintOrigin(origin);
    setActiveClassSprintId(null);
    navigate('sprint');
  };

  const goToClassSprint = (classSprintId: bigint, classroomId: bigint) => {
    tierAtSprintStartRef.current = effectivePlayer?.learningTier ?? 0;
    setActiveClassSprintId(classSprintId);
    setClassroomId(classroomId);
    setSprintOrigin('classroom');
    navigate('sprint');
  };

  const goToClassroom = (id: bigint) => {
    setClassroomId(id);
    navigate('classroom');
  };

  // ── Class sprint alert — brief notification, then navigate to sprint ──────────
  useEffect(() => {
    if (!incomingClassSprint) return;
    const id = setTimeout(() => {
      goToClassSprint(incomingClassSprint.id, incomingClassSprint.classroomId);
      setIncomingClassSprint(null);
    }, 1500);
    return () => clearTimeout(id);
  }, [incomingClassSprint]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ──────────────────────────────────────────────────────────────────
  if (connectionError) {
    return (
      <div className="splash-screen">
        <div className="splash-glow" />
        <SplashGrid />
        <div className="splash-title">1UP</div>
        <div className="splash-tagline" style={{ color: 'var(--wrong)', marginTop: 12 }}>
          {t('app.connectionError')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          {t('app.connectionErrorHint')}
        </div>
      </div>
    );
  }

  // First-ever load: show branded splash for at least 1.5 s,
  // then keep showing until the connection is up and we have a player.
  if (!splashDone || (!isActive && !effectivePlayer)) {
    return (
      <div className="splash-screen">
        <div className="splash-glow" />
        <SplashGrid />
        <div className="splash-title">1UP</div>
        <div className="splash-tagline">{t('app.tagline')}</div>
      </div>
    );
  }

  const showBottomNav = TABBED_PAGES.includes(page) && !!effectivePlayer;
  const backTarget: Page | null =
    page === 'classroom'           ? 'lobby'
    : page === 'results'           ? (inClassroom ? 'classroom' : sprintOrigin as Page)
    : page === 'classsprintresults' ? 'classroom'
    : null;

  return (
    <>
      {/* Subtle reconnecting pill — shown instead of a full blank screen */}
      {!isActive && effectivePlayer && (
        <div style={{
          position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--card2)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '4px 14px', fontSize: 12, color: 'var(--muted)',
          zIndex: 2000, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {t('app.reconnecting')}
        </div>
      )}

      {effectivePlayer && !effectivePlayer.onboardingDone && (
        <OnboardingOverlay
          noSprint={!!localStorage.getItem('_joinedViaClassroom')}
          onDone={() => {
            localStorage.removeItem('_joinedViaClassroom');
            tierAtSprintStartRef.current = effectivePlayer.learningTier ?? 0;
            navigate('sprint');
          }}
          onClose={() => localStorage.removeItem('_joinedViaClassroom')}
        />
      )}

      {/* Class sprint alert — shown to enrolled students when teacher fires a sprint */}
      {incomingClassSprint && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.82)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48 }}>🏫</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
            {t('classSprint.alertTitle')}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
            {t('classSprint.alertStarting')}
          </div>
        </div>
      )}

      {effectivePlayer && (
        <TopBar myPlayer={effectivePlayer} active={page} onNavigate={(tab) => navigate(tab)} />
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
        {page === 'register'  && <RegisterPage onRegistered={() => {
          // Preserve ?join=CODE so LobbyPage can auto-join after new-user registration
          const search = window.location.search;
          window.history.pushState(null, '', search ? `/${search}` : '/');
          setPage('lobby');
        }} />}
        {page === 'lobby'      && (
          <LobbyPage
            myPlayer={effectivePlayer}
            myIdentityHex={myIdentityHex}
            onStartSprint={(id) => goToSprint(id, 'lobby')}
            onEnterClassroom={goToClassroom}
            onGoToAccount={() => setPage('account')}
          />
        )}
        {page === 'classrooms' && (
          <ClassroomsPage
            myIdentityHex={myIdentityHex}
            onEnterClassroom={goToClassroom}
          />
        )}
        {page === 'progress'  && myIdentityHex && (
          <ProgressPage
            myIdentityHex={myIdentityHex}
            playerLearningTier={effectivePlayer?.learningTier ?? 0}
          />
        )}
        {page === 'classroom' && (
          <ClassroomPage
            myIdentityHex={myIdentityHex!}
            classroomId={classroomId!}
            onStartSprint={(id) => goToSprint(id, 'classroom')}
            onStartClassSprint={(csId) => {
              setActiveClassSprintId(csId);
              navigate('classsprintresults');
            }}
            onLeave={() => navigate('lobby')}
          />
        )}
        {page === 'sprint'    && (
          <SprintPage
            myIdentityHex={myIdentityHex!}
            classSprintId={activeClassSprintId ?? undefined}
            onFinished={(id) => {
              setSessionId(id);
              if (activeClassSprintId !== null) {
                navigate('classsprintresults');
              } else {
                navigate('results');
              }
            }}
          />
        )}
        {page === 'results'   && (
          <ResultsPage
            sessionId={sessionId!}
            myIdentityHex={myIdentityHex!}
            playerLearningTier={effectivePlayer?.learningTier ?? 0}
            newlyUnlockedTier={
              (effectivePlayer?.learningTier ?? 0) > tierAtSprintStartRef.current
                ? effectivePlayer!.learningTier
                : undefined
            }
            onNextSprint={() => {
              tierAtSprintStartRef.current = effectivePlayer?.learningTier ?? 0;
              navigate('sprint');
            }}
            onBack={() => navigate(inClassroom ? 'classroom' : sprintOrigin as Page)}
          />
        )}
        {page === 'account'   && (
          <AccountPage
            myPlayer={effectivePlayer!}
            myIdentityHex={myIdentityHex!}
            onEnterClassroom={goToClassroom}
            onBack={() => navigate('lobby')}
          />
        )}
        {page === 'classsprintresults' && activeClassSprintId !== null && (
          <ClassSprintResultsPage
            classSprintId={activeClassSprintId}
            myIdentityHex={myIdentityHex!}
            onBack={() => {
              setActiveClassSprintId(null);
              navigate('classroom');
            }}
          />
        )}
      </main>

      {showBottomNav && <BottomNav active={page} onNavigate={(tab) => navigate(tab)} />}
    </>
  );
}

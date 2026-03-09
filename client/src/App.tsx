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

export default function App() {
  const { t } = useTranslation();
  const { identity, isActive, connectionError } = useSpacetimeDB();
  const [players] = useTable(tables.players);
  const [classroomMembers] = useTable(tables.classroom_members);
  const [page, setPage] = useState<Page>('register');
  const [sessionId, setSessionId] = useState<bigint | null>(null);
  const [classroomId, setClassroomId] = useState<bigint | null>(null);
  // Track where to return after sprint/results
  const [sprintOrigin, setSprintOrigin] = useState<'lobby' | 'classroom'>('lobby');
  // Capture learning tier at the moment a sprint starts so we can detect unlocks on ResultsPage
  const tierAtSprintStartRef = useRef<number>(0);

  const myIdentityHex = identity?.toHexString();
  const myPlayer = myIdentityHex
    ? players.find(p => p.identity.toHexString() === myIdentityHex)
    : undefined;

  // Check if still in the specific classroom (for post-sprint routing)
  const inClassroom = classroomId !== null && myIdentityHex
    ? (classroomMembers as any[]).some(
        m => m.playerIdentity.toHexString() === myIdentityHex && m.classroomId === classroomId
      )
    : false;

  // Auto-navigate to lobby if already registered
  useEffect(() => {
    if (myPlayer && page === 'register') {
      setPage('lobby');
    }
  }, [myPlayer?.identity, page]);

  // Reconnect after backgrounding: if the WS is still dead 3s after coming back, reload.
  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        timer = setTimeout(() => {
          if (!isActiveRef.current) window.location.reload();
        }, 3000);
      } else {
        clearTimeout(timer);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(timer);
    };
  }, []);

  const goToSprint = (id: bigint, origin: 'lobby' | 'classroom') => {
    tierAtSprintStartRef.current = myPlayer?.learningTier ?? 0;
    setSessionId(id);
    setSprintOrigin(origin);
    setPage('sprint');
  };

  const goToClassroom = (id: bigint) => {
    setClassroomId(id);
    setPage('classroom');
  };

  if (connectionError) {
    return (
      <div className="loading" style={{ flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 24 }}>⚠️</span>
        <span>{t('app.connectionError')}</span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {t('app.connectionErrorHint')}
        </span>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="loading">
        <span>{t('app.connecting')}</span>
      </div>
    );
  }

  const showBottomNav = TABBED_PAGES.includes(page) && !!myPlayer;
  const backTarget: Page | null =
    page === 'classroom' ? 'lobby'
    : page === 'results'  ? (inClassroom ? 'classroom' : sprintOrigin as Page)
    : null;

  return (
    <>
      {myPlayer && !myPlayer.onboardingDone && <OnboardingOverlay />}

      {/* Desktop top nav — hidden on mobile via CSS */}
      {myPlayer && (
        <TopBar
          myPlayer={myPlayer}
          active={page}
          onNavigate={(tab) => setPage(tab)}
        />
      )}

      {/* Slim back strip for focused pages (classroom, results) */}
      {backTarget && (
        <div className="pageback">
          <button
            onClick={() => setPage(backTarget)}
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
        {page === 'register'  && <RegisterPage onRegistered={() => setPage('lobby')} />}
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
            onLeave={() => setPage('lobby')}
          />
        )}
        {page === 'sprint'    && (
          <SprintPage
            myIdentityHex={myIdentityHex!}
            onFinished={(id) => { setSessionId(id); setPage('results'); }}
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
            onBack={() => setPage(inClassroom ? 'classroom' : sprintOrigin as Page)}
          />
        )}
        {page === 'account'   && (
          <AccountPage
            myPlayer={myPlayer!}
            myIdentityHex={myIdentityHex!}
            onEnterClassroom={goToClassroom}
            onBack={() => setPage('lobby')}
          />
        )}
      </main>

      {showBottomNav && <BottomNav active={page} onNavigate={(tab) => setPage(tab)} />}
    </>
  );
}

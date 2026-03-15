import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpacetimeDB, useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from './module_bindings/index.js';
import type { ClassSprint, Classroom, ClassroomMember } from './module_bindings/types.js';
// capturedToken import removed (SEC-01): recovery key auto-gen no longer needed here
import BottomNav from './components/BottomNav.js';
import TopBar from './components/TopBar.js';
import OnboardingOverlay from './components/OnboardingOverlay.js';
import SplashGrid from './components/SplashGrid.js';
import PageRenderer from './components/PageRenderer.js';
import { useAppNavigation } from './hooks/useAppNavigation.js';
import { TABBED_PAGES, PAGE_PATH, PATH_MAP } from './navigation.js';
import type { Page } from './navigation.js';

export type { Page };

export default function App() {
  const { t } = useTranslation();
  const { identity, isActive, connectionError } = useSpacetimeDB();
  const [players] = useTable(tables.players);
  const [classrooms] = useTable(tables.classrooms);
  const [classroomMembers] = useTable(tables.classroom_members);
  const [classSprints] = useTable(tables.class_sprints);
  // recovery_keys is now a private table (SEC-01) — App.tsx fetches via getMyRecoveryCode once per session (UX-05)
  const { page, setPage, navigate, myPlayerRef } = useAppNavigation('register');
  const [sessionId, setSessionId] = useState<bigint | null>(null);
  const [classroomId, setClassroomId] = useState<bigint | null>(null);
  const [sprintOrigin, setSprintOrigin] = useState<'lobby' | 'classroom'>('lobby');
  const [activeClassSprintId, setActiveClassSprintId] = useState<bigint | null>(null);
  const [incomingClassSprint, setIncomingClassSprint] = useState<ClassSprint | null>(null);
  const seenClassSprintIds = useRef(new Set<bigint>());
  const tierAtSprintStartRef = useRef<number>(0);
  const hasFetchedRecoveryCodeRef = useRef(false);

  const getMyRecoveryCode = useSTDBReducer(reducers.getMyRecoveryCode);

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
  useEffect(() => { if (myPlayer) setCachedPlayer(myPlayer); }, [myPlayer]); // eslint-disable-line react-hooks/set-state-in-effect
  const effectivePlayer = myPlayer ?? cachedPlayer;

  useEffect(() => { myPlayerRef.current = effectivePlayer; }, [effectivePlayer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate recovery_code_results once per session (UX-05: prevents flash-of-empty on every AccountPage mount)
  useEffect(() => {
    if (myPlayer && isActive && !hasFetchedRecoveryCodeRef.current) {
      hasFetchedRecoveryCodeRef.current = true;
      getMyRecoveryCode();
    }
  }, [myPlayer?.identity?.toHexString(), isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const inClassroom = classroomId !== null && myIdentityHex
    ? (classroomMembers as unknown as ClassroomMember[]).some(
        m => m.playerIdentity.toHexString() === myIdentityHex && m.classroomId === classroomId
      )
    : false;

  // ── Class sprint detection (student alert) ───────────────────────────────────
  useEffect(() => {
    if (!myIdentityHex || page === 'sprint' || page === 'register') return;

    const myClassroomIds = (classroomMembers as unknown as ClassroomMember[])
      .filter(m => m.playerIdentity.toHexString() === myIdentityHex)
      .map(m => m.classroomId);

    const activeForMe = (classSprints as unknown as ClassSprint[]).find(
      s => s.isActive
        && myClassroomIds.includes(s.classroomId)
        && !seenClassSprintIds.current.has(s.id)
    );

    if (activeForMe) {
      // Only show alert to non-teacher students
      const classroom = (classrooms as unknown as Classroom[]).find(c => c.id === activeForMe.classroomId);
      const isTeacher = classroom?.teacher.toHexString() === myIdentityHex;
      if (!isTeacher) {
        seenClassSprintIds.current.add(activeForMe.id);
        setIncomingClassSprint(activeForMe);
      }
    }
  }, [classSprints, classroomMembers, page]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const goToClassSprint = (classSprintId: bigint, classroomIdArg: bigint) => {
    tierAtSprintStartRef.current = effectivePlayer?.learningTier ?? 0;
    setActiveClassSprintId(classSprintId);
    setClassroomId(classroomIdArg);
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

  // ── Render ──────────────────────────────────────────────────────────────────
  if (connectionError) {
    return (
      <div className="splash-screen">
        <div className="splash-glow" />
        <SplashGrid />
        <div className="splash-title">1UP</div>
        <div className="splash-tagline text-error mt-12">
          {t('app.connectionError')}
        </div>
        <div className="text-12 text-muted mt-1">
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
        <div className="reconnecting-pill">
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
          <div className="text-20 fw-bold" style={{ color: '#fff' }}>
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

      <PageRenderer
        page={page}
        myPlayer={effectivePlayer}
        myIdentityHex={myIdentityHex}
        sessionId={sessionId}
        classroomId={classroomId}
        sprintOrigin={sprintOrigin}
        activeClassSprintId={activeClassSprintId}
        tierAtSprintStartRef={tierAtSprintStartRef}
        inClassroom={inClassroom}
        showBottomNav={showBottomNav}
        onStartSprint={goToSprint}
        onEnterClassroom={goToClassroom}
        onGoToAccount={() => setPage('account')}
        setPage={setPage}
        setSessionId={setSessionId}
        setActiveClassSprintId={setActiveClassSprintId}
        navigate={navigate}
      />

      {showBottomNav && <BottomNav active={page} onNavigate={(tab) => navigate(tab)} />}
    </>
  );
}

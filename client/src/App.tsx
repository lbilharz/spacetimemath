import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpacetimeDB, useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from './module_bindings/index.js';
import type { ClassSprint, Classroom, ClassroomMember } from './module_bindings/types.js';
// capturedToken import removed (SEC-01): recovery key auto-gen no longer needed here
import BottomNav from './components/BottomNav.js';
import OnboardingOverlay from './components/OnboardingOverlay.js';

import SplashGrid from './components/SplashGrid.js';
import PageRenderer from './components/PageRenderer.js';
import { useAppNavigation } from './hooks/useAppNavigation.js';
import { TABBED_PAGES, PAGE_PATH, PATH_MAP } from './navigation.js';
import type { Page } from './navigation.js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export type { Page };

const CREDS_KEY = 'spacetimemath_credentials';
function hasSavedCredentials(): boolean {
  try { return !!localStorage.getItem(CREDS_KEY); } catch { return false; }
}
const isSessionRestore = hasSavedCredentials();

export default function App() {
  const { t, i18n } = useTranslation();

  // Handle RTL layout based on current language
  useEffect(() => {
    const isRtl = i18n.language.startsWith('ar');
    document.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Ensure these SpacetimeDB subscriptions are "elevated" to the root component 
  // so their data is permanently cached and they don't get unsubscribed / instantly 
  // cleared under the hood every time we navigate between Lobby/Classroom pages.
  const { identity, isActive, connectionError } = useSpacetimeDB();
  const [players] = useTable(tables.players);
  const [classrooms] = useTable(tables.my_classrooms);
  const [classroomMembers] = useTable(tables.my_classroom_members);
  const [classSprints] = useTable(tables.class_sprints);
  useTable(tables.my_friend_invites);
  useTable(tables.problem_stats);
  // recovery_keys is now a private table (SEC-01) — App.tsx fetches via getMyRecoveryCode once per session (UX-05)
  const { page, setPage, navigate, myPlayerRef } = useAppNavigation('register');
  const [sessionId, setSessionId] = useState<bigint | null>(null);
  const [classroomId, setClassroomId] = useState<bigint | null>(null);
  const [sprintOrigin, setSprintOrigin] = useState<'lobby' | 'classroom'>('lobby');
  const [isDiagnosticMode, setIsDiagnosticMode] = useState(false);
  const [activeClassSprintId, setActiveClassSprintId] = useState<bigint | null>(null);
  const [incomingClassSprint, setIncomingClassSprint] = useState<ClassSprint | null>(null);
  const seenClassSprintIds = useRef(new Set<bigint>());
  const tierAtSprintStartRef = useRef<number>(0);
  const hasFetchedRecoveryCodeRef = useRef(false);
  // Track first-ever connection so we never re-show splash on WS reconnect.
  // Must be state (not ref) because it's read during render for the splash guard.
  const [wasEverConnected, setWasEverConnected] = useState(false);
  useEffect(() => { if (isActive) setWasEverConnected(true); }, [isActive]);  


  // Deeplink Intent State (Notification Taps)
  const [pendingIntent, setPendingIntent] = useState<string | null>(() => {
    try { return localStorage.getItem('_pending_intent'); } catch { return null; }
  });
  useEffect(() => {
    if (pendingIntent) localStorage.setItem('_pending_intent', pendingIntent);
    else localStorage.removeItem('_pending_intent');
  }, [pendingIntent]);

  // Universal Link (iOS Associated Domains) Interception
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const urlListener = CapApp.addListener('appUrlOpen', (event) => {
      // event.url looks like: https://up.bilharz.eu/classrooms?join=123
      let slug = '';
      try {
        const urlObj = new URL(event.url);
        slug = urlObj.pathname + urlObj.search;
      } catch {
        return;
      }
      if (!slug || slug === '/') return;
      
      if (slug.includes('join=')) {
        try { localStorage.setItem('_joinedViaClassroom', '1'); } catch { /* noop */ }
      }
      
      if (slug.includes('restore=')) {
        navigate('register' as Page, undefined, slug);
      } else if (slug.startsWith('/classrooms') || slug.startsWith('/classroom')) {
        navigate('classrooms' as Page, undefined, slug);
      } else if (slug.startsWith('/friends')) {
        navigate('friends' as Page, undefined, slug);
      } else if (slug.startsWith('/account')) {
        navigate('account' as Page, undefined, slug);
      } else if (slug.startsWith('/results')) {
        navigate('results' as Page, undefined, slug);
      } else {
        navigate('lobby' as Page, undefined, slug);
      }
    });
    return () => { urlListener.then(l => l.remove()); };
  }, [navigate]);

  const getMyRecoveryCode = useSTDBReducer(reducers.getMyRecoveryCode);

  const myIdentityHex = identity?.toHexString();
  const myPlayer = myIdentityHex
    ? players.find(p => p.identity.toHexString() === myIdentityHex)
    : undefined;

  // Persist "joined via classroom link" early
  useEffect(() => {
    if (window.location.search.includes('join=')) {
      localStorage.setItem('_joinedViaClassroom', '1');
    }
  }, []);

  // Track first-ever connection vs startup sync
  const [syncTimeoutFired, setSyncTimeoutFired] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // 2.5s base minimum splash on very first install
    const id = setTimeout(() => setSplashDone(true), 2500);
    return () => clearTimeout(id);
  }, []);

  // Cache the last known player so we can keep rendering during a reconnect.
  // When the WebSocket drops (background), isActive flips to false and the
  // subscription clears — but we know who the user is and can skip the spinner.
  const [cachedPlayer, setCachedPlayer] = useState(myPlayer);
  useEffect(() => { if (myPlayer) setCachedPlayer(myPlayer); }, [myPlayer]);  
  const effectivePlayer = myPlayer ?? cachedPlayer;

  useEffect(() => {
    // Break the waiting lock if table sync hangs for 3s after websocket connection
    if (isActive && isSessionRestore && !effectivePlayer) {
      const id = setTimeout(() => setSyncTimeoutFired(true), 3000); 
      return () => clearTimeout(id);
    }
  }, [isActive, isSessionRestore, effectivePlayer]);

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
      ) || (classrooms as unknown as Classroom[]).some(
        c => c.id === classroomId && c.teacher?.toHexString() === myIdentityHex
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
  const pageRef = useRef(page);
  useEffect(() => { pageRef.current = page; }, [page]);
  
  useEffect(() => {
    // 1. Recover when bringing app to foreground
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isActiveRef.current) {
        if ((window as any).__force_stdb_reconnect) {
          console.log('[reconnect] WS down foregrounded — explicitly forcing SpacetimeDB reconnect instantly.');
          (window as any).__force_stdb_reconnect();
        }
      }
    };

    // 2. Recover instantly when OS reports internet is back
    const handleOnline = () => {
      if (!isActiveRef.current && (window as any).__force_stdb_reconnect) {
        console.log('[reconnect] Network is back online — forcefully reconnecting.');
        (window as any).__force_stdb_reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => { 
      document.removeEventListener('visibilitychange', handleVisibility); 
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // 3. Fallback: Repeatedly try to reconnect every 5 seconds if connection is dead
  // and we've already passed the onboarding (effectivePlayer exists).
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (!isActive && effectivePlayer) {
      interval = setInterval(() => {
        if (!isActiveRef.current && (window as any).__force_stdb_reconnect) {
          console.log('[reconnect] Auto-retry loop firing...');
          (window as any).__force_stdb_reconnect();
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isActive, effectivePlayer]);

  // ── Sprint helpers ──────────────────────────────────────────────────────────
  const goToSprint = (id: bigint, origin: 'lobby' | 'classroom', isDiag: boolean = false) => {
    tierAtSprintStartRef.current = effectivePlayer?.learningTier ?? 0;
    setSessionId(id);
    setSprintOrigin(origin);
    setIsDiagnosticMode(isDiag);
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
    navigate('classroom', undefined, `/classroom/${id}`);
  };

  // Deeplink parser for /classroom/[id] upon direct navigation or refresh
  useEffect(() => {
    if (page === 'classroom' && window.location.pathname.startsWith('/classroom/')) {
      const parts = window.location.pathname.split('/');
      if (parts.length > 2 && parts[2]) {
        try {
          const id = BigInt(parts[2]);
          if (id !== classroomId) {
            // Use setTimeout to avoid synchronous setState inside an effect (cascading render)
            setTimeout(() => setClassroomId(id), 0);
          }
        } catch { /* ignore invalid IDs */ }
      }
    }
  }, [page, classroomId]);

  // ── Class sprint alert — brief notification, then navigate to sprint ──────────
  useEffect(() => {
    if (!incomingClassSprint) return;
    const id = setTimeout(() => {
      goToClassSprint(incomingClassSprint.id, incomingClassSprint.classroomId);
      setIncomingClassSprint(null);
    }, 1500);
    return () => clearTimeout(id);
  }, [incomingClassSprint]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Local Notification Deep Linking ───────────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        if (action.notification.extra?.intent === 'start_sprint') {
          setPendingIntent('start_sprint');
        }
      });
    });
  }, []);

  useEffect(() => {
    // Wait until WS is up and effectivePlayer is definitively loaded
    if (pendingIntent === 'start_sprint' && effectivePlayer && isActive && page !== 'sprint') {
      setPendingIntent(null);
      goToSprint(0n, 'lobby');
    }
  }, [pendingIntent, effectivePlayer, isActive, page, goToSprint]); // Wait, goToSprint is closure-bound. Disable lint for exhaustive-deps below if needed!

  // Auto-navigate to URL-indicated page after login.
  // NOTE: we cannot call navigate() here because it strips query params like ?join=CODE.
  // Instead we push the URL manually, preserving search params so LobbyPage can auto-join.
  useEffect(() => {
    // If we're actively trying to restore an account, don't auto-redirect to lobby
    // even if they currently have a ghost/guest session active!
    if (window.location.search.includes('restore=') || window.location.hash.includes('restore=')) {
      return;
    }

    if (myPlayer && page === 'register') {
      const pathname = window.location.pathname;
      let target: Page = 'lobby';

      // Route Matching
      if (pathname.startsWith('/classroom/')) {
        target = 'classroom';
      } else if (PATH_MAP[pathname]) {
        target = PATH_MAP[pathname];
      } else if (pathname !== '/') {
        // Unknown route
        target = 'notfound';
      }

      // Enforce valid entry points (you can't hot-reload directly into a sprint)
      if (!TABBED_PAGES.includes(target) && target !== 'classroom' && target !== 'notfound') {
        target = 'lobby';
      }

      // Fallback path logic preserves the visual 404 URL
      const path = target === 'notfound' || target === 'classroom' ? pathname : (PAGE_PATH[target] ?? '/');
      const search = window.location.search; 
      window.history.pushState(null, '', search ? `${path}${search}` : path);
      setPage(target);
    }
  }, [myPlayer?.identity, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ──────────────────────────────────────────────────────────────────
  if (connectionError && !wasEverConnected) {
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-0 z-[9999] transition-colors duration-200">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 58%, rgba(251,186,0,0.18) 0%, transparent 70%)' }} />
        <SplashGrid />
        <div className="mt-6 text-[32px] font-extrabold text-slate-900 dark:text-white tracking-tight animate-[splash-fade-up_0.5s_ease-out_0.15s_backwards]">1UP</div>
        <div className="mt-3 text-sm text-red-500 font-semibold animate-[splash-fade-up_0.5s_ease-out_0.3s_backwards]">
          {t('app.connectionError')}
        </div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('app.connectionErrorHint')}
        </div>
      </div>
    );
  }

  // First-ever load: wait for base 2.5s splash AND websocket connected.
  // Returning users: Wait for websocket AND wait for player DB row to hydrate (prevent register flash).
  const isConnecting = !wasEverConnected;
  const isSyncingReturningUser = isSessionRestore && isActive && !effectivePlayer && !syncTimeoutFired;
  
  if ((!splashDone && !isSessionRestore) || isConnecting || isSyncingReturningUser) {
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-0 z-[9999] transition-colors duration-200">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 58%, rgba(251,186,0,0.18) 0%, transparent 70%)' }} />
        <SplashGrid />
        <div className="mt-6 text-[32px] font-extrabold text-slate-900 dark:text-white tracking-tight animate-[splash-fade-up_0.5s_ease-out_0.15s_backwards]">1UP</div>
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 animate-[splash-fade-up_0.5s_ease-out_0.3s_backwards]">{t('app.tagline')}</div>
      </div>
    );
  }

  const hasActiveSprintInCurrentRoom = page === 'classroom' && classroomId !== null
    ? (classSprints as unknown as any[])?.some(s => s.classroomId === classroomId && s.isActive) ?? false
    : false;

  const showBottomNav = (TABBED_PAGES.includes(page) || page === 'classroom') && !!effectivePlayer && !hasActiveSprintInCurrentRoom;
  
  const backTarget: Page | null =
    page === 'results'           ? (inClassroom ? 'classroom' : sprintOrigin as Page)
    : page === 'classsprintresults' ? 'classroom'
    : null;

  return (
    <>
      {/* Subtle reconnecting pill — shown instead of a full blank screen */}
      {(!isActive || connectionError) && effectivePlayer && (
        <div className="fixed top-[60px] left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full px-4 py-1.5 text-[13px] font-semibold z-[999] pointer-events-none drop-shadow-md">
          {t('app.reconnecting')}
        </div>
      )}

      {effectivePlayer && !effectivePlayer.onboardingDone && (
        <OnboardingOverlay
          noSprint={!!localStorage.getItem('_joinedViaClassroom')}
          onDone={() => {
            localStorage.removeItem('_joinedViaClassroom');
            
            // Brand new user explicitly skips the legacy patch-notes
            try { localStorage.setItem('seen_3x_migration', '1'); } catch (e) { console.warn(e); }

            tierAtSprintStartRef.current = effectivePlayer.learningTier ?? 0;
            goToSprint(0n, 'lobby');
          }}
          onClose={() => localStorage.removeItem('_joinedViaClassroom')}
        />
      )}



      {/* Class sprint alert — shown to enrolled students when teacher fires a sprint */}
      {incomingClassSprint && (
        <div className="fixed inset-0 z-[3000] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center gap-4 p-8 text-center transition-all">
          <div className="text-5xl drop-shadow-lg">🏫</div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {t('classSprint.alertTitle')}
          </div>
          <div className="text-sm font-medium text-white/70">
            {t('classSprint.alertStarting')}
          </div>
        </div>
      )}

      {backTarget && (
        <div className="pt-[max(env(safe-area-inset-top),_0px)] bg-white dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shrink-0 transition-colors duration-200 sticky top-0 z-50">
          <div className="h-11 flex items-center px-4 gap-2.5">
            <button
              onClick={() => navigate(backTarget)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors cursor-pointer"
            >
              ← {page === 'classroom' ? t('common.lobby') : t('common.back')}
            </button>
          </div>
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
        isDiagnosticMode={isDiagnosticMode}
        onStartSprint={goToSprint}
        onEnterClassroom={goToClassroom}
        onGoToAccount={() => setPage('account')}
        setPage={setPage}
        setSessionId={setSessionId}
        setActiveClassSprintId={setActiveClassSprintId}
        navigate={navigate}
      />

      {showBottomNav && (
        <BottomNav 
          active={TABBED_PAGES.includes(page) ? page : (page === 'classroom' ? 'classrooms' : 'lobby')} 
        />
      )}
    </>
  );
}

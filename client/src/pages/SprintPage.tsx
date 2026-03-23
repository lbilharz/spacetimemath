import React, { useState, useEffect, useRef, useCallback, useMemo, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer, useSpacetimeDB } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { ClassSprint, Player, NextProblemResultV2, IssuedProblemResultV2, ProblemStat, Answer, Session } from '../module_bindings/types.js';

import { getRechenweg } from '../utils/rechenwege.js';
import { learningTierOf } from '../utils/learningTier.js';
import DotArray from '../components/DotArray.js';
import TapLayout from '../components/TapLayout.js';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Haptics fire-and-forget — silently no-ops on web
const hapticTap  = () => Haptics.impact({ style: ImpactStyle.Light  }).catch(() => {});
const hapticOk   = () => Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
const hapticGood = () => Haptics.notification({ type: NotificationType.Success }).catch(() => {});
const hapticBad  = () => Haptics.notification({ type: NotificationType.Error   }).catch(() => {});



type Mastery = 'mastered' | 'learning' | 'struggling' | 'untouched';

// ── Diagnostic assessment sprint ─────────────────────────────────────────────
// 4 phases × 8 seconds = 32 seconds total. Problem set expands each phase.
const DIAGNOSTIC_PHASE_SECS = 15;
const DIAGNOSTIC_PHASES: (number[] | null)[] = [
  [1, 2, 5, 10],                          // Phase 0  0–8s
  [1, 2, 3, 4, 5, 10],                    // Phase 1  8–16s
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],       // Phase 2  16–24s
  null,                                    // Phase 3  24–32s (one two-digit factor)
];

function selectDiagnosticProblem(elapsed: number, lastKey: number | undefined): { a: number; b: number } {
  const phase = Math.min(Math.floor(elapsed / DIAGNOSTIC_PHASE_SECS), 3);
  let a: number, b: number;
  if (phase === 3) {
    a = 11 + Math.floor(Math.random() * 10); // 11–20
    b = 2  + Math.floor(Math.random() * 9);  // 2–10
    if (Math.random() < 0.5) { const tmp = a; a = b; b = tmp; }
  } else {
    const factors = DIAGNOSTIC_PHASES[phase] as number[];
    a = factors[Math.floor(Math.random() * factors.length)];
    b = factors[Math.floor(Math.random() * factors.length)];
  }
  const key = a * 100 + b;
  // Retry once to avoid the same problem twice
  if (key === lastKey) return selectDiagnosticProblem(elapsed, undefined);
  return { a, b };
}

function getMasteryLocal(answers: Answer[], a: number, b: number): Mastery {
  const pair = answers.filter(ans => ans.a === a && ans.b === b);
  if (pair.length === 0) return 'untouched';
  const recent = pair.slice(-10);
  const acc = recent.filter(x => x.isCorrect).length / recent.length;
  if (acc >= 0.8) return 'mastered';
  if (acc >= 0.5) return 'learning';
  return 'struggling';
}


interface Props {
  myIdentityHex: string;
  /** Set when navigating from a class-sprint alert — session is pre-created by the server */
  classSprintId?: bigint;
  onFinished: (sessionId: bigint) => void;
}

type Feedback = { isCorrect: boolean; points: number; correct: number; isTapPenalty?: boolean } | null;

const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

// ── Memoized Numpad sub-component ─────────────────────────────────────────────
interface NumpadProps {
  disabled: boolean;     // timeLeft === 0 || !!feedback
  onKey: (key: number | '←' | 'OK') => void;
}
const NUMPAD_KEYS = [1,2,3,4,5,6,7,8,9,'←' as const,0,'OK' as const];

const Numpad = React.memo(function Numpad({ disabled, onKey }: NumpadProps) {
  return (
    <div className="w-full" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8,
      maxWidth: 360,
    }}>
      {NUMPAD_KEYS.map((key) => {
        const isOk = key === 'OK';
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onKey(key)}
            className={`pressable ${isOk ? 'text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'}`}
            style={{
              padding: '14px 8px',
              fontSize: 22,
              fontWeight: 600,
              background: isOk ? 'var(--color-brand-yellow)' : undefined,
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              opacity: disabled ? 0.4 : 1,
              WebkitTapHighlightColor: 'transparent',
              boxShadow: '0 2px 0 rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
});

export default function SprintPage({ myIdentityHex, classSprintId, onFinished }: Props) {
  const { t } = useTranslation();
  const { isActive } = useSpacetimeDB();
  const [sessions] = useTable(tables.sessions);
  const [allAnswers] = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);
  const [players] = useTable(tables.players);
  const [classSprints] = useTable(tables.class_sprints);

  // Derive sprint mode from the active class sprint (if any)
  const isDiagnostic = classSprintId
    ? !!((classSprints as ClassSprint[]).find(s => s.id === classSprintId)?.isDiagnostic)
    : false;
  const SPRINT_DURATION = isDiagnostic ? 60 : 60;

  const playerLearningTier: number = (players as Player[]).find(
    p => p.identity.toHexString() === myIdentityHex
  )?.learningTier ?? 0;

  const eligibleStats = useMemo(
    () => (problemStats as ProblemStat[]).filter(s => learningTierOf(s.a, s.b) <= playerLearningTier),
    [problemStats, playerLearningTier]
  );

  const startSession = useSTDBReducer(reducers.startSession);
  const submitAnswer = useSTDBReducer(reducers.submitAnswer);
  const endSession = useSTDBReducer(reducers.endSession);
  const issueProblem = useSTDBReducer(reducers.issueProblem);
  const nextProblem = useSTDBReducer(reducers.nextProblem);

  // SEC-10: Read back the server-issued problem token (diagnostic sprint)
  const [issuedProblemResults] = useTable(tables.issued_problem_results_v2);
  // Server-driven problem delivery (normal sprint)
  const [nextProblemResults] = useTable(tables.next_problem_results_v2);

  // My answers (all-time — used for mastery-based problem selection)
  const myAnswers = useMemo(
    () => allAnswers.filter(a => a.playerIdentity.toHexString() === myIdentityHex) as Answer[],
    [allAnswers, myIdentityHex]
  );

  // Sprint state
  const [sessionId, setSessionId] = useState<bigint | null>(null);
  const [preCountdown, setPreCountdown] = useState<number | null>(null);
  const [sprintStarted, setSprintStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(SPRINT_DURATION);
  const [problem, setProblem] = useState<{ a: number; b: number; promptMode: number; options: number[] } | null>(null);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempts, setAttempts] = useState(1);
  const [ending, setEnding] = useState(false);

  const lastKeyRef = useRef<number | undefined>(undefined);
  const problemStartRef = useRef(Date.now());
  const sessionIdRef = useRef<bigint | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingAnswerRef = useRef<{ sessionId: bigint; a: number; b: number; userAnswer: number; responseMs: number; attempts: number } | null>(null);
  // Track last consumed problem token to prevent re-consuming same problem on WS reconnect
  const lastConsumedTokenRef = useRef<string | null>(null);

  const [teacherFocus] = useTable(tables.teacher_focus);
  const syncKeystroke = useSTDBReducer(reducers.syncKeystroke);

  const amIFocused = Array.from(teacherFocus as unknown as any[]).some(f => f.focusedStudentId.toHexString() === myIdentityHex);
  const isComplete = (sessions as unknown as Session[]).find(s => String(s.id) === String(sessionId))?.isComplete ?? false;

  useEffect(() => {
    if (amIFocused && !isComplete && !ending) {
      syncKeystroke({ currentInput: input }).catch(() => {});
    }
  }, [input, amIFocused, isComplete, ending, syncKeystroke]);

  // 0. Sync timeLeft with SPRINT_DURATION (solo) or server startedAt (class sprint)
  useEffect(() => {
    if (sprintStarted) return;
    if (classSprintId !== undefined) {
      const cs = (classSprints as ClassSprint[]).find(s => String(s.id) === String(classSprintId));
      if (cs) {
        const startMs = Number(cs.startedAt.microsSinceUnixEpoch / 1000n);
        setTimeLeft(Math.max(0, SPRINT_DURATION - Math.floor((Date.now() - startMs) / 1000)));
      }
    } else {
      setTimeLeft(SPRINT_DURATION);
    }
  }, [SPRINT_DURATION, classSprints]); // eslint-disable-line react-hooks/exhaustive-deps

  // 1. Start session on mount — skip for class sprints (server pre-creates the session)
  useEffect(() => {
    if (classSprintId === undefined) {
      startSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Detect new session for this player
  // Use the NEWEST incomplete session (highest id) so a leftover abandoned session
  // with an exhausted sequence never blocks a freshly created one.
  useEffect(() => {
    if (sessionId !== null) return;
    const matched = sessions.filter(s => {
      const sess = s as Session;
      if (sess.playerIdentity.toHexString() !== myIdentityHex || sess.isComplete) return false;
      // For class sprints, only accept the session created for this specific sprint
      if (classSprintId !== undefined) return String(sess.classSprintId) === String(classSprintId);
      // Solo sprint: accept any incomplete session (classSprintId === 0n)
      return !sess.classSprintId || sess.classSprintId === 0n;
    });
    // Pick the newest (highest auto-inc id) to avoid picking up an abandoned sprint
    const mySession = matched.reduce<typeof matched[0] | undefined>((best, s) =>
      !best || (s as Session).id > (best as Session).id ? s : best
    , undefined);
    if (mySession) {
      setSessionId((mySession as Session).id);
      sessionIdRef.current = (mySession as Session).id;
    }
  }, [sessions, myIdentityHex, sessionId, classSprintId]);

  // 2b. Safety: if the detected session gets closed before the sprint starts
  // (e.g. start_session's orphan cleanup ran after we detected an old session),
  // reset so effect 2 can re-detect the freshly created session.
  // Guard: skip during WS reconnect (isActive false = subscription gap, not a real completion).
  useEffect(() => {
    if (sessionId === null || sprintStarted || classSprintId !== undefined) return;
    if (!isActive) return; // subscription gap during reconnect — ignore
    const sess = (sessions as unknown as Session[]).find(s => String(s.id) === String(sessionId));
    if (sess?.isComplete) {
      setSessionId(null);
      sessionIdRef.current = null;
      setPreCountdown(null);
    }
  }, [sessions, sessionId, sprintStarted, classSprintId, isActive]);

  // 3a. When session is detected, kick off the pre-countdown
  // Normal sprint: pre-fetch first problem immediately so it arrives before countdown ends
  useEffect(() => {
    if (sessionId === null || preCountdown !== null || sprintStarted) return;
    setPreCountdown(3);
    if (!isDiagnostic) {
      nextProblem({ sessionId });
    }
  }, [sessionId, preCountdown, sprintStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3b. Tick the pre-countdown: 3→2→1→0("Go!")→null+sprintStarted
  useEffect(() => {
    if (preCountdown === null) return;
    if (preCountdown > 0) {
      const id = setTimeout(() => setPreCountdown(n => (n ?? 1) - 1), 1000);
      return () => clearTimeout(id);
    } else {
      // Show "Go!" briefly, then start the sprint
      const id = setTimeout(() => {
        setPreCountdown(null);
        setSprintStarted(true);
      }, 700);
      return () => clearTimeout(id);
    }
  }, [preCountdown]);

  // 3c. Select first problem when sprint starts + stats are ready (diagnostic only)
  // Normal sprints: first problem was pre-fetched in 3a during countdown; 3d delivers it.
  // Calling nextProblem here for normal sprints would cause a double-call that skips
  // problem #1 in the sequence (the pre-fetch result gets overwritten immediately).
  useEffect(() => {
    if (sprintStarted && !problem && isDiagnostic && eligibleStats.length > 0) {
      const p = selectDiagnosticProblem(0, undefined);
      // Fallback for diagnostic mode since it isn't using the server sequence yet
      setProblem({ ...p, promptMode: 0, options: [] });
      lastKeyRef.current = p.a * 100 + p.b;
      problemStartRef.current = Date.now();
      if (sessionIdRef.current !== null) {
        issueProblem({ sessionId: sessionIdRef.current, a: p.a, b: p.b });
      }
    }
  }, [sprintStarted, problem, problemStats.length, isDiagnostic, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3d. Receive server-delivered problem from NextProblemResult subscription (normal sprint only)
  useEffect(() => {
    if (isDiagnostic || !sprintStarted || ending) return;
    const row = (nextProblemResults as unknown as NextProblemResultV2[]).find(
      r => r.owner.toHexString() === myIdentityHex
    );
    if (!row) return;
    // Only update if this is for our current session
    if (sessionIdRef.current === null || String(row.sessionId) !== String(sessionIdRef.current)) return;
    // Prevent re-consuming the same problem token on WS reconnect (subscription re-fire)
    if (row.token === lastConsumedTokenRef.current) return;
    setProblem({ a: row.a, b: row.b, promptMode: row.promptMode, options: Array.from(row.options) });
    setAttempts(1);
    problemStartRef.current = Date.now();
    if (!('ontouchstart' in window)) inputRef.current?.focus();
  }, [nextProblemResults, isDiagnostic, sprintStarted, ending, myIdentityHex]);

  // 4. Sprint timer
  // Class sprint: tick is derived from server's startedAt — survives reloads
  // Solo sprint: local countdown from SPRINT_DURATION
  useEffect(() => {
    if (!sprintStarted) return;
    if (classSprintId !== undefined) {
      const cs = (classSprints as ClassSprint[]).find(s => String(s.id) === String(classSprintId));
      if (!cs) return;
      const startMs = Number(cs.startedAt.microsSinceUnixEpoch / 1000n);
      const tick = () => setTimeLeft(Math.max(0, SPRINT_DURATION - Math.floor((Date.now() - startMs) / 1000)));
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    } else {
      const id = setInterval(() => {
        setTimeLeft(t => { if (t <= 1) { clearInterval(id); return 0; } return t - 1; });
      }, 1000);
      return () => clearInterval(id);
    }
  }, [sprintStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // 5a. Solo: end session when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && sprintStarted && sessionId !== null && !ending && classSprintId === undefined) {
      handleEnd();
    }
  }, [timeLeft, sprintStarted, sessionId, ending]); // eslint-disable-line react-hooks/exhaustive-deps

  // 5b. Class sprint: navigate when server marks session complete OR timer expires
  useEffect(() => {
    if (classSprintId === undefined || sessionId === null || ending) return;
    const mySession = (sessions as unknown as Session[]).find(s => String(s.id) === String(sessionId));
    if (mySession?.isComplete || timeLeft === 0) {
      setEnding(true);
      onFinished(sessionId);
    }
  }, [sessions, timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnd = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || ending) return;
    setEnding(true);
    await endSession({ sessionId: sid });
    onFinished(sid);
  }, [ending, endSession, onFinished]);

  const doSubmit = useCallback(async (overrideAnswer?: number) => {
    if (!problem || sessionId === null || feedback !== null) return;
    const userAnswer = overrideAnswer !== undefined ? overrideAnswer : parseInt(input, 10);
    if (isNaN(userAnswer)) return;
    if (overrideAnswer === undefined && input.trim() === '') return;

    const responseMs = Math.min(Date.now() - problemStartRef.current, 30_000);
    const correct_answer = problem.a * problem.b;
    const isCorrect = userAnswer === correct_answer;

    const stat = (problemStats as ProblemStat[]).find(s => s.problemKey === problem.a * 100 + problem.b);
    const basePts = isCorrect ? (stat?.difficultyWeight ?? 1.0) : 0;
    const finalPts = isCorrect && problem.promptMode === 0 ? basePts * 3 : basePts;

    if (!isCorrect) {
      // Wrong answer: show "try again" feedback, keep same problem, NO server submission
      hapticBad();
      
      const isTapMode = problem.promptMode === 1;
      setFeedback({ isCorrect: false, points: 0, correct: correct_answer, isTapPenalty: isTapMode });
      setAttempts(a => a + 1);
      if (!isTapMode) setInput('');
      
      const penaltyTimeMs = isTapMode ? 1500 : 800; // Longer penalty for guessing in Tap mode
      setTimeout(() => {
        setFeedback(null);
        if (!isTapMode && !('ontouchstart' in window)) inputRef.current?.focus();
      }, penaltyTimeMs);
      return;
    }

    // SEC-10: Get the current token for this player (source differs by sprint type)
    const tokenRow = isDiagnostic
      ? (issuedProblemResults as unknown as IssuedProblemResultV2[]).find(
          r => r.owner.toHexString() === myIdentityHex
        )
      : (nextProblemResults as unknown as NextProblemResultV2[]).find(
          r => r.owner.toHexString() === myIdentityHex
        );
    if (!tokenRow) {
      // Token not yet available — queue and retry when it arrives (useEffect below)
      pendingAnswerRef.current = { sessionId, a: problem.a, b: problem.b, userAnswer, responseMs, attempts };
      return;
    }

    // Record consumed token so effect 3d ignores this row on WS reconnect re-fire
    lastConsumedTokenRef.current = tokenRow.token;
    // Correct answer: submit to SpaceTimeDB (fire-and-forget to keep UX fast)
    submitAnswer({ sessionId, a: problem.a, b: problem.b, userAnswer, responseMs, attempts, problemToken: tokenRow.token });

    // Update local score display
    setAnswered(n => n + 1);
    setCorrect(n => n + 1);
    setScore(s => +(s + finalPts).toFixed(2));

    const fb = { isCorrect: true, points: finalPts, correct: correct_answer };
    hapticGood();
    setFeedback(fb);
    setInput('');

    // Normal sprint: pre-fetch next problem immediately so server RTT overlaps with feedback display
    if (!isDiagnostic && sessionIdRef.current !== null) {
      nextProblem({ sessionId: sessionIdRef.current });
    }

    // Show feedback briefly, then next problem
    setTimeout(() => {
      setFeedback(null);
      if (isDiagnostic) {
        // Diagnostic: client selects next problem
        const elapsed = SPRINT_DURATION - timeLeft;
        const next = selectDiagnosticProblem(elapsed, lastKeyRef.current);
        setProblem({ ...next, promptMode: 0, options: [] });
        setAttempts(1);
        lastKeyRef.current = next.a * 100 + next.b;
        problemStartRef.current = Date.now();
        if (sessionIdRef.current !== null) {
          issueProblem({ sessionId: sessionIdRef.current, a: next.a, b: next.b });
        }
        if (!('ontouchstart' in window)) inputRef.current?.focus();
      }
      // Normal sprint: problem already set via subscription effect (pre-fetched above)
    }, 600);
  }, [problem, sessionId, feedback, isDiagnostic, myIdentityHex, issuedProblemResults,
      nextProblemResults, problemStats, timeLeft, classSprintId, submitAnswer, nextProblem,
      issueProblem, input, SPRINT_DURATION, attempts]);

  // SEC-10: Retry any queued answer once the token arrives (source differs by sprint type)
  useEffect(() => {
    const pending = pendingAnswerRef.current;
    if (!pending) return;
    const tokenRow = isDiagnostic
      ? (issuedProblemResults as unknown as IssuedProblemResultV2[]).find(
          r => r.owner.toHexString() === myIdentityHex
        )
      : (nextProblemResults as unknown as NextProblemResultV2[]).find(
          r => r.owner.toHexString() === myIdentityHex
        );
    if (!tokenRow) return;
    pendingAnswerRef.current = null;
    submitAnswer({ ...pending, problemToken: tokenRow.token });
  }, [issuedProblemResults, nextProblemResults]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await doSubmit();
  };

  const handleNumpadKey = useCallback((key: number | '←' | 'OK') => {
    if (key === '←') { hapticTap(); setInput(i => i.slice(0, -1)); }
    else if (key === 'OK') { hapticOk(); doSubmit(); }
    else { hapticTap(); setInput(i => i.length < 3 ? i + String(key) : i); }
  }, [doSubmit]);

  const handleTapAnswer = useCallback((ans: number) => {
    hapticTap();
    doSubmit(ans);
  }, [doSubmit]);

  // --- Derived values (memoized, placed unconditionally before early returns) ---
  const currentStat = useMemo(
    () => (problemStats as ProblemStat[]).find(s => s.problemKey === (problem?.a ?? 0) * 100 + (problem?.b ?? 0)),
    [problemStats, problem]
  );
  const difficultyTag = useMemo(() => {
    const w = currentStat?.difficultyWeight ?? 1;
    return w >= 1.5 ? { label: t('sprint.tagHard'), cls: 'tag-red' }
         : w >= 1.0 ? { label: t('sprint.tagMedium'), cls: 'tag-warn' }
         :             { label: t('sprint.tagEasy'), cls: 'tag-green' };
  }, [currentStat, t]);
  const mastery = useMemo(
    () => problem ? getMasteryLocal(myAnswers, problem.a, problem.b) : 'untouched' as Mastery,
    [myAnswers, problem]
  );

  // --- Render ---
  const timerColor = timeLeft <= 10 ? 'var(--wrong)' : timeLeft <= 20 ? 'var(--warn)' : 'var(--accent)';

  // Phase: still waiting for session to be created
  if (sessionId === null) {
    return (
      <div className="loading">
        <span className="text-sm text-muted">{t('sprint.startingSession')}</span>
      </div>
    );
  }

  // Phase: pre-sprint countdown (3-2-1-Go!)
  if (preCountdown !== null) {
    return (
      <div className="page" style={{
        alignItems: 'center', justifyContent: 'center',
        minHeight: '80vh', gap: 20, textAlign: 'center',
      }}>
        <div className="text-sm text-muted fw-semibold" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {t('sprint.getReady')}
        </div>
        <div style={{
          fontSize: preCountdown === 0 ? 80 : 108,
          fontWeight: 900,
          color: preCountdown === 0 ? 'var(--accent)' : 'var(--text)',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          transition: 'color 0.2s, font-size 0.2s',
        }}>
          {preCountdown === 0 ? t('sprint.go') : preCountdown}
        </div>
      </div>
    );
  }

  // Phase: sprint started but first problem loading
  if (!problem) {
    return (
      <div className="loading">
        <span className="text-sm text-muted">{t('sprint.loadingQuestions')}</span>
      </div>
    );
  }

  // Ring timer constants
  const RING_R = 18;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = RING_C * (1 - timeLeft / SPRINT_DURATION);

  return (
    <>
      {/* ── Fixed top bar ─────────────────────────────────────────── */}
      <header className="bg-[#2C3E50] dark:bg-slate-950 border-b border-transparent dark:border-slate-800" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        paddingTop: 'calc(8px + env(safe-area-inset-top))',
        paddingBottom: 12,
        paddingLeft: 16,
        paddingRight: 16,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          onClick={handleEnd} disabled={ending}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)', fontSize: 24, lineHeight: 1,
            padding: '4px', borderRadius: 8,
            WebkitTapHighlightColor: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label={t('sprint.endSprint')}
        >✕</button>

        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <div style={{ color: 'white', fontWeight: 800, fontSize: 16, lineHeight: 1.2, letterSpacing: '-0.5px' }}>1UP</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.2, fontWeight: 500 }}>
            {isDiagnostic 
              ? `${t('sprint.phase')} ${Math.min(Math.floor((SPRINT_DURATION - timeLeft) / DIAGNOSTIC_PHASE_SECS), 3) + 1}/4`
              : `✓ ${correct}/${answered} · ${score.toFixed(1)} pts`
            }
          </div>
        </div>

        {/* Circular ring timer — one full rotation per 60 s */}
        <svg width={44} height={44} style={{ flexShrink: 0, display: 'block' }}>
          <circle cx={22} cy={22} r={RING_R}
            fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={4} />
          <circle cx={22} cy={22} r={RING_R}
            fill="none"
            stroke={timerColor === 'var(--accent)' ? '#FBBA00' : timerColor}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={ringOffset}
            transform="rotate(-90 22 22)"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
          <text x={22} y={26.5} textAnchor="middle"
            fill="white" fontSize={13} fontWeight="800"
            style={{ fontVariantNumeric: 'tabular-nums', fontFamily: "'DM Sans', sans-serif" }}>
            {timeLeft}
          </text>
        </svg>
      </header>

      {/* ── Middle content — Flowing from top down ─────────────────── */}
      <main style={{
        position: 'fixed',
        top: 'calc(64px + env(safe-area-inset-top))', left: 0, right: 0, bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '32px 24px calc(268px + env(safe-area-inset-bottom))',
        gap: 24,
        overflowY: 'auto',
      }}>
        {/* Row: dot grid (left) + difficulty tag (right) */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          width: '100%', maxWidth: 380,
        }}>
          {problem.a <= 10 && problem.b <= 10
            ? <DotArray a={problem.a} b={problem.b} faded={mastery !== 'untouched'} cellSize={8} />
            : <div />
          }
          <span className={`tag ${difficultyTag.cls}`} style={{ flexShrink: 0, marginTop: 2 }}>
            {difficultyTag.label}
          </span>
        </div>

        {/* Equation or feedback */}
        {feedback && !feedback.isTapPenalty ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <div style={{
              fontSize: 32, fontWeight: 800,
              color: feedback.isCorrect ? '#5DD23C' : '#E8391D',
            }}>
              {feedback.isCorrect
                ? t('sprint.feedbackCorrect', { points: feedback.points.toFixed(1) })
                : t('sprint.feedbackTryAgain')}
            </div>
            {!feedback.isCorrect && (
              <div className="mt-4 px-4 py-2 bg-slate-100 rounded-lg text-sm text-slate-600 font-semibold max-w-[280px]">
                {getRechenweg(problem.a, problem.b).hint}
              </div>
            )}
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: '#A1A1A1', letterSpacing: 1.5, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>WHAT IS</div>
              <div className="text-[#2C3E50] dark:text-white" style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums' }}>
                {problem.a}&nbsp;×&nbsp;{problem.b}
              </div>
            </div>
            
            {problem.promptMode === 1 ? (
              <TapLayout options={problem.options} onAnswer={handleTapAnswer} disabled={timeLeft === 0 || !!feedback} penaltyActive={feedback?.isTapPenalty} />
            ) : (
              <form onSubmit={handleSubmit} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', justifyContent: 'center'
              }}>
              <input
                ref={inputRef}
                className="field bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                type="number"
                inputMode={isTouchDevice ? 'none' : 'numeric'}
                readOnly={isTouchDevice}
                value={input}
                onChange={e => !isTouchDevice && setInput(e.target.value)}
                placeholder="?"
                style={{
                  flex: 1, maxWidth: 160, textAlign: 'center',
                  fontSize: 32, fontWeight: 800,
                  padding: '14px 16px', borderRadius: 16,
                  caretColor: isTouchDevice ? 'transparent' : undefined,
                  border: 'none',
                  outline: 'none',
                }}
                autoFocus={!isTouchDevice}
                disabled={timeLeft === 0}
              />
              <button
                className="btn pressable"
                type="submit"
                style={{
                  fontSize: 24, padding: '0 24px', height: 66, borderRadius: 16,
                  background: 'var(--color-brand-yellow)',
                  color: '#1e293b',
                  border: 'none',
                  boxShadow: '0 2px 0 rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}
                disabled={timeLeft === 0 || !input.trim()}
              >↵</button>
            </form>
            )}
          </div>
        )}
      </main>

      {/* ── Fixed bottom numpad ────────────────────────────────────── */}
      {problem.promptMode === 0 && (
        <footer style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0, zIndex: 100,
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
          padding: '10px 16px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          display: 'flex', justifyContent: 'center',
        }}>
          <Numpad disabled={timeLeft === 0 || !!feedback} onKey={handleNumpadKey} />
        </footer>
      )}
    </>
  );
}

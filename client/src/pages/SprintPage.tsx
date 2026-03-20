import React, { useState, useEffect, useRef, useCallback, useMemo, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { ClassSprint, Player } from '../module_bindings/types.js';
import type { Identity } from 'spacetimedb';
import { getRechenweg } from '../utils/rechenwege.js';
import { learningTierOf } from '../utils/learningTier.js';
import DotArray from '../components/DotArray.js';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const hapticTap  = () => Haptics.impact({ style: ImpactStyle.Light  }).catch(() => {});
const hapticOk   = () => Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
const hapticGood = () => Haptics.notification({ type: NotificationType.Success }).catch(() => {});
const hapticBad  = () => Haptics.notification({ type: NotificationType.Error   }).catch(() => {});

const CloseIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const DeleteIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
    <line x1="18" y1="9" x2="12" y2="15" />
    <line x1="12" y1="9" x2="18" y2="15" />
  </svg>
);
const EnterIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 10 4 15 9 20" />
    <path d="M20 4v7a4 4 0 01-4 4H4" />
  </svg>
);

// Types inferred from module_bindings
type ProblemStat = {
  problemKey: number; a: number; b: number; category: number;
  attemptCount: number; correctCount: number; avgResponseMs: number; difficultyWeight: number;
};
type Answer = {
  id: bigint; playerIdentity: { toHexString(): string }; sessionId: bigint;
  a: number; b: number; userAnswer: number; isCorrect: boolean; responseMs: number;
};
type Session = {
  id: bigint; playerIdentity: { toHexString(): string };
  isComplete: boolean; weightedScore: number; classSprintId: bigint;
};
type IssuedProblemResult = {
  owner: Identity;
  token: string;
};
type NextProblemResult = {
  owner: Identity;
  sessionId: bigint;
  a: number;
  b: number;
  token: string;
};

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

type Feedback = { isCorrect: boolean; points: number; correct: number } | null;

const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

// ── Memoized Numpad sub-component ─────────────────────────────────────────────
interface NumpadProps {
  disabled: boolean;     // timeLeft === 0 || !!feedback
  onKey: (key: number | '←' | 'OK') => void;
}
const NUMPAD_KEYS = [1,2,3,4,5,6,7,8,9,'←' as const,0,'OK' as const];

const Numpad = React.memo(function Numpad({ disabled, onKey }: NumpadProps) {
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-sm mx-auto">
      {NUMPAD_KEYS.map((key) => {
        const isOk = key === 'OK';
        const isBack = key === '←';
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onKey(key)}
            className={`
              flex flex-col items-center justify-center h-[64px] sm:h-[72px] rounded-[20px] transition-all select-none
              ${isOk ? 'bg-brand-yellow font-black text-slate-900 shadow-sm shadow-brand-yellow/30 hover:bg-[#f5c300] hover:scale-[1.03] active:scale-95' :
              isBack ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95' :
              'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-0.5 active:scale-95'}
              ${disabled ? 'opacity-40 pointer-events-none' : ''}
              focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-yellow/50
            `}
          >
            {isOk ? <span className="text-xl sm:text-2xl font-black">{key}</span> :
             isBack ? <DeleteIcon className="w-7 h-7 sm:w-8 sm:h-8 opacity-80" /> :
             <span className="text-3xl sm:text-4xl font-extrabold">{key}</span>}
          </button>
        );
      })}
    </div>
  );
});

export default function SprintPage({ myIdentityHex, classSprintId, onFinished }: Props) {
  const { t } = useTranslation();
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
  const [issuedProblemResults] = useTable(tables.issued_problem_results);
  // Server-driven problem delivery (normal sprint)
  const [nextProblemResults] = useTable(tables.next_problem_results);

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
  const [problem, setProblem] = useState<{ a: number; b: number } | null>(null);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [ending, setEnding] = useState(false);

  const lastKeyRef = useRef<number | undefined>(undefined);
  const problemStartRef = useRef(Date.now());
  const attemptCountRef = useRef(1);
  const sessionIdRef = useRef<bigint | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // SEC-10: queue an answer if the token hasn't arrived yet, retry when it does
  const pendingAnswerRef = useRef<{ sessionId: bigint; a: number; b: number; userAnswer: number; responseMs: number; attempts: number } | null>(null);

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
  useEffect(() => {
    if (sessionId === null || sprintStarted || classSprintId !== undefined) return;
    const sess = (sessions as unknown as Session[]).find(s => String(s.id) === String(sessionId));
    if (sess?.isComplete) {
      setSessionId(null);
      sessionIdRef.current = null;
      setPreCountdown(null);
    }
  }, [sessions, sessionId, sprintStarted, classSprintId]);

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
      setProblem(p);
      lastKeyRef.current = p.a * 100 + p.b;
      problemStartRef.current = Date.now();
      attemptCountRef.current = 1;
      if (sessionIdRef.current !== null) {
        issueProblem({ sessionId: sessionIdRef.current, a: p.a, b: p.b });
      }
    }
  }, [sprintStarted, problem, problemStats.length, isDiagnostic, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3d. Receive server-delivered problem from NextProblemResult subscription (normal sprint only)
  useEffect(() => {
    if (isDiagnostic || !sprintStarted || ending) return;
    const row = (nextProblemResults as unknown as NextProblemResult[]).find(
      r => r.owner.toHexString() === myIdentityHex
    );
    if (!row) return;
    // Only update if this is for our current session
    if (sessionIdRef.current === null || String(row.sessionId) !== String(sessionIdRef.current)) return;
    setProblem({ a: row.a, b: row.b });
    problemStartRef.current = Date.now();
    attemptCountRef.current = 1;
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

  const doSubmit = useCallback(async () => {
    if (!problem || sessionId === null || feedback !== null) return;
    const userAnswer = parseInt(input, 10);
    if (isNaN(userAnswer) || input.trim() === '') return;

    const responseMs = Math.min(Date.now() - problemStartRef.current, 30_000);
    const correct_answer = problem.a * problem.b;
    const isCorrect = userAnswer === correct_answer;

    const stat = (problemStats as ProblemStat[]).find(s => s.problemKey === problem.a * 100 + problem.b);
    const pts = isCorrect ? (stat?.difficultyWeight ?? 1.0) : 0;

    if (!isCorrect) {
      // Wrong answer: show "try again" feedback, keep same problem, NO server submission
      hapticBad();
      attemptCountRef.current += 1;
      setFeedback({ isCorrect: false, points: 0, correct: correct_answer });
      setInput('');
      setTimeout(() => {
        setFeedback(null);
        if (!('ontouchstart' in window)) inputRef.current?.focus();
      }, 800);
      return;
    }

    // SEC-10: Get the current token for this player (source differs by sprint type)
    const tokenRow = isDiagnostic
      ? (issuedProblemResults as unknown as IssuedProblemResult[]).find(
          r => r.owner.toHexString() === myIdentityHex
        )
      : (nextProblemResults as unknown as NextProblemResult[]).find(
          r => r.owner.toHexString() === myIdentityHex
        );
    if (!tokenRow) {
      // Token not yet available — queue and retry when it arrives (useEffect below)
      pendingAnswerRef.current = { sessionId, a: problem.a, b: problem.b, userAnswer, responseMs, attempts: attemptCountRef.current };
      return;
    }

    // Correct answer: submit to SpaceTimeDB (fire-and-forget to keep UX fast)
    submitAnswer({ sessionId, a: problem.a, b: problem.b, userAnswer, responseMs, attempts: attemptCountRef.current, problemToken: tokenRow.token });

    // Update local score display
    setAnswered(n => n + 1);
    setCorrect(n => n + 1);
    setScore(s => +(s + pts).toFixed(2));

    const fb = { isCorrect: true, points: pts, correct: correct_answer };
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
        setProblem(next);
        lastKeyRef.current = next.a * 100 + next.b;
        problemStartRef.current = Date.now();
        attemptCountRef.current = 1;
        if (sessionIdRef.current !== null) {
          issueProblem({ sessionId: sessionIdRef.current, a: next.a, b: next.b });
        }
        if (!('ontouchstart' in window)) inputRef.current?.focus();
      }
      // Normal sprint: problem already set via subscription effect (pre-fetched above)
    }, 600);
  }, [problem, sessionId, feedback, isDiagnostic, myIdentityHex, issuedProblemResults,
      nextProblemResults, problemStats, timeLeft, submitAnswer, nextProblem,
      issueProblem, input, SPRINT_DURATION]);

  // SEC-10: Retry any queued answer once the token arrives (source differs by sprint type)
  useEffect(() => {
    const pending = pendingAnswerRef.current;
    if (!pending) return;
    const tokenRow = isDiagnostic
      ? (issuedProblemResults as unknown as IssuedProblemResult[]).find(
          r => r.owner.toHexString() === myIdentityHex
        )
      : (nextProblemResults as unknown as NextProblemResult[]).find(
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
  const isDanger = timeLeft <= 10;
  const isWarning = timeLeft <= 20;
  const timerColorClass = isDanger ? 'text-red-500' : isWarning ? 'text-orange-500' : 'text-brand-yellow';

  // Phase: still waiting for session to be created
  if (sessionId === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 px-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-brand-yellow mb-4" />
        <span className="text-sm font-semibold text-slate-500">{t('sprint.startingSession')}</span>
      </div>
    );
  }

  // Phase: pre-sprint countdown (3-2-1-Go!)
  if (preCountdown !== null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-slate-50 dark:bg-slate-900 px-6 text-center animate-in fade-in duration-300">
        <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 drop-shadow-sm">
          {t('sprint.getReady')}
        </div>
        <div className={`font-black tabular-nums leading-none transition-all duration-300 ${preCountdown === 0 ? 'text-[100px] text-brand-yellow scale-110 drop-shadow-[0_0_25px_rgba(250,204,21,0.5)]' : 'text-[120px] text-slate-800 dark:text-white drop-shadow-sm'}`}>
          {preCountdown === 0 ? t('sprint.go') : preCountdown}
        </div>
      </div>
    );
  }

  // Phase: sprint started but first problem loading
  if (!problem) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 px-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-brand-yellow mb-4" />
        <span className="text-sm font-semibold text-slate-500">{t('sprint.loadingQuestions')}</span>
      </div>
    );
  }

  // Ring timer constants
  const RING_R = 18;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = Math.max(0, RING_C * (1 - timeLeft / SPRINT_DURATION));

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden text-slate-900 dark:text-white transition-colors duration-200">
      {/* ── Fixed top bar ─────────────────────────────────────────── */}
      <header className="h-[64px] md:h-[72px] shrink-0 px-4 md:px-8 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl z-50">
        <button
          onClick={handleEnd} disabled={ending}
          className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-red-500 transition-colors active:scale-95"
          aria-label={t('sprint.endSprint')}
        >
          <CloseIcon className="w-6 h-6" />
        </button>

        {/* Circular ring timer — center absolute */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
          <svg width={48} height={48} className="drop-shadow-sm">
            <circle cx={24} cy={24} r={RING_R} fill="none" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth={4} />
            <circle cx={24} cy={24} r={RING_R}
              fill="none"
              stroke="currentColor"
              className={`transition-all duration-1000 ease-linear ${timerColorClass}`}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 24 24)"
            />
            <text x={24} y={29} textAnchor="middle" fill="currentColor" className="text-sm font-bold tabular-nums">
              {timeLeft}
            </text>
          </svg>
        </div>

        {/* Stats */}
        <div className="font-bold text-sm tracking-tight tabular-nums text-slate-500 dark:text-slate-400">
          {isDiagnostic
            ? <><span className={timerColorClass}>{t('sprint.phase')} {Math.min(Math.floor((SPRINT_DURATION - timeLeft) / DIAGNOSTIC_PHASE_SECS), 3) + 1}/4</span></>
            : <span className="flex items-center gap-1.5"><span className="text-green-500 -mt-0.5">✓</span> {correct}/{answered} <span className="opacity-40">·</span> {score.toFixed(1)}</span>
          }
        </div>
      </header>

      {/* ── Middle content — centered between bars ─────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 w-full relative">
        <div className="w-full max-w-[380px] flex flex-col items-center h-[280px]">
          
          {/* Row: dot grid (left) + difficulty tag (right) */}
          <div className="flex items-start justify-between w-full h-[120px] mb-4">
            {problem.a <= 10 && problem.b <= 10
              ? <DotArray a={problem.a} b={problem.b} faded={mastery !== 'untouched'} cellSize={8} />
              : <div />
            }
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 mt-0.5 transition-colors ${
              difficultyTag.cls === 'tag-red' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              difficultyTag.cls === 'tag-warn' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
              'bg-green-100 text-green-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            }`}>
              {difficultyTag.label}
            </span>
          </div>

          {/* Equation or feedback */}
          <div className="flex-1 flex items-center justify-center w-full">
            {feedback ? (
              <div className="text-center animate-in zoom-in-95 duration-200">
                <div className={`text-4xl md:text-5xl font-black tracking-tight ${feedback.isCorrect ? 'text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]'}`}>
                  {feedback.isCorrect
                    ? t('sprint.feedbackCorrect', { points: feedback.points.toFixed(1) })
                    : t('sprint.feedbackTryAgain')}
                </div>
                {!feedback.isCorrect && (
                  <div className="text-sm md:text-base font-bold text-slate-600 dark:text-slate-300 mt-4 px-5 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl shadow-sm mx-auto max-w-[280px]">
                    {getRechenweg(problem.a, problem.b).hint}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex items-center justify-center gap-3 w-full animate-in fade-in duration-200">
                <span className="text-[52px] md:text-6xl font-black tracking-tighter tabular-nums drop-shadow-sm text-slate-800 dark:text-white">
                  {problem.a}&nbsp;×&nbsp;{problem.b}&nbsp;=
                </span>
                <input
                  ref={inputRef}
                  type="number"
                  inputMode={isTouchDevice ? 'none' : 'numeric'}
                  readOnly={isTouchDevice}
                  value={input}
                  onChange={e => !isTouchDevice && setInput(e.target.value)}
                  placeholder="?"
                  className="w-[110px] md:w-[130px] rounded-[24px] bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-center text-[44px] md:text-5xl font-black py-3 md:py-4 focus:outline-none focus:border-brand-yellow focus:ring-4 focus:ring-brand-yellow/20 transition-all shadow-sm disabled:opacity-50 text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none m-0"
                  autoFocus={!isTouchDevice}
                  disabled={timeLeft === 0}
                />
                {/* Desktop Enter Button - Hidden on mobile touch where Numpad is better */}
                <button
                  type="submit"
                  className="hidden sm:flex shrink-0 ml-2 h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-brand-yellow text-slate-900 shadow-sm hover:scale-[1.03] active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  disabled={timeLeft === 0 || !input.trim()}
                >
                  <EnterIcon className="w-8 h-8 -ml-1" />
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* ── Fixed bottom numpad ────────────────────────────────────── */}
      <footer className="shrink-0 p-4 md:p-6 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Numpad disabled={timeLeft === 0 || !!feedback} onKey={handleNumpadKey} />
      </footer>
    </div>
  );
}

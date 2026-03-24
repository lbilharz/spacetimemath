import React, { useState, useEffect, useRef, useCallback, useMemo, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducer as useSTDBReducer, useSpacetimeDB } from 'spacetimedb/react';
import { reducers } from '../module_bindings/index.js';
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

// ── Performance Telemetry ─────────────────────────────────────────────────────
// Measures true hardware-to-paint latency (Interaction to Next Paint equivalent)
function useInteractionLatency() {
  const [latency, setLatency] = useState(0);
  useEffect(() => {
    let interactionStart = 0;
    const handleStart = () => { interactionStart = performance.now(); };
    const handleEnd = () => {
      // Queue a callback precisely after the next physical screen paint
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (interactionStart > 0) {
            setLatency(performance.now() - interactionStart);
            interactionStart = 0;
          }
        }, 0);
      });
    };

    window.addEventListener('touchstart', handleStart, { capture: true, passive: true });
    window.addEventListener('touchend', handleEnd, { capture: true, passive: true });
    window.addEventListener('keydown', handleStart, { capture: true, passive: true });
    window.addEventListener('keyup', handleEnd, { capture: true, passive: true });

    return () => {
      window.removeEventListener('touchstart', handleStart, { capture: true });
      window.removeEventListener('touchend', handleEnd, { capture: true });
      window.removeEventListener('keydown', handleStart, { capture: true });
      window.removeEventListener('keyup', handleEnd, { capture: true });
    };
  }, []);
  return latency;
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
            onPointerDown={(e) => {
              if (e.button !== 0 && e.pointerType === 'mouse') return;
              onKey(key);
            }}
            onClick={(e) => e.preventDefault()} // Suppress ghost clicks
            className={`select-none transition-all duration-75 active:scale-[0.92] ${
              isOk 
                ? 'text-slate-900 active:brightness-75' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white active:bg-slate-300 dark:active:bg-slate-600'
            }`}
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
              touchAction: 'manipulation', // Disables double-tap zoom delay entirely
            }}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
});

// ── Unified Database Cache Poller Firewall ────────────────────────────────────
// Instead of 8 leaky global `useTable` hooks forcing 96fps React renders on iOS,
// we aggressively firewall the massive WebSocket traffic by explicitly probing the 
// synchronous SpacetimeDB cache memory directly.
function useSprintData(db: any, myIdentityHex: string, classSprintId: bigint, sessionId: bigint | null, problemA?: number, problemB?: number) {
  const [state, setState] = useState({
    myNextRow: null as NextProblemResultV2 | null,
    myIssuedRow: null as IssuedProblemResultV2 | null,
    amIFocused: false,
    isComplete: false,
    isActive: true,
    isDiagnostic: false,
    mastery: 'untouched' as Mastery,
    playerLearningTier: 0,
    eligibleProblemStats: [] as ProblemStat[],
    myAnswers: [] as Answer[],
    classSprintStartedAt: null as bigint | null,
  });

  useEffect(() => {
    const check = () => {
      if (!db) return;
      const nextRow = Array.from(db.next_problem_results_v2.iter()).find((r: any) => r.owner.toHexString() === myIdentityHex) as NextProblemResultV2 | undefined;
      const issuedRow = Array.from(db.issued_problem_results_v2.iter()).find((r: any) => r.owner.toHexString() === myIdentityHex) as IssuedProblemResultV2 | undefined;
      const amIFocused = Array.from(db.teacher_focus.iter()).some((f: any) => f.focusedStudentId.toHexString() === myIdentityHex);
      
      let isComplete = false;
      if (sessionId !== null) {
        const s = Array.from(db.sessions.iter()).find((s: any) => String(s.id) === String(sessionId)) as Session | undefined;
        isComplete = !!s?.isComplete;
      }
      
      let isActive = true;
      let isDiagnostic = false;
      let classSprintStartedAt: bigint | null = null;
      if (classSprintId !== 0n) {
        const cs = Array.from(db.class_sprints.iter()).find((c: any) => String(c.id) === String(classSprintId)) as ClassSprint | undefined;
        if (cs) { isActive = cs.isActive; isDiagnostic = cs.isDiagnostic; classSprintStartedAt = cs.startedAt.microsSinceUnixEpoch; }
      }

      const playerLearningTier = (Array.from(db.players.iter()) as Player[]).find(
        p => p.identity.toHexString() === myIdentityHex
      )?.learningTier ?? 0;

      const problemStats = Array.from(db.problem_stats.iter()) as ProblemStat[];
      const eligibleProblemStats = problemStats.filter(s => learningTierOf(s.a, s.b) <= playerLearningTier);

      const myAnswers = (Array.from(db.answers.iter()) as Answer[]).filter((a: any) => a.playerIdentity.toHexString() === myIdentityHex);

      let mastery: Mastery = 'untouched';
      if (problemA !== undefined && problemB !== undefined) {
        mastery = getMasteryLocal(myAnswers, problemA, problemB);
      }

      setState(prev => {
        const next = { 
          myNextRow: nextRow || null, 
          myIssuedRow: issuedRow || null, 
          amIFocused, 
          isComplete, 
          isActive, 
          isDiagnostic, 
          mastery,
          playerLearningTier,
          eligibleProblemStats,
          myAnswers,
          classSprintStartedAt,
        };
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
    };
    
    check();
    const id = setInterval(check, 100);
    return () => clearInterval(id);
  }, [myIdentityHex, classSprintId, sessionId, problemA, problemB]);

  return state;
}

export default function SprintPage({ myIdentityHex, classSprintId, onFinished }: Props) {
  const { t } = useTranslation();
  const hwLatency = useInteractionLatency();

  const startSession = useSTDBReducer(reducers.startSession);
  const submitAnswer = useSTDBReducer(reducers.submitAnswer);
  const endSession = useSTDBReducer(reducers.endSession);
  const issueProblem = useSTDBReducer(reducers.issueProblem);
  const nextProblem = useSTDBReducer(reducers.nextProblem);
  const syncKeystroke = useSTDBReducer(reducers.syncKeystroke);

  const SPRINT_DURATION = 60; // Always 60 seconds, regardless of diagnostic mode

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
  const [combo, setCombo] = useState(0);
  const [attempts, setAttempts] = useState(1);
  const [ending, setEnding] = useState(false);
  const [interstitial, setInterstitial] = useState<'tap' | 'type' | null>(null);
  const [isComplete, setIsComplete] = useState(false); // Local state for session completion

  // ── Database State ────────────────────────────────────────────────────────
  // We explicitly fetch data via interval polling to stop React rendering 24 times a second
  const stdb = useSpacetimeDB();
  const db = stdb.getConnection()?.db;
  const sprintData = useSprintData(db, myIdentityHex, classSprintId ?? 0n, sessionId, problem?.a, problem?.b);
  const isDiagnostic = sprintData.isDiagnostic;

  const lastKeyRef = useRef<number | undefined>(undefined);
  const problemStartRef = useRef(Date.now());
  const sessionIdRef = useRef<bigint | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingAnswerRef = useRef<{ sessionId: bigint; a: number; b: number; userAnswer: number; responseMs: number; attempts: number } | null>(null);
  // Track last consumed problem token to prevent re-consuming same problem on WS reconnect
  const lastConsumedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (sprintData.amIFocused && !isComplete && !ending) {
      const currentInputVal = inputRef.current ? inputRef.current.value : input;
      syncKeystroke({ currentInput: currentInputVal }).catch(() => {});
    }
  }, [input, sprintData.amIFocused, isComplete, ending, syncKeystroke]);

  // Enforce desktop focus whenever the input is supposed to be visible
  useEffect(() => {
    if (sprintStarted && !ending && feedback === null && !interstitial && problem?.promptMode === 0 && !isTouchDevice) {
      // Small timeout guarantees React has committed the unmounted/remounted DOM elements
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [feedback, interstitial, problem?.promptMode, sprintStarted, ending]);

  // 0. Sync timeLeft with SPRINT_DURATION (solo) or server startedAt (class sprint)
  useEffect(() => {
    if (sprintStarted) return;
    if (classSprintId !== undefined) {
      if (sprintData.classSprintStartedAt !== null) {
        const startMs = Number(sprintData.classSprintStartedAt / 1000n);
        setTimeLeft(Math.max(0, SPRINT_DURATION - Math.floor((Date.now() - startMs) / 1000)));
      }
    } else {
      setTimeLeft(SPRINT_DURATION);
    }
  }, [SPRINT_DURATION, classSprintId, sprintData.classSprintStartedAt, sprintStarted]);

  // 1. Start session on mount — skip for class sprints (server pre-creates the session)
  useEffect(() => {
    if (classSprintId === undefined) {
      startSession();
    }
  }, [classSprintId, startSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Detect new session for this player
  // Use the NEWEST incomplete session (highest id) so a leftover abandoned session
  // with an exhausted sequence never blocks a freshly created one.
  useEffect(() => {
    if (sessionId !== null || !db) return;
    const matched = (Array.from(db.sessions.iter()) as Session[]).filter(s => {
      if (s.playerIdentity.toHexString() !== myIdentityHex || s.isComplete) return false;
      // For class sprints, only accept the session created for this specific sprint
      if (classSprintId !== undefined) return String(s.classSprintId) === String(classSprintId);
      // Solo sprint: accept any incomplete session (classSprintId === 0n)
      return !s.classSprintId || s.classSprintId === 0n;
    });
    // Pick the newest (highest auto-inc id) to avoid picking up an abandoned sprint
    const mySession = matched.reduce<typeof matched[0] | undefined>((best, s) =>
      !best || Number(s.id) > Number(best.id) ? s : best
    , undefined);
    if (mySession) {
      setSessionId(mySession.id);
      sessionIdRef.current = mySession.id;
    }
  }, [myIdentityHex, sessionId, classSprintId, db]);

  // 1. Check if server auto-finalized our session
  useEffect(() => {
    if (sprintStarted && sessionId !== null && !isComplete && sprintData.isComplete) {
      setIsComplete(true);
      setEnding(true);
    }
  }, [sprintData.isComplete, sessionId, sprintStarted, isComplete]);

  // 2. Class Sprint auto-shutdown
  useEffect(() => {
    if (classSprintId !== undefined && classSprintId !== 0n && !sprintData.isActive && sprintStarted && !isComplete) {
      setIsComplete(true);
      setEnding(true);
    }
  }, [sprintData.isActive, classSprintId, sprintStarted, isComplete]);

  // 3a. When session is detected, kick off the pre-countdown
  // Normal sprint: pre-fetch first problem immediately so it arrives before countdown ends
  useEffect(() => {
    if (sessionId === null || preCountdown !== null || sprintStarted) return;
    setPreCountdown(3);
    if (!isDiagnostic) {
      nextProblem({ sessionId });
    }
  }, [sessionId, preCountdown, sprintStarted, isDiagnostic, nextProblem]);

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
    if (sprintStarted && !problem && !isDiagnostic && !sprintData.myNextRow) {
       // Just wait for 3d to pick up the pre-fetched token from effect 3a.
    } else if (sprintStarted && !problem && isDiagnostic && sprintData.eligibleProblemStats.length > 0) {
      const p = selectDiagnosticProblem(0, undefined);
      // Fallback for diagnostic mode since it isn't using the server sequence yet
      setProblem({ ...p, promptMode: 0, options: [] });
      if (sessionIdRef.current !== null) {
        issueProblem({ sessionId: sessionIdRef.current, a: p.a, b: p.b });
      }
    }
  }, [sprintStarted, problem, sprintData.eligibleProblemStats.length, isDiagnostic, sessionId, issueProblem]);

  // 3d. Receive server-delivered problem from NextProblemResult subscription (normal sprint only)
  useEffect(() => {
    if (isDiagnostic || !sprintStarted || ending) return;
    const row = sprintData.myNextRow;
    if (!row) return;
    // Only update if this is for our current session
    if (sessionIdRef.current === null || String(row.sessionId) !== String(sessionIdRef.current)) return;
    // Prevent re-consuming the same problem token on WS reconnect (subscription re-fire)
    if (row.token === lastConsumedTokenRef.current) return;
    
    const newMode = row.promptMode;
    const oldMode = problem?.promptMode;
    const isFirstProblem = problem === null;
    
    if (!isFirstProblem && oldMode !== undefined && newMode !== oldMode) {
      setInterstitial(newMode === 1 ? 'tap' : 'type');
      lastConsumedTokenRef.current = row.token;

      setTimeout(() => {
        setInterstitial(null);
        setProblem({ a: row.a, b: row.b, promptMode: row.promptMode, options: Array.from(row.options) });
        setAttempts(1);
        problemStartRef.current = Date.now();
      }, 1500);
      return;
    }

    lastConsumedTokenRef.current = row.token;
    setProblem({ a: row.a, b: row.b, promptMode: row.promptMode, options: Array.from(row.options) });
    setAttempts(1);
    problemStartRef.current = Date.now();
  }, [sprintData.myNextRow, isDiagnostic, sprintStarted, ending, problem?.promptMode]);

  // 4. Sprint timer
  // Class sprint: tick is derived from server's startedAt — survives reloads
  // Solo sprint: local countdown from SPRINT_DURATION
  useEffect(() => {
    if (!sprintStarted) return;
    if (classSprintId !== undefined) {
      if (sprintData.classSprintStartedAt === null) return;
      const startMs = Number(sprintData.classSprintStartedAt / 1000n);
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
  }, [sprintStarted, classSprintId, SPRINT_DURATION, sprintData.classSprintStartedAt]);

  // 5a. Solo: end session when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && sprintStarted && sessionId !== null && !ending && classSprintId === undefined) {
      handleEnd();
    }
  }, [timeLeft, sprintStarted, sessionId, ending, classSprintId]);

  // 5b. Class sprint: navigate when server marks session complete OR timer expires
  useEffect(() => {
    if (classSprintId === undefined || sessionId === null || ending) return;
    if (sprintData.isComplete || timeLeft === 0) {
      setEnding(true);
      onFinished(sessionId);
    }
  }, [sprintData.isComplete, timeLeft, classSprintId, sessionId, ending, onFinished]);

  const handleEnd = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || ending) return;
    setEnding(true);
    await endSession({ sessionId: sid });
    onFinished(sid);
  }, [ending, endSession, onFinished]);

  const doSubmit = useCallback(async (overrideAnswer?: number) => {
    if (!problem || sessionId === null || feedback !== null) return;
    const currentVal = inputRef.current ? inputRef.current.value : input;
    const userAnswer = overrideAnswer !== undefined ? overrideAnswer : parseInt(currentVal, 10);
    if (isNaN(userAnswer)) return;
    if (overrideAnswer === undefined && currentVal.trim() === '') return;

    const responseMs = Math.min(Date.now() - problemStartRef.current, 30_000);
    const correct_answer = problem.a * problem.b;
    const isCorrect = userAnswer === correct_answer;

    const stat = sprintData.eligibleProblemStats.find(s => s.problemKey === problem.a * 100 + problem.b);
    const basePts = isCorrect ? (stat?.difficultyWeight ?? 1.0) : 0;
    const finalPts = isCorrect && problem.promptMode === 0 ? basePts * 3 : basePts;

    if (!isCorrect) {
      // Wrong answer: show "try again" feedback, keep same problem, NO server submission
      hapticBad();
      setCombo(0);
      
      const isTapMode = problem.promptMode === 1;
      setFeedback({ isCorrect: false, points: 0, correct: correct_answer, isTapPenalty: isTapMode });
      setAttempts(a => a + 1);
      if (!isTapMode) {
        if (inputRef.current) inputRef.current.value = '';
        setInput('');
      }
      
      const penaltyTimeMs = isTapMode ? 1500 : 800; // Longer penalty for guessing in Tap mode
      setTimeout(() => {
        setFeedback(null);
      }, penaltyTimeMs);
      return;
    }

    // SEC-10: Get the current token for this player (source differs by sprint type)
    const tokenRow = isDiagnostic ? sprintData.myIssuedRow : sprintData.myNextRow;
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
    setCombo(c => c + 1);
    setAnswered(n => n + 1);
    setCorrect(n => n + 1);
    setScore(s => +(s + finalPts).toFixed(2));

    const fb = { isCorrect: true, points: finalPts, correct: correct_answer };
    hapticGood();
    setFeedback(fb);
    if (inputRef.current) inputRef.current.value = '';
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
      }
      // Normal sprint: problem already set via subscription effect (pre-fetched above)
    }, 600);
  }, [problem, sessionId, feedback, isDiagnostic, sprintData.myIssuedRow,
      sprintData.myNextRow, sprintData.eligibleProblemStats, timeLeft, classSprintId, submitAnswer, nextProblem,
      issueProblem, input, SPRINT_DURATION, attempts]);

  // SEC-10: Retry any queued answer once the token arrives
  useEffect(() => {
    const pending = pendingAnswerRef.current;
    if (!pending) return;
    const tokenRow = isDiagnostic ? sprintData.myIssuedRow : sprintData.myNextRow;
    if (!tokenRow) return;

    // Found token! Discard queue and immediately fire submission
    pendingAnswerRef.current = null;
    submitAnswer({ ...pending, problemToken: tokenRow.token });
  }, [sprintData.myIssuedRow, sprintData.myNextRow, isDiagnostic, submitAnswer]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await doSubmit();
  };

  const handleNumpadKey = useCallback((key: number | '←' | 'OK') => {
    if (key === 'OK') { hapticOk(); doSubmit(); return; }
    
    hapticTap();
    if (inputRef.current) {
      let val = inputRef.current.value;
      if (key === '←') {
        val = val.slice(0, -1);
      } else if (val.length < 3) {
        val += String(key);
      }
      inputRef.current.value = val;
      setInput(val);
    } else {
      if (key === '←') { setInput(i => i.slice(0, -1)); }
      else { setInput(i => i.length < 3 ? i + String(key) : i); }
    }
  }, [doSubmit]);

  const handleTapAnswer = useCallback((ans: number) => {
    hapticTap();
    doSubmit(ans);
  }, [doSubmit]);

  // --- Derived values (memoized, placed unconditionally before early returns) ---
  const currentStat = useMemo(
    () => sprintData.eligibleProblemStats.find(s => s.problemKey === (problem?.a ?? 0) * 100 + (problem?.b ?? 0)),
    [sprintData.eligibleProblemStats, problem]
  );
  const difficultyTag = useMemo(() => {
    const w = currentStat?.difficultyWeight ?? 1;
    return w >= 1.5 ? { label: t('sprint.tagHard'), cls: 'tag-red' }
         : w >= 1.0 ? { label: t('sprint.tagMedium'), cls: 'tag-warn' }
         :             { label: t('sprint.tagEasy'), cls: 'tag-green' };
  }, [currentStat, t]);
  const mastery = sprintData.mastery;

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
        display: 'flex', flexDirection: 'column',
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
          <div style={{ color: 'white', fontWeight: 800, fontSize: 16, lineHeight: 1.2, letterSpacing: '-0.5px' }}>
            1UP <span className="text-[10px] font-normal opacity-50 ml-1 tracking-normal">{hwLatency > 0 ? `${hwLatency.toFixed(0)}ms` : ''}</span>
          </div>
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
        {/* Power Meter */}
        {sprintStarted && !isDiagnostic && (
          <div className="w-full max-w-[380px] flex items-center justify-between mb-[-8px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Streak</span>
            <div className="flex gap-1.5 object-right">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`h-1.5 w-10 sm:w-12 rounded-full transition-all duration-300 ${
                  combo > i 
                    ? (i === 4 ? 'bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]' : 'bg-brand-yellow shadow-[0_0_8px_rgba(251,186,0,0.5)]') 
                    : 'bg-slate-200 dark:bg-slate-800'
                }`} />
              ))}
            </div>
          </div>
        )}

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
        {interstitial ? (
          <div className="flex flex-col items-center justify-center min-h-[180px] w-full max-w-[360px] animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className={`text-2xl font-black uppercase tracking-widest px-8 py-6 rounded-3xl border-4 shadow-xl flex flex-col items-center gap-3 ${interstitial === 'tap' ? 'bg-indigo-50/90 dark:bg-indigo-900/50 text-indigo-500 border-indigo-200 dark:border-indigo-800' : 'bg-brand-yellow/10 text-amber-600 border-brand-yellow/30'}`}>
               <span className="text-5xl animate-bounce">{interstitial === 'tap' ? '👆' : '⌨️'}</span>
               {interstitial === 'tap' ? 'TAP MODE' : 'TYPE MODE'}
            </div>
          </div>
        ) : feedback && !feedback.isTapPenalty ? (
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
              <div className="relative w-full flex justify-center">
                <TapLayout options={problem.options} onAnswer={handleTapAnswer} disabled={timeLeft === 0 || !!feedback} penaltyActive={feedback?.isTapPenalty} />
                
                {feedback?.isTapPenalty && (
                  <div className="absolute inset-x-0 -top-4 -bottom-4 z-10 flex flex-col items-center justify-center bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm rounded-3xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-red-500 text-white font-black px-6 py-4 rounded-2xl shadow-[0_8px_30px_rgb(239,68,68,0.3)] flex flex-col items-center transform transition-transform">
                      <span className="text-3xl mb-1">⏱</span>
                      <span className="text-lg tracking-tight leading-tight text-center">
                        {t('sprint.tapPenalty', { defaultValue: 'Kurze Pause...' })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
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
                defaultValue={""}
                onInput={e => {
                  if (!isTouchDevice) setInput(e.currentTarget.value);
                }}
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

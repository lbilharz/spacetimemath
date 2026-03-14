import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { ClassSprint, Player } from '../module_bindings/types.js';
import type { Identity } from 'spacetimedb';
import { getRechenweg } from '../utils/rechenwege.js';
import { learningTierOf } from '../utils/learningTier.js';
import DotArray from '../components/DotArray.js';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Haptics fire-and-forget — silently no-ops on web
const hapticTap  = () => Haptics.impact({ style: ImpactStyle.Light  }).catch(() => {});
const hapticOk   = () => Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
const hapticGood = () => Haptics.notification({ type: NotificationType.Success }).catch(() => {});
const hapticBad  = () => Haptics.notification({ type: NotificationType.Error   }).catch(() => {});

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
const DIAGNOSTIC_PHASE_LABELS = ['1, 2, 5, 10', '+ 3, 4', '+ 6–9', '11–20 ×'];

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

function selectNextProblem(
  stats: ProblemStat[],
  myAnswers: Answer[],
  playerLearningTier: number,
  lastKey?: number
): { a: number; b: number } {
  // Group answers by problem key (myAnswers is in insertion/id order)
  const byKey = new Map<number, Answer[]>();
  for (const ans of myAnswers) {
    const key = ans.a * 100 + ans.b;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(ans);
  }

  // last-10 accuracy per problem (more responsive than all-time)
  const accMap = new Map<number, { correct: number; total: number; allTotal: number }>();
  for (const [key, answers] of byKey) {
    const recent = answers.slice(-10);
    accMap.set(key, {
      correct: recent.filter(a => a.isCorrect).length,
      total: recent.length,
      allTotal: answers.length,
    });
  }

  // Selection weight = difficulty × (1.5 − last10_accuracy) × masteryMultiplier
  // The mastery multiplier ensures blank/orange cells are introduced before the
  // algorithm settles into optimising pure score on already-green problems.
  // Once everything is mastered the multipliers equalise and difficulty takes over,
  // naturally surfacing the highest-point problems for score runs.
  const MASTERY_MULT: Record<Mastery, number> = {
    untouched:  4.0,  // strongly prefer introducing unseen problems
    struggling: 3.0,  // highest priority to fix errors
    learning:   2.0,  // reinforce in-progress problems
    mastered:   0.5,  // de-prioritise once solid
  };

  const weighted = stats.map(stat => {
    const personal = accMap.get(stat.problemKey);
    const accuracy = personal ? personal.correct / personal.total : 0;
    const mastery  = getMasteryLocal(myAnswers, stat.a, stat.b);
    let w = stat.difficultyWeight * (1.5 - accuracy) * MASTERY_MULT[mastery];
    // Suppress lower-tier pairs once the player has advanced and clearly mastered them
    if (learningTierOf(stat.a, stat.b) < playerLearningTier
        && personal && personal.allTotal >= 10 && accuracy >= 0.9) {
      w = 0.1;
    }
    // Avoid same problem twice in a row
    const samePenalty = stat.problemKey === lastKey ? 0.05 : 1.0;
    return { stat, weight: Math.max(w * samePenalty, 0.01) };
  });

  const total = weighted.reduce((s, w) => s + w.weight, 0);
  let rand = Math.random() * total;
  for (const { stat, weight } of weighted) {
    rand -= weight;
    if (rand <= 0) return { a: stat.a, b: stat.b };
  }
  const fb = stats[Math.floor(Math.random() * stats.length)];
  return { a: fb.a, b: fb.b };
}

interface Props {
  myIdentityHex: string;
  /** Set when navigating from a class-sprint alert — session is pre-created by the server */
  classSprintId?: bigint;
  onFinished: (sessionId: bigint) => void;
}

type Feedback = { isCorrect: boolean; points: number; correct: number } | null;

const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

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

  const eligibleStats = (problemStats as ProblemStat[]).filter(s =>
    learningTierOf(s.a, s.b) <= playerLearningTier
  );

  const startSession = useSTDBReducer(reducers.startSession);
  const submitAnswer = useSTDBReducer(reducers.submitAnswer);
  const endSession = useSTDBReducer(reducers.endSession);
  const issueProblem = useSTDBReducer(reducers.issueProblem);

  // SEC-10: Read back the server-issued problem token
  const [issuedProblemResults] = useTable(tables.issued_problem_results);

  // My answers (all-time — used for mastery-based problem selection)
  const myAnswers = allAnswers.filter(a => a.playerIdentity.toHexString() === myIdentityHex) as Answer[];

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
  const sessionIdRef = useRef<bigint | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // SEC-10: queue an answer if the token hasn't arrived yet, retry when it does
  const pendingAnswerRef = useRef<{ sessionId: bigint; a: number; b: number; userAnswer: number; responseMs: number } | null>(null);

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
  useEffect(() => {
    if (sessionId !== null) return;
    const mySession = sessions.find(s => {
      const sess = s as Session;
      if (sess.playerIdentity.toHexString() !== myIdentityHex || sess.isComplete) return false;
      // For class sprints, only accept the session created for this specific sprint
      if (classSprintId !== undefined) return String(sess.classSprintId) === String(classSprintId);
      // Solo sprint: accept any incomplete session (classSprintId === 0n)
      return !sess.classSprintId || sess.classSprintId === 0n;
    });
    if (mySession) {
      setSessionId((mySession as Session).id);
      sessionIdRef.current = (mySession as Session).id;
    }
  }, [sessions, myIdentityHex, sessionId, classSprintId]);

  // 3a. When session is detected, kick off the pre-countdown
  useEffect(() => {
    if (sessionId === null || preCountdown !== null || sprintStarted) return;
    setPreCountdown(3);
  }, [sessionId, preCountdown, sprintStarted]);

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

  // 3c. Select first problem when sprint starts + stats are ready
  useEffect(() => {
    if (sprintStarted && !problem && (isDiagnostic || eligibleStats.length > 0)) {
      const p = isDiagnostic
        ? selectDiagnosticProblem(0, undefined)
        : selectNextProblem(eligibleStats, myAnswers, playerLearningTier);
      setProblem(p);
      lastKeyRef.current = p.a * 100 + p.b;
      problemStartRef.current = Date.now();
      // SEC-10: issue the problem token so the server can verify the answer
      if (sessionIdRef.current !== null) {
        issueProblem({ sessionId: sessionIdRef.current, a: p.a, b: p.b });
      }
    }
  }, [sprintStarted, problem, problemStats.length, isDiagnostic]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const doSubmit = async () => {
    if (!problem || sessionId === null || feedback !== null) return;
    const userAnswer = parseInt(input, 10);
    if (isNaN(userAnswer) || input.trim() === '') return;

    const responseMs = Math.min(Date.now() - problemStartRef.current, 30_000);
    const correct_answer = problem.a * problem.b;
    const isCorrect = userAnswer === correct_answer;

    const stat = (problemStats as ProblemStat[]).find(s => s.problemKey === problem.a * 100 + problem.b);
    const pts = isCorrect ? (stat?.difficultyWeight ?? 1.0) : 0;

    // SEC-10: Get the current token for this player
    const tokenRow = (issuedProblemResults as unknown as IssuedProblemResult[]).find(
      r => r.owner.toHexString() === myIdentityHex
    );
    if (!tokenRow) {
      // Token not yet available — queue and retry when it arrives (useEffect below)
      pendingAnswerRef.current = { sessionId, a: problem.a, b: problem.b, userAnswer, responseMs };
      return;
    }

    // Submit to SpaceTimeDB (fire-and-forget to keep UX fast)
    submitAnswer({ sessionId, a: problem.a, b: problem.b, userAnswer, responseMs, problemToken: tokenRow.token });

    // Wrong answer: -2s penalty (solo only — class sprint timer is server-time derived)
    if (!isCorrect && classSprintId === undefined) {
      setTimeLeft(t => Math.max(0, t - 2));
    }

    // Update local score display
    setAnswered(n => n + 1);
    if (isCorrect) {
      setCorrect(n => n + 1);
      setScore(s => +(s + pts).toFixed(2));
    }

    const fb = { isCorrect, points: pts, correct: correct_answer };
    if (isCorrect) hapticGood(); else hapticBad();
    setFeedback(fb);
    setInput('');

    // Show feedback briefly, then next problem
    setTimeout(() => {
      setFeedback(null);
      const elapsed = SPRINT_DURATION - timeLeft;
      const next = isDiagnostic
        ? selectDiagnosticProblem(elapsed, lastKeyRef.current)
        : selectNextProblem(eligibleStats, myAnswers, playerLearningTier, lastKeyRef.current);
      setProblem(next);
      lastKeyRef.current = next.a * 100 + next.b;
      problemStartRef.current = Date.now();
      // SEC-10: issue the problem token for the next problem
      if (sessionIdRef.current !== null) {
        issueProblem({ sessionId: sessionIdRef.current, a: next.a, b: next.b });
      }
      // Only auto-focus input on non-touch devices (avoids mobile keyboard pop-up)
      if (!('ontouchstart' in window)) inputRef.current?.focus();
    }, !fb.isCorrect ? 1000 : 600);
  };

  // SEC-10: Retry any queued answer once the token arrives
  useEffect(() => {
    const pending = pendingAnswerRef.current;
    if (!pending) return;
    const tokenRow = (issuedProblemResults as unknown as IssuedProblemResult[]).find(
      r => r.owner.toHexString() === myIdentityHex
    );
    if (!tokenRow) return;
    pendingAnswerRef.current = null;
    submitAnswer({ ...pending, problemToken: tokenRow.token });
  }, [issuedProblemResults]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await doSubmit();
  };

  // --- Render ---
  const timerColor = timeLeft <= 10 ? 'var(--wrong)' : timeLeft <= 20 ? 'var(--warn)' : 'var(--accent)';
  const timerPct = (timeLeft / SPRINT_DURATION) * 100;

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

  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 24 }}>

      {/* Timer bar */}
      <div className="w-full" style={{ maxWidth: 520 }}>
        <div className="row-between" style={{ marginBottom: 6 }}>
          <span className="text-sm text-muted">
            {isDiagnostic
              ? <><b style={{ color: timerColor }}>{t('sprint.phase')} {Math.min(Math.floor((SPRINT_DURATION - timeLeft) / DIAGNOSTIC_PHASE_SECS), 3) + 1}/4</b>{' · '}{DIAGNOSTIC_PHASE_LABELS[Math.min(Math.floor((SPRINT_DURATION - timeLeft) / DIAGNOSTIC_PHASE_SECS), 3)]}</>
              : t('sprint.stats', { correct, answered })
            }
          </span>
          <span className="text-sm text-muted">
            {t('sprint.score')} <b className="text-warn">{score.toFixed(1)}</b>
          </span>
        </div>
        <div style={{
          height: 6, borderRadius: 3, background: 'var(--card2)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${timerPct}%`,
            background: timerColor,
            transition: 'width 1s linear, background 0.3s',
            borderRadius: 3,
          }} />
        </div>
      </div>


      {/* Problem card */}
      <div
        className="card w-full text-center"
        style={{
          maxWidth: 520,
          padding: '40px 32px',
          position: 'relative',
          border: feedback
            ? `2px solid ${feedback.isCorrect ? 'var(--accent)' : 'var(--wrong)'}`
            : '1px solid var(--border)',
          transition: 'border-color 0.2s',
        }}
      >
        {/* Difficulty hint */}
        {(() => {
          const s = (problemStats as ProblemStat[]).find(s => s.problemKey === problem.a * 100 + problem.b);
          const w = s?.difficultyWeight ?? 1;
          const tag = w >= 1.5 ? { label: t('sprint.tagHard'), cls: 'tag-red' }
                    : w >= 1.0 ? { label: t('sprint.tagMedium'), cls: 'tag-warn' }
                    : { label: t('sprint.tagEasy'), cls: 'tag-green' };
          return (
            <span className={`tag ${tag.cls}`} style={{ position: 'absolute', top: 16, right: 16 }}>
              {tag.label}
            </span>
          );
        })()}

        {/* Dot array for tier-0 pairs (untouched or struggling) */}
        {(() => {
          const mastery = getMasteryLocal(myAnswers, problem.a, problem.b);
          if (learningTierOf(problem.a, problem.b) !== 0) return null;
          if (mastery === 'mastered' || mastery === 'learning') return null;
          return (
            <div className="row-center mb-2">
              <DotArray a={problem.a} b={problem.b} faded={mastery !== 'untouched'} />
            </div>
          );
        })()}

        {/* Equation */}
        <div style={{
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: -2,
          marginBottom: 32,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {problem.a} × {problem.b} = ?
        </div>

        {/* Feedback overlay */}
        {feedback ? (
          <div className="mb-2">
            <div style={{
              fontSize: 32,
              fontWeight: 700,
              color: feedback.isCorrect ? 'var(--accent)' : 'var(--wrong)',
            }}>
              {feedback.isCorrect
                ? t('sprint.feedbackCorrect', { points: feedback.points.toFixed(1) })
                : t('sprint.feedbackWrong', { a: problem.a, b: problem.b, correct: feedback.correct })}
            </div>
            {!feedback.isCorrect && (
              <div className="text-sm text-muted mt-2 tabular-nums">
                {getRechenweg(problem.a, problem.b).hint}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="row-center gap-12">
            <input
              ref={inputRef}
              className="field"
              type="number"
              inputMode={isTouchDevice ? 'none' : 'numeric'}
              readOnly={isTouchDevice}
              value={input}
              onChange={e => !isTouchDevice && setInput(e.target.value)}
              placeholder="?"
              style={{
                width: 140,
                textAlign: 'center',
                fontSize: 28,
                fontWeight: 700,
                padding: '10px 16px',
                caretColor: isTouchDevice ? 'transparent' : undefined,
              }}
              autoFocus={!isTouchDevice}
              disabled={timeLeft === 0}
            />
            <button
              className="btn btn-primary"
              type="submit"
              style={{ fontSize: 20, padding: '10px 20px' }}
              disabled={timeLeft === 0 || !input.trim()}
            >
              ↵
            </button>
          </form>
        )}
      </div>

      {/* Numpad */}
      <div className="w-full" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        maxWidth: 360,
      }}>
        {([1,2,3,4,5,6,7,8,9,'←',0,'OK'] as const).map((key) => {
          const isOk = key === 'OK';
          const isBack = key === '←';
          return (
            <button
              key={key}
              type="button"
              disabled={timeLeft === 0 || !!feedback}
              onClick={() => {
                if (isBack) {
                  hapticTap();
                  setInput(i => i.slice(0, -1));
                } else if (isOk) {
                  hapticOk();
                  doSubmit();
                } else {
                  hapticTap();
                  setInput(i => i.length < 3 ? i + String(key) : i);
                }
              }}
              style={{
                padding: '14px 8px',
                fontSize: 22,
                fontWeight: isOk ? 700 : 500,
                background: isOk ? 'var(--accent)' : 'var(--card2)',
                color: isOk ? '#0a0a1a' : isBack ? 'var(--muted)' : 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                cursor: 'pointer',
                opacity: timeLeft === 0 || !!feedback ? 0.4 : 1,
                transition: 'opacity 0.15s, background 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* End sprint button */}
      <button
        className="btn btn-secondary text-base"
        onClick={handleEnd}
        disabled={ending}
      >
        {ending ? t('sprint.ending') : t('sprint.endSprint')}
      </button>
    </div>
  );
}

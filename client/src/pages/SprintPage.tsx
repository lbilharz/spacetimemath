import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
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
  isComplete: boolean; weightedScore: number;
};

const SPRINT_DURATION = 60;

type Mastery = 'mastered' | 'learning' | 'struggling' | 'untouched';

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

  // Selection weight = difficulty × (1.5 − last10_accuracy)
  const weighted = stats.map(stat => {
    const personal = accMap.get(stat.problemKey);
    const accuracy = personal ? personal.correct / personal.total : 0.5;
    let w = stat.difficultyWeight * (1.5 - accuracy);
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
  onFinished: (sessionId: bigint) => void;
}

type Feedback = { isCorrect: boolean; points: number; correct: number } | null;

const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

export default function SprintPage({ myIdentityHex, onFinished }: Props) {
  const { t } = useTranslation();
  const [sessions] = useTable(tables.sessions);
  const [allAnswers] = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);
  const [players] = useTable(tables.players);

  const playerLearningTier: number = (players as any[]).find(
    p => p.identity.toHexString() === myIdentityHex
  )?.learningTier ?? 0;

  const eligibleStats = (problemStats as ProblemStat[]).filter(s =>
    learningTierOf(s.a, s.b) <= playerLearningTier
  );

  const startSession = useSTDBReducer(reducers.startSession);
  const submitAnswer = useSTDBReducer(reducers.submitAnswer);
  const endSession = useSTDBReducer(reducers.endSession);

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

  // 1. Start session on mount
  useEffect(() => {
    startSession();
  }, []);

  // 2. Detect new session for this player
  useEffect(() => {
    if (sessionId !== null) return;
    const mySession = sessions.find(
      s => (s as Session).playerIdentity.toHexString() === myIdentityHex && !(s as Session).isComplete
    );
    if (mySession) {
      setSessionId((mySession as Session).id);
      sessionIdRef.current = (mySession as Session).id;
    }
  }, [sessions, myIdentityHex, sessionId]);

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
    if (sprintStarted && !problem && eligibleStats.length > 0) {
      const p = selectNextProblem(eligibleStats, myAnswers, playerLearningTier);
      setProblem(p);
      lastKeyRef.current = p.a * 100 + p.b;
      problemStartRef.current = Date.now();
    }
  }, [sprintStarted, problem, problemStats.length]);

  // 4. Sprint timer — starts only after pre-countdown finishes
  useEffect(() => {
    if (!sprintStarted) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [sprintStarted]);

  // 5. When timer hits 0, end session
  useEffect(() => {
    if (timeLeft === 0 && sprintStarted && sessionId !== null && !ending) {
      handleEnd();
    }
  }, [timeLeft, sprintStarted, sessionId, ending]);

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

    // Submit to SpaceTimeDB (fire-and-forget to keep UX fast)
    submitAnswer({ sessionId, a: problem.a, b: problem.b, userAnswer, responseMs });

    // Wrong answer: -2s penalty
    if (!isCorrect) {
      setTimeLeft(t => Math.max(0, t - 2));
    }

    // Update local score display
    setAnswered(n => n + 1);
    if (isCorrect) {
      setCorrect(n => n + 1);
      setScore(s => +(s + pts).toFixed(2));
    }

    const fb = { isCorrect, points: pts, correct: correct_answer };
    isCorrect ? hapticGood() : hapticBad();
    setFeedback(fb);
    setInput('');

    // Show feedback briefly, then next problem
    setTimeout(() => {
      setFeedback(null);
      const next = selectNextProblem(
        eligibleStats,
        myAnswers,
        playerLearningTier,
        lastKeyRef.current
      );
      setProblem(next);
      lastKeyRef.current = next.a * 100 + next.b;
      problemStartRef.current = Date.now();
      // Only auto-focus input on non-touch devices (avoids mobile keyboard pop-up)
      if (!('ontouchstart' in window)) inputRef.current?.focus();
    }, !fb.isCorrect ? 1000 : 600);
  };

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
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t('sprint.startingSession')}</span>
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
        <div style={{ fontSize: 13, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
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
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t('sprint.loadingQuestions')}</span>
      </div>
    );
  }

  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 24 }}>

      {/* Timer bar */}
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {t('sprint.stats', { correct, answered })}
          </span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {t('sprint.score')} <b style={{ color: 'var(--warn)' }}>{score.toFixed(1)}</b>
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
      <div className="card" style={{
        width: '100%',
        maxWidth: 520,
        textAlign: 'center',
        padding: '40px 32px',
        position: 'relative',
        border: feedback
          ? `2px solid ${feedback.isCorrect ? 'var(--accent)' : 'var(--wrong)'}`
          : '1px solid var(--border)',
        transition: 'border-color 0.2s',
      }}>
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
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
          <div style={{ marginBottom: 8 }}>
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
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
                {getRechenweg(problem.a, problem.b).hint}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        width: '100%',
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
        className="btn btn-secondary"
        onClick={handleEnd}
        disabled={ending}
        style={{ fontSize: 14 }}
      >
        {ending ? t('sprint.ending') : t('sprint.endSprint')}
      </button>
    </div>
  );
}

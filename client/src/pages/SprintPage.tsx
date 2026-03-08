import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';

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

function selectNextProblem(
  stats: ProblemStat[],
  myAnswers: Answer[],
  lastKey?: number
): { a: number; b: number } {
  // Build personal accuracy map
  const accMap = new Map<number, { correct: number; total: number }>();
  for (const ans of myAnswers) {
    const key = ans.a * 100 + ans.b;
    const s = accMap.get(key) ?? { correct: 0, total: 0 };
    accMap.set(key, { correct: s.correct + (ans.isCorrect ? 1 : 0), total: s.total + 1 });
  }

  // Selection weight = difficulty × (1.5 − personal_accuracy)
  const weighted = stats.map(stat => {
    const personal = accMap.get(stat.problemKey);
    const accuracy = personal ? personal.correct / personal.total : 0.5;
    const w = stat.difficultyWeight * (1.5 - accuracy);
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

export default function SprintPage({ myIdentityHex, onFinished }: Props) {
  const [sessions] = useTable(tables.sessions);
  const [allAnswers] = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);

  const startSession = useSTDBReducer(reducers.startSession);
  const submitAnswer = useSTDBReducer(reducers.submitAnswer);
  const endSession = useSTDBReducer(reducers.endSession);

  // My answers (all-time — used for mastery-based problem selection)
  const myAnswers = allAnswers.filter(a => a.playerIdentity.toHexString() === myIdentityHex) as Answer[];

  // Sprint state
  const [sessionId, setSessionId] = useState<bigint | null>(null);
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

  // 3. Select first problem when session + stats are ready
  useEffect(() => {
    if (sessionId !== null && !problem && problemStats.length > 0) {
      const p = selectNextProblem(problemStats as ProblemStat[], myAnswers);
      setProblem(p);
      lastKeyRef.current = p.a * 100 + p.b;
      problemStartRef.current = Date.now();
    }
  }, [sessionId, problem, problemStats.length]);

  // 4. Countdown timer
  useEffect(() => {
    if (sessionId === null) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [sessionId]);

  // 5. When timer hits 0, end session
  useEffect(() => {
    if (timeLeft === 0 && sessionId !== null && !ending) {
      handleEnd();
    }
  }, [timeLeft, sessionId, ending]);

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
    setFeedback(fb);
    setInput('');

    // Show feedback briefly, then next problem
    setTimeout(() => {
      setFeedback(null);
      const next = selectNextProblem(
        problemStats as ProblemStat[],
        myAnswers,
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

  if (!problem) {
    return (
      <div className="loading">
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {sessionId ? 'Loading questions…' : 'Starting session…'}
        </span>
      </div>
    );
  }

  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 24 }}>

      {/* Timer bar */}
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            ✓ {correct}/{answered} correct
          </span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            score: <b style={{ color: 'var(--warn)' }}>{score.toFixed(1)}</b>
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
          const tag = w >= 1.5 ? { label: '🔥 Hard', cls: 'tag-red' }
                    : w >= 1.0 ? { label: '⚡ Medium', cls: 'tag-warn' }
                    : { label: '✓ Easy', cls: 'tag-green' };
          return (
            <span className={`tag ${tag.cls}`} style={{ position: 'absolute', top: 16, right: 16 }}>
              {tag.label}
            </span>
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
          <div style={{
            fontSize: 32,
            fontWeight: 700,
            color: feedback.isCorrect ? 'var(--accent)' : 'var(--wrong)',
            marginBottom: 8,
          }}>
            {feedback.isCorrect
              ? `✓ +${feedback.points.toFixed(1)} pts`
              : `✗ ${problem.a} × ${problem.b} = ${feedback.correct} (−2s)`}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <input
              ref={inputRef}
              className="field"
              type="number"
              inputMode="numeric"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="?"
              style={{
                width: 140,
                textAlign: 'center',
                fontSize: 28,
                fontWeight: 700,
                padding: '10px 16px',
              }}
              autoFocus
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
                  setInput(i => i.slice(0, -1));
                } else if (isOk) {
                  doSubmit();
                } else {
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
        {ending ? 'Ending…' : 'End Sprint'}
      </button>
    </div>
  );
}

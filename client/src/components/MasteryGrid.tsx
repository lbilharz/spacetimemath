import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { getRechenweg } from '../utils/rechenwege.js';
import { learningTierOf } from '../utils/learningTier.js';

type Answer = { id: bigint; a: number; b: number; isCorrect: boolean; sessionId: bigint; userAnswer?: number; responseMs?: number; };
type ProblemStat = { problemKey: number; a: number; b: number; difficultyWeight: number; };

interface Props {
  answers: Answer[];
  problemStats: ProblemStat[];
  highlightSession?: bigint;
  sessionAnswers?: Answer[];
  tier1Unlocked?: boolean;
  focusCell?: { a: number; b: number } | null;
  playerLearningTier?: number;
}

type Mastery = 'mastered' | 'learning' | 'struggling' | 'untouched';

function getMastery(answers: Answer[], a: number, b: number): Mastery {
  const pair = answers.filter(ans => ans.a === a && ans.b === b);
  if (pair.length === 0) return 'untouched';
  const recent = pair.slice(-10);
  const acc = recent.filter(x => x.isCorrect).length / recent.length;
  if (acc >= 0.8) return 'mastered';
  if (acc >= 0.5) return 'learning';
  return 'struggling';
}

/** For extended pairs: combine answers from both orderings (e.g. 3×12 and 12×3). */
function getMasteryEither(answers: Answer[], a: number, b: number): Mastery {
  const pair = answers.filter(ans => (ans.a === a && ans.b === b) || (ans.a === b && ans.b === a));
  if (pair.length === 0) return 'untouched';
  const recent = pair.slice(-10);
  const acc = recent.filter(x => x.isCorrect).length / recent.length;
  if (acc >= 0.8) return 'mastered';
  if (acc >= 0.5) return 'learning';
  return 'struggling';
}

const MASTERY_COLORS: Record<Mastery, string> = {
  mastered:   '#5DD23C',
  learning:   '#FBBA00',
  struggling: '#E8391D',
  untouched:  '#E9E9E9',
};

const MASTERY_BG: Record<Mastery, string> = {
  mastered:   'rgba(93,210,60,0.15)',
  learning:   'rgba(251,186,0,0.15)',
  struggling: 'rgba(232,57,29,0.12)',
  untouched:  'var(--card2)',
};

const TIER1_A = [11, 12, 15, 20, 25];
const TIER1_B = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function MasteryGrid({ answers, problemStats, highlightSession: _highlightSession, sessionAnswers = [], tier1Unlocked = false, focusCell, playerLearningTier }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<{ a: number; b: number } | null>(null);

  useEffect(() => {
    if (focusCell) setSelected(focusCell);
  }, [focusCell?.a, focusCell?.b]); // eslint-disable-line react-hooks/exhaustive-deps
  const sessionKeys = new Set(sessionAnswers.map(a => a.a * 100 + a.b));

  const cells: React.ReactNode[] = [];
  // Header row: b labels
  cells.push(<div key="h0" className="mastery-cell mastery-cell--label text-xs fw-bold text-muted">×</div>);
  for (let b = 1; b <= 10; b++) {
    cells.push(
      <div key={`hb${b}`} className="mastery-cell mastery-cell--label text-xs fw-bold text-muted">
        {b}
      </div>
    );
  }

  for (let a = 1; a <= 10; a++) {
    // Row label
    cells.push(
      <div key={`ha${a}`} className="mastery-cell mastery-cell--label text-xs fw-bold text-muted">
        {a}
      </div>
    );
    for (let b = 1; b <= 10; b++) {
      const mastery = getMastery(answers, a, b);
      const key = a * 100 + b;
      const isHighlighted = sessionKeys.has(key);
      const isSelected = selected?.a === a && selected?.b === b;
      const stat = problemStats.find(s => s.problemKey === key);
      const w = stat?.difficultyWeight ?? 0;
      const answer = a * b;
      const isLocked = playerLearningTier !== undefined
        && learningTierOf(a, b) > playerLearningTier;

      cells.push(
        <button
          key={`${a}-${b}`}
          className="mastery-cell"
          title={t('mastery.tooltip', { a, b, answer, difficulty: w.toFixed(2) })}
          onClick={() => !isLocked && setSelected(isSelected ? null : { a, b })}
          style={{
            background: isSelected ? MASTERY_COLORS[mastery] + '33' : MASTERY_BG[mastery],
            border: isSelected
              ? `2px solid ${MASTERY_COLORS[mastery]}`
              : isHighlighted
              ? '2px solid var(--accent)'
              : `1px solid ${MASTERY_COLORS[mastery]}44`,
            color: MASTERY_COLORS[mastery],
            fontWeight: 600,
            fontSize: 13,
            position: 'relative',
            cursor: isLocked ? 'default' : 'pointer',
            opacity: isLocked ? 0.25 : 1,
          }}
        >
          {a === b ? <span style={{ opacity: 0.7 }}>{answer}</span> : answer}
          {/* Difficulty dot */}
          {w >= 1.5 && (
            <span style={{
              position: 'absolute', top: 2, right: 3,
              width: 4, height: 4, borderRadius: '50%',
              background: 'var(--wrong)', display: 'block',
            }} />
          )}
        </button>
      );
    }
  }

  const rw = selected ? getRechenweg(selected.a, selected.b) : null;

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '28px repeat(10, 34px)',
          gap: 3,
        }}>
          {cells}
        </div>
      </div>

      {/* Rechenweg panel */}
      {selected && rw && (
        <div className="mt-4" style={{
          background: 'var(--card2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 14px',
        }}>
          <div className="row gap-10 mb-2">
            <span className="fw-bold tabular-nums" style={{ fontSize: 15 }}>
              {selected.a} × {selected.b} = {selected.a * selected.b}
            </span>
            <span className="text-xs text-muted fw-semibold label-caps">
              {t(rw.strategyKey as ParseKeys)}
            </span>
          </div>
          <div className="col gap-4">
            {rw.steps.map((step, i) => (
              <div key={i} className="tabular-nums" style={{
                fontSize: 15,
                fontWeight: i === rw.steps.length - 1 ? 700 : 400,
                color: i === rw.steps.length - 1 ? 'var(--accent)' : 'var(--text)',
              }}>
                {step}{i === rw.steps.length - 1 ? ' ✓' : ''}
              </div>
            ))}
          </div>

          {/* Answer history */}
          {(() => {
            const { a: sa, b: sb } = selected!;
            const pair = answers
              .filter(ans => (ans.a === sa && ans.b === sb) || (ans.a === sb && ans.b === sa))
              .sort((x, y) => (x.id < y.id ? -1 : 1));
            if (pair.length === 0) return null;
            const recent = pair.slice(-10);
            const correct = recent.filter(x => x.isCorrect).length;
            return (
              <div className="divider-top mt-2">
                <div className="text-xs text-muted fw-semibold mb-2">
                  {correct}/{recent.length} correct (last {recent.length} of {pair.length})
                </div>
                <div className="row-wrap gap-4">
                  {recent.map((ans, i) => (
                    <div key={i} className="col gap-1" style={{ alignItems: 'center' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 4,
                        background: ans.isCorrect ? 'rgba(93,210,60,0.15)' : 'rgba(232,57,29,0.12)',
                        border: `1px solid ${ans.isCorrect ? '#5DD23C' : '#E8391D'}`,
                        color: ans.isCorrect ? '#5DD23C' : '#E8391D',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {ans.isCorrect ? '✓' : '✗'}
                      </div>
                      {!ans.isCorrect && ans.userAnswer !== undefined && (
                        <div style={{ fontSize: 9, color: '#E8391D', fontWeight: 700 }}>
                          {ans.userAnswer}
                        </div>
                      )}
                      {ans.responseMs !== undefined && (
                        <div className="text-muted" style={{ fontSize: 9 }}>
                          {(ans.responseMs / 1000).toFixed(1)}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tier-1 extended grid (unlocked) */}
      {tier1Unlocked && (() => {
        const t1cells: React.ReactNode[] = [];
        t1cells.push(<div key="t1h0" className="mastery-cell mastery-cell--label text-xs fw-bold text-muted">×</div>);
        for (const b of TIER1_B) {
          t1cells.push(
            <div key={`t1hb${b}`} className="mastery-cell mastery-cell--label text-xs fw-bold text-muted">
              {b}
            </div>
          );
        }
        for (const a of TIER1_A) {
          t1cells.push(
            <div key={`t1ha${a}`} className="mastery-cell mastery-cell--label text-xs fw-bold text-muted">
              {a}
            </div>
          );
          for (const b of TIER1_B) {
            const mastery = getMasteryEither(answers, a, b);
            const key = a * 100 + b;
            const isHighlighted = sessionKeys.has(key) || sessionKeys.has(b * 100 + a);
            const isSelected = selected?.a === a && selected?.b === b;
            const stat = problemStats.find(s => s.problemKey === key);
            const w = stat?.difficultyWeight ?? 0;
            const answer = a * b;
            t1cells.push(
              <button
                key={`t1-${a}-${b}`}
                className="mastery-cell"
                title={t('mastery.tooltip', { a, b, answer, difficulty: w.toFixed(2) })}
                onClick={() => setSelected(isSelected ? null : { a, b })}
                style={{
                  background: isSelected ? MASTERY_COLORS[mastery] + '33' : MASTERY_BG[mastery],
                  border: isSelected
                    ? `2px solid ${MASTERY_COLORS[mastery]}`
                    : isHighlighted
                    ? '2px solid var(--accent)'
                    : `1px solid ${MASTERY_COLORS[mastery]}44`,
                  color: MASTERY_COLORS[mastery],
                  fontWeight: 600,
                  fontSize: 10,
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {answer}
                {w >= 1.5 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 3,
                    width: 4, height: 4, borderRadius: '50%',
                    background: 'var(--wrong)', display: 'block',
                  }} />
                )}
              </button>
            );
          }
        }
        return (
          <div className="mt-5">
            <div className="text-xs text-accent fw-bold mb-2">
              🔓 {t('unlock.tier1GridTitle')}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '28px repeat(10, 34px)',
                gap: 3,
              }}>
                {t1cells}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="row-wrap gap-16 mt-3">
        {(['mastered', 'learning', 'struggling', 'untouched'] as Mastery[]).map(m => (
          <div key={m} className="row gap-6">
            <div style={{
              width: 12, height: 12, borderRadius: 3,
              background: MASTERY_BG[m],
              border: `1px solid ${MASTERY_COLORS[m]}`,
            }} />
            <span className="text-xs text-muted">{t(`mastery.${m}` as const)}</span>
          </div>
        ))}
        <div className="row gap-6">
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wrong)' }} />
          <span className="text-xs text-muted">{t('mastery.hardDiff')}</span>
        </div>
      </div>
    </div>
  );
}

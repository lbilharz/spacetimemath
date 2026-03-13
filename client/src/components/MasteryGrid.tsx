import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
const TIER1_B = [2, 3, 4, 5, 6, 7, 8, 9];

export default function MasteryGrid({ answers, problemStats, highlightSession: _highlightSession, sessionAnswers = [], tier1Unlocked = false, focusCell, playerLearningTier }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<{ a: number; b: number } | null>(null);

  useEffect(() => {
    if (focusCell) setSelected(focusCell);
  }, [focusCell?.a, focusCell?.b]); // eslint-disable-line react-hooks/exhaustive-deps
  const sessionKeys = new Set(sessionAnswers.map(a => a.a * 100 + a.b));

  const cells: React.ReactNode[] = [];
  // Header row: b labels
  cells.push(<div key="h0" style={{ ...cell, background: 'transparent', color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>×</div>);
  for (let b = 1; b <= 10; b++) {
    cells.push(
      <div key={`hb${b}`} style={{ ...cell, background: 'transparent', color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
        {b}
      </div>
    );
  }

  for (let a = 1; a <= 10; a++) {
    // Row label
    cells.push(
      <div key={`ha${a}`} style={{ ...cell, background: 'transparent', color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
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
          title={t('mastery.tooltip', { a, b, answer, difficulty: w.toFixed(2) })}
          onClick={() => !isLocked && setSelected(isSelected ? null : { a, b })}
          style={{
            ...cell,
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px repeat(10, 1fr)',
        gap: 3,
      }}>
        {cells}
      </div>

      {/* Rechenweg panel */}
      {selected && rw && (
        <div style={{
          marginTop: 12,
          background: 'var(--card2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '10px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
              {selected.a} × {selected.b} = {selected.a * selected.b}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t(rw.strategyKey as any)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {rw.steps.map((step, i) => (
              <div key={i} style={{
                fontSize: 15,
                fontVariantNumeric: 'tabular-nums',
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
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
                  {correct}/{recent.length} correct (last {recent.length} of {pair.length})
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {recent.map((ans, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
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
                        <div style={{ fontSize: 9, color: 'var(--muted)' }}>
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
        t1cells.push(<div key="t1h0" style={{ ...cell, background: 'transparent', color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>×</div>);
        for (const b of TIER1_B) {
          t1cells.push(
            <div key={`t1hb${b}`} style={{ ...cell, background: 'transparent', color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
              {b}
            </div>
          );
        }
        for (const a of TIER1_A) {
          t1cells.push(
            <div key={`t1ha${a}`} style={{ ...cell, background: 'transparent', color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
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
                title={t('mastery.tooltip', { a, b, answer, difficulty: w.toFixed(2) })}
                onClick={() => setSelected(isSelected ? null : { a, b })}
                style={{
                  ...cell,
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
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>
              🔓 {t('unlock.tier1GridTitle' as any)}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '28px repeat(8, 1fr)',
              gap: 3,
            }}>
              {t1cells}
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {(['mastered', 'learning', 'struggling', 'untouched'] as Mastery[]).map(m => (
          <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 12, height: 12, borderRadius: 3,
              background: MASTERY_BG[m],
              border: `1px solid ${MASTERY_COLORS[m]}`,
            }} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t(`mastery.${m}` as const)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wrong)' }} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('mastery.hardDiff')}</span>
        </div>
      </div>
    </div>
  );
}

const cell: React.CSSProperties = {
  aspectRatio: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 4,
  cursor: 'default',
  fontSize: 12,
  transition: 'opacity 0.2s',
  minWidth: 0,
  // reset button styles
  padding: 0,
  fontFamily: 'inherit',
};

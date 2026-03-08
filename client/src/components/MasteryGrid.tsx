import { useTranslation } from 'react-i18next';

type Answer = { a: number; b: number; isCorrect: boolean; sessionId: bigint; };
type ProblemStat = { problemKey: number; a: number; b: number; difficultyWeight: number; };

interface Props {
  answers: Answer[];
  problemStats: ProblemStat[];
  highlightSession?: bigint;
  sessionAnswers?: Answer[];
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

const MASTERY_COLORS: Record<Mastery, string> = {
  mastered: '#00d4aa',
  learning: '#ffd700',
  struggling: '#ff4455',
  untouched: '#2a2a45',
};

const MASTERY_BG: Record<Mastery, string> = {
  mastered: 'rgba(0,212,170,0.15)',
  learning: 'rgba(255,215,0,0.15)',
  struggling: 'rgba(255,68,85,0.15)',
  untouched: 'var(--card2)',
};

export default function MasteryGrid({ answers, problemStats, highlightSession, sessionAnswers = [] }: Props) {
  const { t } = useTranslation();
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
      const stat = problemStats.find(s => s.problemKey === key);
      const w = stat?.difficultyWeight ?? 0;
      const answer = a * b;

      cells.push(
        <div
          key={`${a}-${b}`}
          title={t('mastery.tooltip', { a, b, answer, difficulty: w.toFixed(2) })}
          style={{
            ...cell,
            background: MASTERY_BG[mastery],
            border: isHighlighted
              ? '2px solid var(--accent)'
              : `1px solid ${MASTERY_COLORS[mastery]}44`,
            color: MASTERY_COLORS[mastery],
            fontWeight: 600,
            fontSize: 13,
            position: 'relative',
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
        </div>
      );
    }
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px repeat(10, 1fr)',
        gap: 3,
      }}>
        {cells}
      </div>
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
};

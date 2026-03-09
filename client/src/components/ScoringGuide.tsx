import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type ProblemStat = { a: number; b: number; difficultyWeight: number; attemptCount: number };

interface Props {
  problemStats: ProblemStat[];
  playerLearningTier?: number;
}

const COLS     = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ROWS     = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const EXT_ROWS = [11, 12, 15, 20, 25];
const EXT_COLS = [2, 3, 4, 5, 6, 7, 8, 9];
const CELL     = 34;

/** Green (easy) → yellow → red (hard), weight range 0.2–2.0 */
function weightBg(w: number): string {
  const t = Math.min(1, Math.max(0, (w - 0.2) / 1.8));
  const hue = Math.round(120 - 120 * t);   // 120° green → 0° red
  return `hsl(${hue}, 65%, 32%)`;
}

export default function ScoringGuide({ problemStats, playerLearningTier = 0 }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const stat = (a: number, b: number) => problemStats.find(s => s.a === a && s.b === b);
  const w    = (a: number, b: number) => stat(a, b)?.difficultyWeight ?? 0;
  // ≥200 answers → fully community-calibrated (bright border in grid)
  const cal  = (a: number, b: number) => (stat(a, b)?.attemptCount ?? 0) >= 200;

  function Cell({ a, b }: { a: number; b: number }) {
    const wt = w(a, b);
    const isCalibrated = cal(a, b);
    return (
      <td
        title={`${a}×${b}=${a * b}  ${wt.toFixed(2)} pts${isCalibrated ? '  ✓ calibrated' : ''}`}
        style={{
          width: CELL, height: CELL, textAlign: 'center',
          background: weightBg(wt), color: '#fff',
          borderRadius: 4, fontWeight: 700, cursor: 'default',
          fontSize: 11, lineHeight: `${CELL}px`,
          outline: isCalibrated ? '1.5px solid rgba(255,255,255,0.35)' : 'none',
        }}
      >
        {wt.toFixed(1)}
      </td>
    );
  }

  const HeaderTh = ({ n }: { n: number }) => (
    <th style={{ width: CELL, textAlign: 'center', fontWeight: 700, color: 'var(--muted)', paddingBottom: 4, fontSize: 11 }}>{n}</th>
  );

  const RowTh = ({ n }: { n: number }) => (
    <td style={{ textAlign: 'right', paddingRight: 6, fontWeight: 700, color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{n}</td>
  );

  return (
    <div id="scoring-guide" className="card">
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text)', padding: 0, textAlign: 'left',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700 }}>📊 {t('scoring.title')}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Formula */}
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
            <b style={{ color: 'var(--text)' }}>{t('scoring.howTitle')}</b><br />
            {t('scoring.howBody')}<br />
            <code style={{
              fontSize: 11, background: 'var(--card2)', padding: '3px 8px',
              borderRadius: 4, marginTop: 4, display: 'inline-block',
              color: 'var(--accent)', letterSpacing: 0,
            }}>
              w = 0.2 + 1.8 × error_rate + 0.5 × (avg_ms / 10 000)
            </code>
            <br />
            <span style={{ fontSize: 11 }}>{t('scoring.calibNote')}</span>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([
              [0.35, `${t('sprint.tagEasy')} < 0.8`],
              [1.0,  `${t('sprint.tagMedium')} 0.8–1.4`],
              [1.75, `${t('sprint.tagHard')} ≥ 1.5`],
            ] as [number, string][]).map(([wt, label]) => (
              <span key={label} style={{
                background: weightBg(wt), color: '#fff',
                padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              }}>
                {label}
              </span>
            ))}
          </div>

          {/* 10 × 10 grid */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ width: 20, color: 'var(--muted)', textAlign: 'right', paddingRight: 6, fontSize: 11 }}>×</th>
                  {COLS.map(b => <HeaderTh key={b} n={b} />)}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(a => (
                  <tr key={a}>
                    <RowTh n={a} />
                    {COLS.map(b => <Cell key={b} a={a} b={b} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Extended table (tier 3) */}
          {playerLearningTier >= 3 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                {t('unlock.tier1GridTitle')}
              </div>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 28, color: 'var(--muted)', textAlign: 'right', paddingRight: 6, fontSize: 11 }}>×</th>
                      {EXT_COLS.map(b => <HeaderTh key={b} n={b} />)}
                    </tr>
                  </thead>
                  <tbody>
                    {EXT_ROWS.map(a => (
                      <tr key={a}>
                        <RowTh n={a} />
                        {EXT_COLS.map(b => <Cell key={b} a={a} b={b} />)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: -4 }}>
            {t('scoring.calibLegend')}
          </p>
        </div>
      )}
    </div>
  );
}

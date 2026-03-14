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

/** Same bonus applied in end_session on the server. */
function digitBonus(a: number, b: number): number {
  if (Math.max(a, b) >= 11) return a * b >= 100 ? 1.0 : 0.5;
  return 0;
}

/** Green (easy) → yellow → red (hard), weight range 0.2–3.0 */
function weightBg(w: number): string {
  const t = Math.min(1, Math.max(0, (w - 0.2) / 2.8));
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
    const base = w(a, b);
    const bonus = digitBonus(a, b);
    const effective = base + bonus;
    const isCalibrated = cal(a, b);
    const title = bonus > 0
      ? `${a}×${b}=${a * b}  ${effective.toFixed(2)} pts  (base ${base.toFixed(2)} + ${bonus.toFixed(1)} bonus)${isCalibrated ? '  ✓ calibrated' : ''}`
      : `${a}×${b}=${a * b}  ${effective.toFixed(2)} pts${isCalibrated ? '  ✓ calibrated' : ''}`;
    return (
      <td
        title={title}
        style={{
          width: CELL, height: CELL, textAlign: 'center',
          background: weightBg(effective), color: '#fff',
          borderRadius: 4, fontWeight: 700, cursor: 'default',
          fontSize: 11, lineHeight: `${CELL}px`,
          outline: isCalibrated ? '1.5px solid rgba(255,255,255,0.35)' : 'none',
        }}
      >
        {effective.toFixed(1)}
      </td>
    );
  }

  const HeaderTh = ({ n }: { n: number }) => (
    <th className="tbl-th fw-bold text-xs" style={{ width: CELL, paddingBottom: 4 }}>{n}</th>
  );

  const RowTh = ({ n }: { n: number }) => (
    <td className="tbl-td--right fw-bold text-muted text-xs" style={{ paddingRight: 6, whiteSpace: 'nowrap' }}>{n}</td>
  );

  return (
    <div id="scoring-guide" className="card">
      <button
        onClick={() => setOpen(o => !o)}
        className="row-between w-full"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text)', padding: 0, textAlign: 'left',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span className="fw-bold" style={{ fontSize: 15 }}>📊 {t('scoring.title')}</span>
        <span className="text-xs text-muted">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="col gap-16 mt-4">

          {/* Formula */}
          <div className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
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
            <span className="text-xs">{t('scoring.calibNote')}</span>
            <br />
            <span className="text-xs text-accent fw-semibold">
              ＋ {t('scoring.digitBonus')}
            </span>
          </div>

          {/* Legend */}
          <div className="row-wrap gap-8">
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
          <div className="scroll-x">
            <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11 }}>
              <thead>
                <tr>
                  <th className="text-muted tbl-td--right text-xs" style={{ width: 20, paddingRight: 6 }}>×</th>
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
              <div className="text-sm fw-bold text-accent">
                {t('unlock.tier1GridTitle')}
              </div>
              <div className="scroll-x">
                <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th className="text-muted tbl-td--right text-xs" style={{ width: 28, paddingRight: 6 }}>×</th>
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

          <p className="text-xs text-muted" style={{ marginTop: -4 }}>
            {t('scoring.calibLegend')}
          </p>
        </div>
      )}
    </div>
  );
}

import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';

type ProblemStat = { a: number; b: number; difficultyWeight: number; attemptCount: number };

interface Props {
  problemStats: ProblemStat[];
  playerLearningTier?: number;
}

const COLS     = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ROWS     = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const EXT_ROWS = [11, 12, 15, 20, 25];
const EXT_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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
      <div
        className="mastery-cell"
        title={title}
        style={{
          background: weightBg(effective),
          color: '#fff',
          fontWeight: 700,
          fontSize: 11,
          border: isCalibrated ? '1.5px solid rgba(255,255,255,0.45)' : '1px solid rgba(0,0,0,0.12)',
          cursor: 'default',
        }}
      >
        {effective.toFixed(1)}
      </div>
    );
  }

  const HeaderDiv = ({ n }: { n: number }) => (
    <div className="mastery-cell mastery-cell--label text-xs fw-bold text-muted">{n}</div>
  );

  const RowDiv = ({ n }: { n: number }) => (
    <div className="mastery-cell mastery-cell--label text-xs fw-bold text-muted"
      style={{ justifyContent: 'flex-end', paddingRight: 4 }}>{n}</div>
  );

  const GRID_TPL = `28px repeat(${COLS.length}, ${CELL}px)`;

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
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID_TPL, gap: 3 }}>
              <div className="mastery-cell mastery-cell--label text-xs fw-bold text-muted">×</div>
              {COLS.map(b => <HeaderDiv key={b} n={b} />)}
              {ROWS.map(a => (
                <Fragment key={a}>
                  <RowDiv n={a} />
                  {COLS.map(b => <Cell key={b} a={a} b={b} />)}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Extended table (tier 3) */}
          {playerLearningTier >= 3 && (
            <>
              <div className="text-sm fw-bold text-accent">
                {t('unlock.tier1GridTitle')}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: GRID_TPL, gap: 3 }}>
                  <div className="mastery-cell mastery-cell--label text-xs fw-bold text-muted">×</div>
                  {EXT_COLS.map(b => <HeaderDiv key={b} n={b} />)}
                  {EXT_ROWS.map(a => (
                    <Fragment key={a}>
                      <RowDiv n={a} />
                      {EXT_COLS.map(b => <Cell key={b} a={a} b={b} />)}
                    </Fragment>
                  ))}
                </div>
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

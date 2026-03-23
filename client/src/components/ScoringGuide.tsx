import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProblemStat } from '../module_bindings/types.js';



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
        className="flex h-[34px] w-full min-w-[34px] items-center justify-center rounded-md text-[11px] font-bold text-white shadow-sm transition-transform hover:scale-[1.1] hover:-translate-y-0.5 hover:shadow-lg hover:z-10 relative cursor-default tabular-nums"
        title={title}
        style={{
          background: weightBg(effective),
          border: isCalibrated ? '2px solid rgba(255,255,255,0.5)' : '1px solid rgba(0,0,0,0.05)',
        }}
      >
        {effective.toFixed(1)}
      </div>
    );
  }

  const HeaderDiv = ({ n }: { n: number }) => (
    <div className="flex h-[34px] w-full min-w-[34px] items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-100 dark:border-slate-800 tabular-nums">{n}</div>
  );

  const RowDiv = ({ n }: { n: number }) => (
    <div className="flex h-[34px] w-full min-w-[34px] items-center justify-end pr-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-100 dark:border-slate-800 tabular-nums">{n}</div>
  );

  const GRID_TPL = `28px repeat(${COLS.length}, ${CELL}px)`;

  return (
    <div id="scoring-guide" className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 transition-colors">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between text-left transition-opacity hover:opacity-80 active:opacity-60"
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">📊 {t('scoring.title')}</h2>
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700/50 rounded-full w-6 h-6 flex items-center justify-center transition-transform">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="mt-6 flex flex-col gap-5 pt-5 border-t border-slate-100 dark:border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-300">

          {/* Formula */}
          <div className="text-sm text-slate-600 dark:text-slate-400 leading-[1.7]">
            <b className="text-slate-900 dark:text-slate-200">{t('scoring.howTitle')}</b><br />
            {t('scoring.howBody')}<br />
            <code className="mt-1.5 inline-block rounded-md bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1 text-[11px] font-mono text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-800">
              w = 0.2 + 1.8 × error_rate + 0.5 × (avg_ms / 10 000)
            </code>
            <br />
            <span className="text-xs opacity-80 mt-1 block">{t('scoring.calibNote')}</span>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-3 py-1.5 border border-amber-400/20">
              <span className="text-xs font-bold text-amber-500 uppercase tracking-widest text-[10px]">
                ＋ {t('scoring.digitBonus')}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2.5">
            {([
              [0.35, `${t('sprint.tagEasy')} < 0.8`],
              [1.0,  `${t('sprint.tagMedium')} 0.8–1.4`],
              [1.75, `${t('sprint.tagHard')} ≥ 1.5`],
            ] as [number, string][]).map(([wt, label]) => (
              <span key={label} className="rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-sm" style={{ background: weightBg(wt) }}>
                {label}
              </span>
            ))}
          </div>

          {/* 10 × 10 grid */}
          <div className="overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0">
            <div style={{ display: 'grid', gridTemplateColumns: GRID_TPL, gap: 3, width: 'max-content' }}>
              <div className="flex h-[34px] w-full min-w-[34px] items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-100 dark:border-slate-800">×</div>
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
              <div className="mt-2 text-sm font-bold text-amber-500">
                {t('unlock.tier1GridTitle')}
              </div>
              <div className="overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0">
                <div style={{ display: 'grid', gridTemplateColumns: GRID_TPL, gap: 3, width: 'max-content' }}>
                  <div className="flex h-[34px] w-full min-w-[34px] items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-100 dark:border-slate-800">×</div>
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

          <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500 text-center bg-slate-50 dark:bg-slate-900/30 py-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/50 px-4">
            {t('scoring.calibLegend')}
          </p>
        </div>
      )}
    </div>
  );
}

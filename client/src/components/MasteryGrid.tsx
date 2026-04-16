import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { getRechenweg } from '../utils/rechenwege.js';
import { learningTierOf } from '../utils/learningTier.js';
import { tagKCs } from '../utils/kcProficiency.js';

import type { Answer, ProblemStat } from '../module_bindings/types.js';

interface Props {
  answers: Answer[];
  problemStats: ProblemStat[];
  highlightSession?: bigint;
  sessionAnswers?: Answer[];
  showExtended?: boolean;
  focusCell?: { a: number; b: number } | null;
  playerLearningTier?: number;
  activeMissionKc?: number;
}

type Mastery = 'mastered' | 'learning' | 'struggling' | 'untouched';

export function getSessionMastery(ans: Answer | undefined): Mastery | null {
  if (!ans) return null;
  if (!ans.isCorrect) return 'struggling';

  const attempts = Math.max(1, ans.attempts ?? 1);
  const timeSecs = (ans.responseMs ?? 0) / 1000;

  if (attempts >= 3 || timeSecs > 15) return 'struggling';
  if (attempts === 2 || timeSecs > 6) return 'learning';
  return 'mastered';
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


export default function MasteryGrid({ answers, problemStats, highlightSession: _highlightSession, sessionAnswers = [], showExtended = false, focusCell, playerLearningTier, activeMissionKc }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<{ a: number; b: number } | null>(focusCell || null);
  const [lastFocusCell, setLastFocusCell] = useState(focusCell);

  if (focusCell?.a !== lastFocusCell?.a || focusCell?.b !== lastFocusCell?.b) {
    setLastFocusCell(focusCell);
    setSelected(focusCell || null);
  }

  const sessionKeys = new Set(sessionAnswers.map(a => a.a * 100 + a.b));

  let gridSize = 10;
  if (showExtended && playerLearningTier !== undefined) {
    if (playerLearningTier >= 8) gridSize = 12; // unlocks 11 and 12
    if (playerLearningTier >= 9) gridSize = 13;
    if (playerLearningTier >= 10) gridSize = 14;
    if (playerLearningTier >= 11) gridSize = 15;
    if (playerLearningTier >= 12) gridSize = 16;
    if (playerLearningTier >= 13) gridSize = 17;
    if (playerLearningTier >= 14) gridSize = 18;
    if (playerLearningTier >= 15) gridSize = 19;
    if (playerLearningTier >= 16) gridSize = 20;
  }
  const cellSize = gridSize > 12 ? '26px' : '34px';

  const cells: React.ReactNode[] = [];
  // Header row: b labels
  cells.push(<div key="h0" style={{ width: cellSize, height: cellSize }} className="flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500">×</div>);
  for (let b = 1; b <= gridSize; b++) {
    cells.push(
      <div key={`hb${b}`} style={{ width: cellSize, height: cellSize }} className="flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500">
        {b}
      </div>
    );
  }

  const renderCell = (a: number, b: number) => {
    let mastery: Mastery = 'untouched';
    
    if (answers && answers.length > 0) {
      const pairAns = answers.filter(ans => (ans.a === a && ans.b === b) || (ans.a === b && ans.b === a));
      if (pairAns.length > 0) {
        const override = getSessionMastery(pairAns[pairAns.length - 1]);
        if (override) mastery = override;
      }
    }

    const key = a * 100 + b;
    const isHighlighted = sessionKeys.has(key);
    const isSelected = selected?.a === a && selected?.b === b;
    
    if (isHighlighted) {
      const lastSessionAns = sessionAnswers.filter(ans => ans.a === a && ans.b === b).pop();
      const override = getSessionMastery(lastSessionAns);
      if (override) mastery = override;
    }

    const stat = problemStats.find(s => s.problemKey === key);
    const w = stat?.difficultyWeight ?? 0;
    const answer = a * b;
    const isLocked = playerLearningTier !== undefined && learningTierOf(a, b) > playerLearningTier;
    
    // Check if this cell is part of the player's active mission focus
    const isMission = activeMissionKc !== undefined && tagKCs(a, b).includes(activeMissionKc);

    cells.push(
      <button
        key={`${a}-${b}`}
        className={`rounded-[6px] flex items-center justify-center transition-all relative ${
          isLocked 
            ? 'cursor-default opacity-20 filter grayscale blur-[0.5px] pointer-events-none' 
            : 'cursor-pointer hover:scale-[1.05] active:scale-95 shadow-sm'
        } ${!isLocked && isMission ? 'ring-2 ring-brand-yellow/60 animate-[pulse_2s_ease-in-out_infinite] z-20' : ''}`}
        title={t('mastery.tooltip', { a, b, answer, difficulty: w.toFixed(2) })}
        onClick={() => !isLocked && setSelected(isSelected ? null : { a, b })}
        style={{
          width: cellSize,
          height: cellSize,
          background: isSelected ? MASTERY_COLORS[mastery] + '33' : MASTERY_BG[mastery],
          border: isSelected
            ? `2px solid ${MASTERY_COLORS[mastery]}`
            : isHighlighted
            ? '2px solid #facc15'
            : `1px solid ${MASTERY_COLORS[mastery]}44`,
          color: MASTERY_COLORS[mastery],
          fontWeight: 600,
          fontSize: gridSize > 12 ? 11 : 13,
          zIndex: isHighlighted || isSelected ? 10 : 1,
          boxShadow: isHighlighted ? '0 0 10px rgba(250,204,21,0.3)' : 'none',
        }}
      >
        {a === b ? <span style={{ opacity: 0.7 }}>{answer}</span> : answer}
        {/* Difficulty dot */}
        {w >= 1.5 && (
          <span className="absolute top-[2px] right-[3px] w-1 h-1 rounded-full bg-red-500 block" />
        )}
      </button>
    );
  };

  for (let a = 1; a <= gridSize; a++) {
    // Row label
    cells.push(
      <div key={`ha${a}`} style={{ width: cellSize, height: cellSize }} className="flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500">
        {a}
      </div>
    );
    for (let b = 1; b <= gridSize; b++) {
      renderCell(a, b);
    }
  }



  const rw = selected ? getRechenweg(selected.a, selected.b) : null;

  return (
    <div className="flex flex-col w-full relative">
      <div className="overflow-x-auto pb-2 self-center lg:self-start">
        <div style={{
          display: 'grid',
          gridTemplateColumns: `28px repeat(${gridSize}, ${cellSize})`,
          gap: 3,
        }}>
          {cells}
        </div>
      </div>

      {/* Rechenweg panel */}
      {selected && rw && (
        <div className="mt-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 transition-all animate-in fade-in slide-in-from-top-2 max-w-[390px]">
          <div className="flex items-center justify-between gap-4 mb-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="font-black tabular-nums text-lg text-slate-800 dark:text-white">
              {selected.a} × {selected.b} = {selected.a * selected.b}
            </span>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap">
              {t(rw.strategyKey as ParseKeys)}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {rw.steps.map((step, i) => (
              <div key={i} className={`tabular-nums text-[15px] ${i === rw.steps.length - 1 ? 'font-black text-brand-yellow' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
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
              <div className="border-t border-slate-200 dark:border-slate-800 mt-4 pt-4">
                <div className="text-[11px] text-slate-500 font-bold mb-3 uppercase tracking-wider">
                  {t('mastery.correctOfLast', { correct, recent: recent.length, all: pair.length, defaultValue: `${correct}/${recent.length} CORRECT (LAST ${recent.length} OF ${pair.length})` })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((ans, i) => {
                    const m = getSessionMastery(ans);
                    let colorClass = '';
                    let icon = '✗';
                    if (m === 'mastered') { colorClass = 'bg-green-500/10 border border-green-500/20 text-green-500 dark:bg-green-500/5 dark:text-green-400'; icon = '✓'; }
                    else if (m === 'learning') { colorClass = 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400'; icon = '✓'; }
                    else { colorClass = 'bg-red-500/10 border border-red-500/20 text-red-500 dark:bg-red-500/5 dark:text-red-400'; icon = ans.isCorrect ? '✓' : '✗'; }
                    
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-sm font-black transition-colors ${colorClass}`}>
                          {icon}
                        </div>
                        {!ans.isCorrect && ans.userAnswer !== undefined && (
                          <div className="text-[10px] font-black text-red-500 dark:text-red-400">
                            {ans.userAnswer}
                          </div>
                        )}
                        {ans.responseMs !== undefined && (
                          <div className={`text-[10px] font-bold ${m === 'mastered' ? 'text-slate-400' : m === 'learning' ? 'text-yellow-600 dark:text-yellow-500' : 'text-red-500 dark:text-red-400'}`}>
                            {(ans.responseMs / 1000).toFixed(1)}s
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tighter Native Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60 max-w-[390px] lg:max-w-none">
        {(['mastered', 'learning', 'struggling', 'untouched'] as Mastery[]).map(m => (
          <div key={m} className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-[4px]" style={{
              background: MASTERY_BG[m],
              border: `1px solid ${MASTERY_COLORS[m]}`,
            }} />
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">{t(`mastery.${m}` as const)}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-500" />
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">{t('mastery.hardDiff')}</span>
        </div>
      </div>
    </div>
  );
}

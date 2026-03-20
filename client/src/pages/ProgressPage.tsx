import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Answer, ProblemStat, Session } from '../module_bindings/types.js';
import MasteryGrid from '../components/MasteryGrid.js';
import SprintHistory from '../components/SprintHistory.js';
import TierLadder from '../components/TierLadder.js';

interface Props {
  myIdentityHex: string;
  playerLearningTier?: number;
  extendedMode?: boolean;
  extendedLevel?: number;
}

const TIER_EMOJI = ['🌱', '🔨', '⚡', '🎯', '🔥', '💫', '🌟', '🏆'] as const;

const ProgressIcon = ({ className }: { className?: string }) => (
  <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="6"  y="68" width="26" height="26" rx="6" fill="#E8391D" />
    <rect x="37" y="37" width="26" height="57" rx="6" fill="#FBBA00" />
    <rect x="68" y="6"  width="26" height="88" rx="6" fill="#5DD23C" />
  </svg>
);

export default function ProgressPage({ myIdentityHex, playerLearningTier = 0, extendedMode = false, extendedLevel = 0 }: Props) {
  const { t } = useTranslation();
  const [sessions]     = useTable(tables.sessions);
  const [answers]      = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);
  const setLearningTier   = useSTDBReducer(reducers.setLearningTier);
  const setExtendedMode   = useSTDBReducer(reducers.setExtendedMode);

  const [adjusting, setAdjusting]         = useState(false);
  const [pendingTier, setPendingTier]     = useState(playerLearningTier);
  const [saving, setSaving]               = useState(false);
  const [extendedSaving, setExtendedSaving] = useState(false);

  const handleToggleExtended = async (enabled: boolean) => {
    setExtendedSaving(true);
    await setExtendedMode({ enabled });
    setExtendedSaving(false);
  };

  const myAnswers = (answers as unknown as Answer[]).filter(
    a => a.playerIdentity.toHexString() === myIdentityHex
  );

  const isMaxTier = playerLearningTier >= 7;

  const handleSetTier = async () => {
    if (saving || pendingTier === playerLearningTier) { setAdjusting(false); return; }
    setSaving(true);
    await setLearningTier({ tier: pendingTier });
    setSaving(false);
    setAdjusting(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 md:p-6 pb-[100px] sm:pb-[140px] animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-4 mb-2 flex items-center gap-3">
        <div className="flex xl:h-[42px] xl:w-[42px] shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 shadow-sm">
          <ProgressIcon className="drop-shadow-sm scale-110" />
        </div>
        {t('nav.progress')}
      </h1>
      
      {/* My Level card — unified summary + edit */}
      <div
        id="my-level"
        className={`bg-white dark:bg-slate-800 rounded-[28px] p-6 sm:p-8 flex flex-col gap-8 shadow-sm transition-all relative overflow-hidden ${
          isMaxTier 
            ? 'border-2 border-brand-yellow/50 dark:border-brand-yellow/30 shadow-[0_0_40px_-10px_rgba(250,204,21,0.15)]' 
            : 'border border-slate-200 dark:border-slate-700'
        }`}
      >
        {isMaxTier && (
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-yellow/5 rounded-full blur-2xl pointer-events-none" />
        )}

        {/* Header row: summary info */}
        <div className="flex flex-wrap items-center gap-6 relative z-10">
          <div className="text-5xl leading-none drop-shadow-sm flex-shrink-0">
            {TIER_EMOJI[Math.min(playerLearningTier, 7)]}
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <div className={`flex flex-wrap items-center gap-3 font-bold text-lg ${isMaxTier ? 'text-brand-yellow dark:text-brand-yellow/90' : 'text-slate-800 dark:text-slate-100'}`}>
              <span>{t(`tiers.tier${playerLearningTier}Name` as ParseKeys)}</span>
              {extendedMode && extendedLevel > 0 && (
                <span className="text-sm font-black text-brand-yellow bg-brand-yellow/10 dark:bg-brand-yellow/5 px-2 py-0.5 rounded-md">
                  +{extendedLevel}
                </span>
              )}
              <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700/50">
                {t('tiers.statusLevel', { tier: playerLearningTier + 1 })}
              </span>
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {isMaxTier
                ? t('tiers.allUnlocked')
                : t(`tiers.nextUnlock${playerLearningTier}` as ParseKeys)}
            </div>
          </div>
        </div>

        {/* Tier ladder — always visible */}
        {adjusting ? (
          <div className="flex flex-col gap-5 pt-4 border-t border-slate-200 dark:border-slate-700/50 relative z-10 animate-in slide-in-from-top-2">
            <TierLadder
              currentTier={playerLearningTier}
              selectedTier={pendingTier}
              onSelect={setPendingTier}
            />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('tierPicker.adjustBody')}
            </p>
            <div className="flex gap-4 mt-2">
              <button
                onClick={() => setAdjusting(false)}
                className="flex-1 py-3.5 px-6 rounded-2xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all text-sm uppercase tracking-wider"
              >
                {t('onboarding.back')}
              </button>
              <button
                onClick={handleSetTier}
                disabled={saving}
                className="flex-1 py-3.5 px-6 rounded-2xl font-black text-slate-900 bg-brand-yellow hover:scale-[1.02] active:scale-95 transition-all shadow-sm text-sm uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? '…' : t('tierPicker.setLevel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 pt-4 border-t border-slate-200 dark:border-slate-700/50 relative z-10">
            <TierLadder currentTier={playerLearningTier} />
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <button
                onClick={() => { setPendingTier(playerLearningTier); setAdjusting(true); }}
                className="py-2.5 px-5 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-sm flex items-center gap-2 border border-transparent dark:border-slate-600/50"
              >
                <span className="opacity-70">✏️</span> {t('tierPicker.changeLevel')}
              </button>
            </div>
          </div>
        )}

        {/* Extended-mode toggle — only when isMaxTier */}
        {isMaxTier && (
          <div className="pt-6 border-t border-slate-200 dark:border-slate-700/50 flex flex-wrap items-center gap-4 relative z-10">
            <label
              htmlFor="extended-toggle"
              className={`flex-1 flex flex-wrap items-center gap-4 min-w-0 transition-opacity ${extendedSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="font-bold text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">
                {t('extendedTables.toggle')}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {[11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(n => (
                  <span
                    key={n}
                    className="text-[11px] font-black text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-[8px] px-2 py-0.5"
                  >
                    ×{n}
                  </span>
                ))}
              </span>
            </label>

            {/* Pill switch */}
            <label
              htmlFor="extended-toggle"
              className={`relative inline-block w-12 h-6 flex-shrink-0 transition-opacity ${extendedSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                id="extended-toggle"
                type="checkbox"
                className="sr-only"
                checked={extendedMode}
                disabled={extendedSaving}
                onChange={e => handleToggleExtended(e.target.checked)}
              />
              <span
                className={`absolute inset-0 rounded-full transition-colors duration-200 ${
                  extendedMode 
                    ? 'bg-brand-yellow border-brand-yellow shadow-[0_0_15px_-3px_rgba(250,204,21,0.5)]' 
                    : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                } border`}
              />
              <span
                className={`absolute top-[2px] left-[2px] w-5 h-5 rounded-full transition-all duration-200 shadow-sm ${
                  extendedMode 
                    ? 'translate-x-6 bg-slate-900' 
                    : 'translate-x-0 bg-white dark:bg-slate-400'
                }`}
              />
            </label>
          </div>
        )}
      </div>

      <div id="mastery" className="bg-white dark:bg-slate-800 rounded-[28px] p-6 sm:p-8 flex flex-col shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">{t('lobby.masteryTitle')}</h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8 leading-relaxed max-w-2xl">
          {t('lobby.masteryDesc')}
        </p>
        <div className="overflow-x-auto -mx-2 px-2 pb-4">
          <MasteryGrid
            answers={myAnswers}
            problemStats={problemStats as unknown as ProblemStat[]}
            showExtended={isMaxTier && extendedMode}
            playerLearningTier={playerLearningTier}
          />
        </div>
      </div>

      <div id="history" className="bg-white dark:bg-slate-800 rounded-[28px] p-6 sm:p-8 flex flex-col shadow-sm border border-slate-200 dark:border-slate-700">
        <SprintHistory
          sessions={sessions as unknown as Session[]}
          answers={answers as unknown as Answer[]}
          myIdentityHex={myIdentityHex}
        />
      </div>
    </div>
  );
}

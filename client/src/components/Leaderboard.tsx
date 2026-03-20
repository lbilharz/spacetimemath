import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';

type BestScore = {
  playerIdentity: { toHexString(): string };
  username: string;
  bestWeightedScore: number;
  bestAccuracyPct: number;
  bestTotalAnswered: number;
  learningTier: number;
};

const TIER_EMOJI = ['🌱', '🔨', '⚡', '🎯', '🔥', '💫', '🌟', '🏆'];

interface Props {
  bestScores: BestScore[];
  myIdentityHex: string | undefined;
  myLearningTier?: number;
}

export default function Leaderboard({ bestScores, myIdentityHex, myLearningTier: _myLearningTier = 0 }: Props) {
  const { t } = useTranslation();
  // -1 means "All tiers"
  const [tierFilter, setTierFilter] = useState<number>(-1);

  const filtered = tierFilter === -1
    ? bestScores
    : bestScores.filter(s => s.learningTier === tierFilter);

  const sorted = [...filtered].sort((a, b) => b.bestWeightedScore - a.bestWeightedScore);
  const rows = sorted.slice(0, 10);

  // Find the current player's rank in the full sorted list
  const myRankIndex = sorted.findIndex(s => s.playerIdentity.toHexString() === myIdentityHex);
  const myRow = myRankIndex >= 10 ? sorted[myRankIndex] : null; // null if already in top 10

  const medals = ['🥇', '🥈', '🥉'];

  // Gather which tiers actually exist in the data (for showing tabs)
  const tiersPresent = Array.from(new Set(bestScores.map(s => s.learningTier))).sort();

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 transition-colors">
      <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">🏆 {t('leaderboard.title')}</h2>

      {/* Tier filter tabs */}
      {tiersPresent.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setTierFilter(-1)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${tierFilter === -1 ? 'bg-brand-yellow text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:hover:bg-slate-700'}`}
          >
            {t('leaderboard.tierAll')}
          </button>
          {tiersPresent.map(tier => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${tierFilter === tier ? 'bg-brand-yellow text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:hover:bg-slate-700'}`}
            >
              <span>{TIER_EMOJI[Math.min(tier, 7)]}</span>
              <span>{t(`tiers.tier${tier}Name` as ParseKeys)}</span>
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 italic py-4 text-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          {t('leaderboard.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-2 py-3 text-center font-bold w-10">{t('leaderboard.colHash')}</th>
                <th className="px-2 py-3 text-left font-bold">{t('leaderboard.colPlayer')}</th>
                <th className="px-2 py-3 text-right font-bold">{t('leaderboard.colScore')}</th>
                <th className="px-2 py-3 text-right font-bold">{t('leaderboard.colAccuracy')}</th>
                <th className="px-2 py-3 text-right font-bold">{t('leaderboard.colAnswers')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => {
                const isMe = s.playerIdentity.toHexString() === myIdentityHex;
                return (
                  <tr
                    key={s.playerIdentity.toHexString()}
                    className={`border-b border-slate-100 dark:border-slate-700/50 ${isMe ? 'bg-amber-400/5' : 'bg-transparent'}`}
                  >
                    <td className={`px-2 py-3 text-center text-sm font-bold tabular-nums ${i < 3 ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>
                      {i < 3 ? medals[i] : i + 1}
                    </td>
                    <td className={`px-2 py-3 text-sm flex items-center ${isMe ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                      <span>{s.username}</span>
                      {tierFilter === -1 && (
                        <span className="ml-2 text-[11px]" title={t(`tiers.tier${s.learningTier}Name` as ParseKeys)}>
                          {TIER_EMOJI[Math.min(s.learningTier, 7)]}
                        </span>
                      )}
                      {isMe && <span className="ml-2 text-xs font-bold text-brand-yellow tracking-tight">{t('leaderboard.you')}</span>}
                    </td>
                    <td className="px-2 py-3 text-right text-sm font-bold tabular-nums text-amber-500">
                      {s.bestWeightedScore.toFixed(1)}
                    </td>
                    <td className="px-2 py-3 text-right text-sm font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                      {s.bestAccuracyPct}%
                    </td>
                    <td className="px-2 py-3 text-right text-sm font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                      {s.bestTotalAnswered}
                    </td>
                  </tr>
                );
              })}
              {myRow && (
                <>
                  <tr>
                    <td colSpan={5} className="py-2 text-center text-xs tracking-[4px] text-slate-400 dark:text-slate-500">
                      ···
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700 bg-amber-400/5">
                    <td className="px-2 py-3 text-center text-sm font-bold text-slate-400 dark:text-slate-500">
                      {myRankIndex + 1}
                    </td>
                    <td className="px-2 py-3 text-sm font-bold text-slate-900 dark:text-white flex items-center">
                      <span>{myRow?.username}</span>
                      {tierFilter === -1 && (
                        <span className="ml-2 text-[11px]">{TIER_EMOJI[Math.min(myRow?.learningTier ?? 0, 7)]}</span>
                      )}
                      <span className="ml-2 text-xs font-bold text-brand-yellow tracking-tight">{t('leaderboard.you')}</span>
                    </td>
                    <td className="px-2 py-3 text-right text-sm font-bold tabular-nums text-amber-500">
                      {myRow?.bestWeightedScore.toFixed(1)}
                    </td>
                    <td className="px-2 py-3 text-right text-sm font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                      {myRow?.bestAccuracyPct}%
                    </td>
                    <td className="px-2 py-3 text-right text-sm font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                      {myRow?.bestTotalAnswered}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs font-medium text-slate-400 dark:text-slate-500 text-center">
        {t('leaderboard.footer')}
      </p>
    </div>
  );
}

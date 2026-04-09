import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useMemo } from 'react';
import { calculateWeightedXp, calculatePlayerXp, getRankForXp, getNextRank } from '../utils/xp.js';
import type { Answer, ProblemStat } from '../module_bindings/types.js';

interface Props {
  totalCorrect: number;
  answers?: Answer[];
  problemStats?: ProblemStat[];
  playerLevel?: number;
}

export default function TrophyRoad({ totalCorrect, answers, problemStats, playerLevel }: Props) {
  const { t } = useTranslation();

  const xp = useMemo(() => {
    if (answers && problemStats && problemStats.length > 0) {
      return calculateWeightedXp(answers, problemStats);
    }
    return calculatePlayerXp(totalCorrect);
  }, [totalCorrect, answers, problemStats]);

  const currentRank = useMemo(() => getRankForXp(xp), [xp]);
  const nextRank = useMemo(() => getNextRank(currentRank.id), [currentRank.id]);

  // Calculate percentage progress toward next rank
  let percentage = 100;
  let xpIntoRank = xp;
  let totalXpForRank = 100;

  if (nextRank) {
    xpIntoRank = xp - currentRank.minXp;
    totalXpForRank = nextRank.minXp - currentRank.minXp;
    percentage = Math.max(0, Math.min(100, (xpIntoRank / totalXpForRank) * 100));
  }

  return (
    <div className="flex flex-col gap-2 w-full pt-2">
      {/* Top Text Row */}
      <div className="flex justify-between items-end px-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl drop-shadow-sm transition-transform hover:scale-110">{currentRank.icon}</span>
          <div className="flex flex-col">
            <span className={`text-[15px] font-black uppercase tracking-widest ${currentRank.color}`}>
              {t(currentRank.nameKey as ParseKeys)}
            </span>
            {playerLevel !== undefined && (
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {t('trophyRoad.levelAndRank' as ParseKeys, { level: playerLevel })}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <span className="text-[17px] font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
            {xp.toLocaleString()} <span className="text-xs font-bold text-slate-400">XP</span>
          </span>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/60 shadow-inner">
        {/* Fill */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out bg-brand-yellow"
          style={{ width: `${percentage}%` }}
        />
        {/* Subtle Shine Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent pointer-events-none rounded-full" />
      </div>

      {/* Bottom Text Row */}
      <div className="flex justify-between px-1 mt-0.5">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {xpIntoRank.toLocaleString()} / {totalXpForRank.toLocaleString()}
        </span>
        {nextRank ? (
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {t('trophyRoad.nextRank', { rank: t(nextRank.nameKey as ParseKeys) })} {nextRank.icon}
          </span>
        ) : (
          <span className="text-[10px] font-bold text-brand-yellow uppercase tracking-wider">
            {t('trophyRoad.maxRank')}
          </span>
        )}
      </div>

      {/* Next unlock hint + XP explainer */}
      {nextRank?.unlockKey && (
        <div className="flex items-center gap-2 px-1 mt-1">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
            {t('trophyRoad.unlocks' as ParseKeys, { rank: t(nextRank.nameKey as ParseKeys), feature: t(nextRank.unlockKey as ParseKeys) })}
          </span>
        </div>
      )}
      <div className="px-1">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
          {t('trophyRoad.xpExplainer' as ParseKeys)}
        </span>
      </div>
    </div>
  );
}

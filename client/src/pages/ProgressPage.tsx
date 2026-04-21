import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Answer, ProblemStat, Session, PlayerDktWeights } from '../module_bindings/types.js';
import MasteryGrid from '../components/MasteryGrid.js';
import SprintHistory from '../components/SprintHistory.js';
import TierLadder from '../components/TierLadder.js';
import PageContainer from '../components/PageContainer.js';
import { PlayIcon, ProgressIcon, TestLevelIcon, Swosh } from '../components/Icons.js';
import { computeProficiency, relevantKCsForTier, KC_TRIVIAL, tagKCs } from '../utils/kcProficiency.js';
import type { KcProficiency } from '../utils/kcProficiency.js';

interface Props {
  myIdentityHex: string;
  playerLearningTier?: number;
  extendedMode?: boolean;
  onRetakeDiagnostic: () => void;
  onStartSprint: (sessionId: bigint) => void;
}

import { TIER_EMOJI } from '../utils/learningTier.js';

export default function ProgressPage({ myIdentityHex, playerLearningTier = 0, extendedMode = false, onRetakeDiagnostic, onStartSprint }: Props) {
  const { t } = useTranslation();
  const [sessions] = useTable(tables.my_sessions);
  const [answers]      = useTable(tables.my_answers);
  const [problemStats] = useTable(tables.problem_stats);
  const [dktWeights]   = useTable(tables.my_player_dkt_weights);
  const setLearningTier = useSTDBReducer(reducers.setLearningTier);
  const setExtendedMode = useSTDBReducer(reducers.setExtendedMode);

  const [adjusting, setAdjusting] = useState(false);
  const [pendingTier, setPendingTier] = useState(playerLearningTier);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);

  const myAnswers = useMemo(() => (answers as unknown as Answer[])?.filter(
    a => a.playerIdentity.toHexString() === myIdentityHex
  ) ?? [], [answers, myIdentityHex]);

  const myKcMastery = useMemo<number[] | null>(() => {
    const rows = dktWeights as unknown as PlayerDktWeights[] | undefined;
    if (!rows || rows.length === 0) return null;
    const row = rows.find(r => r.playerIdentity.toHexString() === myIdentityHex) ?? rows[0];
    return Array.from(row.kcMastery);
  }, [dktWeights, myIdentityHex]);

  const isMaxTier = playerLearningTier >= 7;

  const handleSetTier = async (tier: number) => {
    if (saving || (tier === playerLearningTier && !extendedMode)) { return; }
    if (tier > 7 && extendedMode) { return; } // Extended tiers are progression gates, not manually settable
    setSaving(true);
    setPendingTier(tier);
    await setLearningTier({ tier });
    if (extendedMode) {
       await setExtendedMode({ enabled: false });
    }
    setSaving(false);
  };

  const handleSetExtendedTier = async () => {
    if (saving || extendedMode) { return; }
    setSaving(true);
    setPendingTier(7);
    if (!isMaxTier) await setLearningTier({ tier: 7 });
    await setExtendedMode({ enabled: true });
    setSaving(false);
  };

  const handleStartSprint = () => {
    setStarting(true);
    onStartSprint(0n);
  };

  const proficiencies = useMemo(
    () => computeProficiency(myAnswers, relevantKCsForTier(playerLearningTier)),
    [myAnswers, playerLearningTier],
  );

  const withData = proficiencies.filter((p: KcProficiency) => p.classification !== 'untouched');
  const hasHistory = myAnswers.length >= 15;

  const struggling = withData
    .filter((p: KcProficiency) => p.classification === 'struggling')
    .sort((a: KcProficiency, b: KcProficiency) => a.accuracy - b.accuracy);
  const developing = withData
    .filter((p: KcProficiency) => p.classification === 'developing')
    .sort((a: KcProficiency, b: KcProficiency) => a.accuracy - b.accuracy);
  const fluent = withData
    .filter((p: KcProficiency) => p.classification === 'fluent')
    .sort((a: KcProficiency, b: KcProficiency) => b.kcIndex - a.kcIndex);

  const untouched = proficiencies.filter((p: KcProficiency) => p.classification === 'untouched' && !KC_TRIVIAL.has(p.kcIndex));
  const weakest: KcProficiency | undefined = struggling[0] ?? developing[0] ?? untouched[0];
  const strongest: KcProficiency | undefined = fluent[0] ?? developing[developing.length - 1];

  const allFluent = proficiencies.length > 0 && proficiencies.every((p: KcProficiency) => p.classification === 'fluent' || KC_TRIVIAL.has(p.kcIndex));
  const needsCalibration = withData.length === 0;

  // Suggesting pairs
  const suggestPairs = useCallback((kcIndex: number) => {
    const pairs: {a:number,b:number}[] = [];
    for(let a=1; a<=10; a++) {
      for(let b=a; b<=10; b++) {
        if (tagKCs(a, b).includes(kcIndex)) {
            pairs.push({a,b});
        }
      }
    }
    const pairScores = pairs.map(p => {
        const pairAns = myAnswers.filter(ans => (ans.a === p.a && ans.b === p.b) || (ans.a === p.b && ans.b === p.a));
        if (pairAns.length === 0) return { ...p, score: 0, attempts: 0 };
        const acc = pairAns.filter(x => x.isCorrect).length / pairAns.length;
        return { ...p, score: acc, attempts: pairAns.length };
    });
    pairScores.sort((a,b) => {
        if (a.attempts === 0 && b.attempts > 0) return -1;
        if (b.attempts === 0 && a.attempts > 0) return 1;
        return a.score - b.score;
    });
    return pairScores.slice(0, 3).map(p => `${p.a}×${p.b}`).join(', ');
  }, [myAnswers]);

  function insightText(p: KcProficiency): string {
    const pct = Math.round(p.accuracy * 100);
    const speed = (p.avgSpeedMs / 1000).toFixed(1);
    const kcName = t(p.nameKey as ParseKeys);
    if (p.classification === 'untouched') {
      return t('dkt.insight.untouched', { kc: kcName, defaultValue: `${kcName} — not yet explored. Start a sprint to unlock!` });
    }
    if (p.classification === 'fluent') {
      return t('dkt.insight.fluent', { kc: kcName, defaultValue: `${kcName} — solid! You're fast and accurate.` });
    }
    if (p.accuracy >= 0.7 && p.avgSpeedMs >= 3000) {
      return t('dkt.insight.developingSpeed', { kc: kcName, accuracy: pct, speed, defaultValue: `${kcName} — accurate (${pct}%) but slow (${speed}s avg). Practice for fluency.` });
    }
    if (p.classification === 'struggling') {
      return t('dkt.insight.struggling', { kc: kcName, accuracy: pct, defaultValue: `${kcName} — needs work (${pct}% accuracy). Try the strategy tips below.` });
    }
    return t('dkt.insight.developing', { kc: kcName, accuracy: pct, speed, defaultValue: `${kcName} — ${pct}% accuracy, ${speed}s avg. Keep practicing!` });
  }

  return (
    <PageContainer className="pb-[100px] sm:pb-[140px] flex flex-col gap-4 pt-4">
      
      <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-2 flex items-center gap-3">
        <div className="flex xl:h-[42px] xl:w-[42px] shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 shadow-sm">
          <ProgressIcon className="drop-shadow-sm scale-110" />
        </div>
        <span className="relative z-10 inline-block text-slate-900 dark:text-white">
          {t('nav.progress', { defaultValue: 'Your Learning Profile' })}
          <Swosh className="absolute w-[105%] h-[0.35em] -bottom-1 -left-[2.5%] text-brand-yellow/40 z-[-1]" />
        </span>
      </h1>

      {/* ── CARD 1: LEARNING PROFILE ── */}
      <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 sm:p-8 flex flex-col shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
        {isMaxTier && (
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-yellow/5 rounded-full blur-2xl pointer-events-none" />
        )}
        
        {/* Tier Header */}
        <div className="flex items-start justify-between relative z-10 mb-6 gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            <div className="text-4xl leading-none drop-shadow-sm flex-shrink-0">
              {TIER_EMOJI[Math.min(playerLearningTier, 7)]}
            </div>
            <div className="flex flex-col gap-1 min-w-[200px]">
              <div className={`flex flex-wrap items-center gap-3 font-bold text-lg ${isMaxTier ? 'text-brand-yellow dark:text-brand-yellow/90' : 'text-slate-800 dark:text-slate-100'}`}>
                <span className="text-2xl">{t(`tiers.tier${playerLearningTier}Name` as ParseKeys)}</span>
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700/50">
                  {t('tiers.statusLevel', { tier: playerLearningTier + 1 })}
                </span>
              </div>
            </div>
          </div>
          
          <button
             onClick={() => { setPendingTier(playerLearningTier); setAdjusting(!adjusting); }}
             title="Settings"
             className={`rounded-[18px] py-3 px-3.5 font-bold transition-all active:scale-[0.98] flex items-center justify-center flex-shrink-0 shadow-sm ${adjusting ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
             <span className={`leading-none block flex items-center justify-center transition-all w-4 h-4 ${adjusting ? 'text-[15px] font-sans' : 'text-xl -mt-1 font-serif'}`}>
               {adjusting ? '✕' : '⋮'}
             </span>
          </button>
        </div>

        {/* Insight Boxes */}
        <div className="flex flex-col relative z-10">
          {(!hasHistory || needsCalibration) ? (
             <div className="flex flex-col gap-1">
                <span className="font-bold text-slate-700 dark:text-slate-200">{t('dkt.moreData')}</span>
                <span className="text-sm text-slate-500">{t('dkt.moreDataDesc')}</span>
             </div>
          ) : allFluent ? (
             <div className="flex flex-col gap-1">
                <span className="font-black text-amber-600 dark:text-amber-400 text-lg flex items-center gap-2">🏆 {t('dkt.allMastered')}</span>
                <span className="text-sm font-bold text-amber-700/70 dark:text-amber-500/70">{t('dkt.allMasteredDesc')}</span>
             </div>
          ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {weakest && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden">
                    <div className="absolute -top-6 -right-6 text-6xl opacity-10 blur-[1px]">🎯</div>
                    <span className="text-xs font-black uppercase tracking-widest text-red-500/80">{t('dkt.weakest', 'Focus Area')}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[15px] leading-snug">{insightText(weakest)}</span>
                    {weakest.classification !== 'untouched' && (
                      <span className="text-xs font-bold text-red-500/70 dark:text-red-400/70 mt-1">
                        {t('progress.missionFocusPairs', { pairs: suggestPairs(weakest.kcIndex), defaultValue: `Practice pairs: ${suggestPairs(weakest.kcIndex)}` })}
                      </span>
                    )}
                  </div>
                )}
                {strongest && strongest !== weakest && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden">
                    <div className="absolute -top-6 -right-6 text-6xl opacity-10 blur-[1px]">⚡</div>
                    <span className="text-xs font-black uppercase tracking-widest text-green-500/80">{t('dkt.strongest', 'Strongest Skill')}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[15px] leading-snug">{insightText(strongest)}</span>
                  </div>
                )}
             </div>
          )}
        </div>

        {/* Expansion Body */}
        {adjusting && (
           <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700/50 flex flex-col gap-6 animate-in slide-in-from-top-2 relative z-10">
              <div className="flex flex-col gap-4">
                <span className="font-bold text-slate-700 dark:text-slate-200">{t('progress.adjustTier', { defaultValue: 'Adjust Learning Tier' })}</span>
                <TierLadder currentTier={playerLearningTier} selectedTier={pendingTier} onSelect={handleSetTier} answers={myAnswers} kcMastery={myKcMastery} extendedMode={extendedMode} />
                
                {/* Extended Toggle Inline */}
                {isMaxTier && !extendedMode && (
                  <button
                    onClick={handleSetExtendedTier}
                    disabled={saving}
                    className={`grid w-full items-center gap-x-2 rounded-xl border-2 px-3 py-2 transition-all mt-1 cursor-pointer active:scale-[0.98] ${
                      extendedMode
                        ? 'border-brand-yellow bg-brand-yellow/5 dark:bg-brand-yellow/10'
                        : 'border-slate-100 bg-slate-50 hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-900'
                    }`}
                    style={{ gridTemplateColumns: '1.5rem 1fr auto' }}>
                     {/* Emoji */}
                     <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[16px] leading-none opacity-80">
                       💎
                     </span>
                     
                     {/* Desc */}
                     <div className="flex items-center gap-2 min-w-0">
                       <span className={`text-left text-sm font-bold truncate transition-colors ${extendedMode ? 'text-brand-yellow' : 'text-slate-900 dark:text-white'}`}>
                         {t('extendedTables.toggle')}
                       </span>
                       <span className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:inline truncate">
                         {t('progress.unlocksExtended', { defaultValue: 'Unlocks ×11 to ×20' })}
                       </span>
                     </div>
                     
                     <span className="justify-self-end rounded-lg bg-slate-100 px-2 flex items-center justify-center py-1 text-[10px] font-black text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                       +×20
                     </span>
                  </button>
                )}
              </div>
           </div>
        )}

        {/* ── INLINE ACTION BAR ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full mt-6 relative z-10 pt-2">
           <button
              className={`group flex items-center justify-center gap-2 sm:flex-[2] rounded-[18px] bg-brand-yellow py-4 px-6 text-[16px] font-black tracking-wide text-slate-900 transition-all active:scale-[0.97] ${starting ? 'opacity-70 cursor-default' : 'hover:bg-brand-yellow-hover shadow-sm hover:shadow-[0_8px_30px_rgba(250,204,21,0.4)]'}`}
              onClick={handleStartSprint}
              disabled={starting}
            >
              <PlayIcon className={`h-6 w-6 transition-transform ${starting ? '' : 'group-hover:scale-110'}`} />
              {starting ? t('lobby.starting') : t('progress.startSprint', { defaultValue: 'Start Sprint' })}
           </button>
           <button
              onClick={onRetakeDiagnostic}
              title={t('tierPicker.testMyLevel')}
              className="sm:flex-[1] rounded-[18px] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 py-4 px-4 text-[15px] font-bold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] flex items-center justify-center gap-2 group shadow-sm min-w-[50px] whitespace-nowrap overflow-hidden"
           >
              <TestLevelIcon className="h-5 w-5 scale-110 transition-transform group-hover:scale-[1.2]" />
              <span>{t('tierPicker.testMyLevel')}</span>
           </button>
        </div>
      </div>

      {/* --- Nag Banner for Extended Tables --- */}
      {isMaxTier && !extendedMode && (
        <div className="bg-brand-yellow/10 border-2 border-brand-yellow/30 rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 justify-between animate-in slide-in-from-bottom-4 shadow-sm relative overflow-hidden mb-6">
           
           {/* Background flair */}
           <div className="absolute top-[-20%] right-[-10%] text-[140px] opacity-10 pointer-events-none rotate-12 blur-[2px]">🚀</div>

           <div className="relative z-10 text-center md:text-left">
             <div className="text-2xl font-black mb-2 text-slate-800 dark:text-white">
               {t('progress.extendedTitle', '10×10 complete.')}
             </div>
             <p className="text-sm font-bold text-slate-600 dark:text-slate-400 max-w-md">
               {t('progress.extendedDesc', 'All standard tables unlocked. Ready to tackle ×11 through ×20?')}
             </p>
           </div>
           
           <button
             onClick={handleSetExtendedTier}
             disabled={saving}
             className="relative z-10 px-6 py-4 bg-brand-yellow text-slate-900 rounded-2xl font-black text-lg shrink-0 shadow-[0_8px_30px_rgba(250,204,21,0.3)] hover:scale-[1.05] active:scale-95 transition-all w-full md:w-auto"
           >
             {saving ? t('common.saving', 'Saving…') : t('progress.extendedBtn', 'Unlock ×11–×20')}
           </button>
        </div>
      )}

      {/* ── CARD 3: MASTERY GRID ── */}
      <div id="mastery" className="bg-white dark:bg-slate-800 rounded-[28px] p-6 sm:p-8 flex flex-col shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">{t('lobby.masteryTitle')}</h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed max-w-2xl">
          {t('lobby.masteryDesc')}
        </p>
        <div className="overflow-x-auto -mx-2 px-2 pb-4">
          <MasteryGrid
            answers={myAnswers}
            problemStats={problemStats as unknown as ProblemStat[]}
            showExtended={isMaxTier && extendedMode}
            playerLearningTier={playerLearningTier}
            activeMissionKc={weakest ? weakest.kcIndex : undefined}
          />
        </div>
      </div>

      {/* ── CARD 4: SPRINT HISTORY ── */}
      <div id="history" className="bg-white dark:bg-slate-800 rounded-[28px] p-6 sm:p-8 flex flex-col shadow-sm border border-slate-200 dark:border-slate-700">
        <SprintHistory
          sessions={sessions as unknown as Session[]}
          answers={answers as unknown as Answer[]}
          myIdentityHex={myIdentityHex}
        />
      </div>
    </PageContainer>
  );
}

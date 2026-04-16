import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings';
import type { ProblemStat, Player } from '../module_bindings/types.js';
import { getRechenweg } from '../utils/rechenwege.js';
import MasteryGrid, { getSessionMastery } from '../components/MasteryGrid.js';
import PageContainer from '../components/PageContainer.js';
import AnimatedScore from '../components/AnimatedScore.js';

interface Props {
  sessionId: bigint;
  myIdentityHex: string;
  playerLearningTier?: number;
  extendedMode?: boolean;
  newlyUnlockedTier?: number;
  onNextSprint?: () => void;
  onBack: () => void;
}

function TierUnlockCelebration({ tier, onContinue }: { tier: number, onContinue: () => void }) {
  const { t } = useTranslation();
  
  useEffect(() => {
    import('../utils/audio.js').then((m) => m.playNewRecord());
  }, []);

  return (
    <div className="fixed inset-0 bg-brand-yellow z-[100] flex flex-col items-center justify-center p-6 text-slate-900 animate-in fade-in duration-500">
      <div className="text-[120px] md:text-[180px] animate-bounce mb-8 drop-shadow-xl" style={{ animationDuration: '2s' }}>🎉</div>
      <h1 className="text-5xl md:text-7xl font-black text-center tracking-tight mb-4 text-slate-900">
        {t(`tiers.unlocked${tier}` as ParseKeys)}
      </h1>
      <p className="text-xl md:text-2xl font-bold text-center opacity-80 mb-12 max-w-lg text-slate-800">
        {t(`tiers.unlockedDesc${tier}` as ParseKeys)}
      </p>
      <button
        onClick={onContinue}
        className="text-2xl md:text-3xl font-black bg-slate-900 text-brand-yellow px-12 py-6 rounded-full hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_8px_30px_rgba(15,23,42,0.3)] cursor-pointer"
      >
        {t('results.viewProgress')}
      </button>
    </div>
  );
}

export default function ResultsPage({ sessionId, myIdentityHex, playerLearningTier = 0, extendedMode = false, newlyUnlockedTier, onNextSprint }: Props) {
  const { t } = useTranslation();
  const [showCelebration, setShowCelebration] = useState(newlyUnlockedTier !== undefined);
  const [sessions] = useTable(tables.my_sessions);
  const [allAnswers] = useTable(tables.my_answers);
  const [problemStats] = useTable(tables.problem_stats);
  const [players] = useTable(tables.players);
  const session = sessions.find(s => s.id === sessionId);
  const myPlayer = (players as Player[]).find(p => p.identity.toHexString() === myIdentityHex);
  const myAnswers = allAnswers.filter(a => a.playerIdentity.toHexString() === myIdentityHex);
  const sessionAnswers = myAnswers.filter(a => a.sessionId === sessionId);
  const setLearningTier = useSTDBReducer(reducers.setLearningTier);
  const setExtendedMode = useSTDBReducer(reducers.setExtendedMode);
  const [activatingExtended, setActivatingExtended] = useState(false);

  // Top 3 hardest pairs this session (wrong answers by difficulty weight)
  const wrongPairs = sessionAnswers
    .filter(ans => !ans.isCorrect)
    .map(ans => ({
      key: `${ans.a}×${ans.b}`,
      a: ans.a, b: ans.b,
      weight: (problemStats as ProblemStat[]).find(s => s.problemKey === ans.a * 100 + ans.b)?.difficultyWeight ?? 1,
    }));
  const uniqueHard = [...new Map(wrongPairs.map(p => [p.key, p])).values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  // Streak calculation
  let currentStreak = 0;
  let maxStreak = 0;
  [...sessionAnswers].sort((a, b) => Number(a.id - b.id)).forEach(ans => {
    if (ans.isCorrect && (ans.attempts ?? 1) === 1) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  });

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [gridFocus, setGridFocus] = useState<{ a: number; b: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isComplete = session?.isComplete ?? false;

  // Trigger DKT Hugging Face AI pipeline once the session finalized
  useEffect(() => {
    if (isComplete && myIdentityHex) {
      // Automatic placement based on raw score for the very first session
      if (myPlayer && myPlayer.totalSessions === 1 && session) {
        let tier = 0;
        if (session.rawScore >= 40) tier = 7;
        else if (session.rawScore >= 30) tier = 5;
        else if (session.rawScore >= 20) tier = 3;
        else if (session.rawScore >= 10) tier = 1;
        
        if (myPlayer.learningTier < tier) {
          setLearningTier({ tier }).catch(console.error);
        }
      }
    }
  }, [isComplete, myIdentityHex, myPlayer?.totalSessions, session?.rawScore]);

  if (showCelebration && newlyUnlockedTier !== undefined) {
    return <TierUnlockCelebration tier={newlyUnlockedTier} onContinue={() => setShowCelebration(false)} />;
  }

  return (
    <PageContainer maxWidth="max-w-3xl" className="min-h-screen">

      {/* Header */}
      <div className="text-center pb-2 relative">
        <div className="text-5xl mb-4">🏁</div>
        <h1 className="text-3xl font-black tracking-tight">{t('results.heading')}</h1>
      </div>

      {/* Score card */}
      <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700 w-full text-center transition-colors">
        {!isComplete ? (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-brand-yellow" />
            <p className="font-bold text-slate-500">{t('results.finalizing')}</p>
          </div>
        ) : (
          <>
            <AnimatedScore score={session!.weightedScore} />
            <p className="text-slate-500 dark:text-slate-400 font-bold">{t('results.weightedScore')}</p>
            <a
              href="/progress#scoring-guide"
              className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mt-2 inline-block transition-colors"
            >
              {t('results.scoringExplained')} &rarr;
            </a>

            <div className="grid grid-cols-2 gap-4 md:gap-8 mt-8 py-6 border-t border-b border-slate-100 dark:border-slate-700/50">
              <Stat label={t('results.correct')} value={`${session!.rawScore} / ${session!.totalAnswered}`} />
              <Stat label={t('results.maxStreak')} value={`${maxStreak} 🔥`} />
            </div>

            {uniqueHard.length > 0 && (
              <div className="mt-8 text-left">
                <h3 className="text-xl font-black mb-4">{t('results.struggled')}</h3>
                <div className="flex flex-col gap-3">
                  {uniqueHard.map(p => {
                    const rw = getRechenweg(p.a, p.b);
                    const isOpen = expandedKey === p.key;
                    return (
                      <div key={p.key} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden transition-all">
                        <button
                          onClick={() => {
                            setExpandedKey(isOpen ? null : p.key);
                            setGridFocus({ a: p.a, b: p.b });
                            if (!isOpen) setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                          }}
                          className="flex items-center justify-between w-full p-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-4 py-1.5 rounded-xl text-sm font-black">
                            {p.key} = {p.a * p.b}
                          </span>
                          <span className="text-slate-400 font-black text-lg">
                            {isOpen ? '−' : '+'}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 mt-2">
                              {t(rw.strategyKey as ParseKeys)}
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {rw.steps.map((step, i) => (
                                <div key={i} className={`text-[15px] tabular-nums ${i === rw.steps.length - 1 ? 'font-black text-brand-yellow' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                                  {step}{i === rw.steps.length - 1 ? ' ✓' : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs font-semibold text-slate-400 mt-4">
                  {t('results.struggledHint')}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Next Sprint CTA */}
      {onNextSprint && (
        <button
          onClick={onNextSprint}
          className="w-full py-5 rounded-[28px] bg-brand-yellow text-slate-900 text-[22px] font-black shadow-[0_8px_30px_rgba(250,204,21,0.3)] hover:scale-[1.02] active:scale-95 hover:bg-[#f5c300] transition-all text-center cursor-pointer mt-2"
        >
          {t('results.nextSprint')}
        </button>
      )}

      {/* Nag Banner for Extended Tables intercepts the Mastery grid sightline */}
      {playerLearningTier >= 7 && !extendedMode && (
        <div className="bg-brand-yellow/10 border-2 border-brand-yellow/30 rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 justify-between animate-in zoom-in shadow-sm relative overflow-hidden w-full mt-2 mb-4 text-slate-900 dark:text-white transition-all">
           
           <div className="absolute top-[-50%] right-[-5%] text-[180px] opacity-10 pointer-events-none rotate-12 blur-[2px]">🌌</div>

           <div className="relative z-10 text-center md:text-left flex-1">
             <div className="text-2xl md:text-3xl font-black mb-2 text-slate-800 dark:text-white">
               Ready for the 20×20 Universe?
             </div>
             <p className="text-sm font-bold text-slate-600 dark:text-slate-400 max-w-lg">
               You've mastered the 10x10 multiplication tables! Unlock the Extended Expansion to ignite your journey into the teens.
             </p>
           </div>
           
           <button
             onClick={async () => {
                if (activatingExtended) return;
                setActivatingExtended(true);
                await setExtendedMode({ enabled: true });
                setActivatingExtended(false);
             }}
             disabled={activatingExtended}
             className="relative z-10 px-6 py-4 bg-brand-yellow text-slate-900 rounded-2xl font-black text-lg shrink-0 shadow-[0_8px_30px_rgba(250,204,21,0.3)] hover:scale-[1.05] active:scale-95 transition-transform w-full md:w-auto"
           >
             {activatingExtended ? 'Engaging Hyperdrive...' : 'Unlock the Next Frontier'}
           </button>
        </div>
      )}

      {/* Mastery grid */}
      {myAnswers.length > 0 && (
        <div ref={gridRef} className="bg-white dark:bg-slate-800 rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700 w-full mt-2 transition-colors">
          <h2 className="text-2xl font-black mb-2">{t('results.masteryTitle')}</h2>
          <p className="text-sm font-bold text-slate-500 mb-6">
            {t('results.masteryDesc')}
          </p>
          <MasteryGrid
            answers={myAnswers}
            problemStats={problemStats as unknown as ProblemStat[]}
            highlightSession={sessionId}
            sessionAnswers={sessionAnswers}
            showExtended={playerLearningTier >= 7 && extendedMode}
            playerLearningTier={playerLearningTier}
            focusCell={gridFocus}
          />
        </div>
      )}

      {/* Problems this sprint */}
      {sessionAnswers.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700 w-full mb-8 transition-colors">
          <h2 className="text-xl font-black mb-4">{t('results.problemsTitle')}</h2>
          <div className="columns-[150px] sm:columns-2 md:columns-3 lg:columns-4 gap-4">
            {[...sessionAnswers]
              .sort((a, b) => Number(a.id - b.id))
              .map((ans) => {
                const correct = ans.a * ans.b;
                const ms = ans.responseMs ?? 0;
                const msLabel = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

                const m = getSessionMastery(ans);
                let colorClass = '';
                if (m === 'mastered') colorClass = 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400';
                else if (m === 'learning') colorClass = 'bg-yellow-500/10 border-yellow-500/40 text-yellow-700 dark:text-yellow-500';
                else colorClass = 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400';

                const attempts = Math.max(1, ans.attempts ?? 1);

                return (
                  <div
                    key={String(ans.id)}
                    className={`flex items-center break-inside-avoid mb-2.5 gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${colorClass}`}
                  >
                    <span className="font-bold shrink-0 w-9 text-slate-700 dark:text-slate-300">{ans.a}×{ans.b}</span>
                    <span className="text-slate-400 font-medium">=</span>
                    <span className={`font-black ${ans.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {ans.userAnswer}
                    </span>
                    {!ans.isCorrect && (
                      <span className="text-[10px] font-bold text-slate-400">→{correct}</span>
                    )}
                    <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                      {attempts > 1 && (
                        <span className="text-[10px] font-black opacity-50 bg-slate-200/50 dark:bg-slate-800/50 px-1 rounded-sm">
                          {attempts}x
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                        {msLabel}
                      </span>
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

    </PageContainer>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className={`text-3xl font-black tabular-nums whitespace-nowrap transition-colors ${accent ? 'text-brand-yellow' : 'text-slate-800 dark:text-white'}`}>
        {value}
      </div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

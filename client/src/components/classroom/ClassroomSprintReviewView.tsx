import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Classroom, Answer, ProblemStat } from '../../module_bindings/types.js';
import MasteryGrid from '../MasteryGrid.js';
import PageContainer from '../PageContainer.js';

interface Props {
  myClassroom: Classroom;
  sprintAnswers: Answer[];
  liveLB: { identityHex: string; username: string; correct: number; score: number }[];
  problemStats: ProblemStat[];
  onReturnToLobby: () => void;
}

export default function ClassroomSprintReviewView({
  myClassroom,
  sprintAnswers,
  liveLB,
  problemStats,
  onReturnToLobby
}: Props) {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const totalAnswers = sprintAnswers.length;
    let correctCount = 0;
    const problemMap = new Map<string, { a: number, b: number, attempts: number, correct: number, totalResponseMs: number }>();
    const activeStudents = new Set<string>();

    for (const ans of sprintAnswers) {
      activeStudents.add(ans.playerIdentity.toHexString());
      if (ans.isCorrect) correctCount++;

      const key = `${ans.a}x${ans.b}`;
      if (!problemMap.has(key)) {
        problemMap.set(key, { a: ans.a, b: ans.b, attempts: 0, correct: 0, totalResponseMs: 0 });
      }
      
      const p = problemMap.get(key)!;
      p.attempts += 1; // 1 db answer row = 1 attempt block
      if (ans.isCorrect) {
        p.correct += 1;
        p.totalResponseMs += ans.responseMs;
      }
    }

    const accuracy = totalAnswers > 0 ? (correctCount / totalAnswers) * 100 : 0;
    
    // Sort logic to find superlatives
    let hardest: { a: number, b: number, errorRate: number } | null = null;
    let fastest: { a: number, b: number, avgMs: number } | null = null;
    let slowest: { a: number, b: number, avgMs: number } | null = null;

    for (const p of problemMap.values()) {
      if (p.attempts >= 3) {
        const errorRate = 1 - (p.correct / p.attempts);
        if (!hardest || errorRate > hardest.errorRate) {
          hardest = { a: p.a, b: p.b, errorRate };
        }
      }

      if (p.correct >= 3) {
        const avgMs = p.totalResponseMs / p.correct;
        if (!fastest || avgMs < fastest.avgMs) fastest = { a: p.a, b: p.b, avgMs };
        if (!slowest || avgMs > slowest.avgMs) slowest = { a: p.a, b: p.b, avgMs };
      }
    }

    return {
      totalAnswers,
      accuracy,
      studentCount: activeStudents.size,
      hardest,
      fastest,
      slowest
    };
  }, [sprintAnswers]);

  return (
    <PageContainer maxWidth="max-w-7xl" className="pb-[140px] sm:pb-[160px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 rounded-[32px] border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 shadow-sm p-8 sm:p-10 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-yellow/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white capitalize">
            {t('classSprint.review.title', { defaultValue: 'Sprint Complete!' })}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {myClassroom.name} • {t('classSprint.review.subtitle', { defaultValue: 'Review your class performance' })}
          </p>
        </div>
        <button
          onClick={onReturnToLobby}
          className="relative z-10 rounded-2xl bg-slate-900 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-slate-900/20 active:scale-95 transition-all hover:-translate-y-1 dark:bg-white dark:text-slate-900 dark:shadow-white/10"
        >
          {t('common.return', { defaultValue: 'Back to Lobby' })}
        </button>
      </div>

      {/* Primary Top Level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700 flex flex-col items-center justify-center text-center">
          <span className="text-5xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white mb-2">
            {stats.accuracy.toFixed(0)}<span className="text-3xl text-slate-400">%</span>
          </span>
          <span className="text-sm font-bold tracking-widest text-slate-400 uppercase">
            {t('classSprint.review.accuracy', { defaultValue: 'Class Accuracy' })}
          </span>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700 flex flex-col items-center justify-center text-center">
          <span className="text-5xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white mb-2">
            {stats.totalAnswers}
          </span>
          <span className="text-sm font-bold tracking-widest text-slate-400 uppercase">
            {t('classSprint.review.totalAnswers', { defaultValue: 'Answers Computed' })}
          </span>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700 flex flex-col items-center justify-center text-center">
          <span className="text-5xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white mb-2">
            {stats.studentCount}
          </span>
          <span className="text-sm font-bold tracking-widest text-slate-400 uppercase">
            {t('classSprint.review.activeRunners', { defaultValue: 'Active Runners' })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Mastery Grid snapshot */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            {t('classSprint.grid', { defaultValue: 'Combined Class Grid' })}
          </h2>
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700 h-full">
            <MasteryGrid answers={sprintAnswers} problemStats={problemStats} />
          </div>
        </div>

        {/* Didactic Insights */}
        <div className="flex flex-col gap-6 xl:col-span-4">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            {t('classSprint.review.insights', { defaultValue: 'Didactic Insights' })}
          </h2>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-5 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/20 text-2xl">
                🎯
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold tracking-widest text-red-500/80 uppercase mb-1">
                  {t('classSprint.review.hardest', { defaultValue: 'Needs Practice' })}
                </h3>
                {stats.hardest ? (
                  <p className="text-lg font-bold text-red-900 dark:text-red-300">
                    <span className="font-mono text-2xl font-black mr-2 tracking-wider">{stats.hardest.a} × {stats.hardest.b}</span> 
                    with {(stats.hardest.errorRate * 100).toFixed(0)}% mistakes
                  </p>
                ) : (
                  <p className="text-sm text-red-700/60 dark:text-red-400/60 font-medium">Not enough data collected.</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-brand-yellow/30 p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-amber-200 dark:bg-brand-yellow/20 text-2xl">
                🏎️
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold tracking-widest text-amber-600/80 dark:text-amber-500/80 uppercase mb-1">
                  {t('classSprint.review.fastest', { defaultValue: 'Fastest Pair' })}
                </h3>
                {stats.fastest ? (
                  <p className="text-lg font-bold text-amber-900 dark:text-amber-300">
                    <span className="font-mono text-2xl font-black mr-2 tracking-wider">{stats.fastest.a} × {stats.fastest.b}</span> 
                    in {(stats.fastest.avgMs / 1000).toFixed(1)}s
                  </p>
                ) : (
                  <p className="text-sm text-amber-700/60 font-medium">Not enough data collected.</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-5 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20 text-2xl">
                🐌
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold tracking-widest text-blue-500/80 uppercase mb-1">
                  {t('classSprint.review.slowest', { defaultValue: 'Slowest Pair' })}
                </h3>
                {stats.slowest ? (
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-300">
                    <span className="font-mono text-2xl font-black mr-2 tracking-wider">{stats.slowest.a} × {stats.slowest.b}</span> 
                    in {(stats.slowest.avgMs / 1000).toFixed(1)}s avg
                  </p>
                ) : (
                  <p className="text-sm text-blue-700/60 font-medium">Not enough data collected.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sprint Leaderboard Isolated */}
        <div className="flex flex-col gap-6 xl:col-span-3">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            {t('classSprint.review.leaderboard', { defaultValue: 'Sprint Podium' })}
          </h2>
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            {liveLB.length === 0 ? (
              <p className="text-sm text-slate-400">No scores recorded for this sprint.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {liveLB.slice(0, 10).map((r, i) => (
                  <div key={r.identityHex} className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800/50 p-4 transition-transform hover:scale-[1.01]">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-brand-yellow shadow-inner' : i === 1 ? 'bg-slate-200 text-slate-500 dark:bg-slate-600 dark:text-slate-300' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                      {i + 1}
                    </div>
                    <span className="flex-1 text-lg font-bold text-slate-900 dark:text-white line-clamp-1">{r.username}</span>
                    <div className="flex flex-col items-end">
                      <span className="text-xl leading-none font-black tabular-nums text-brand-yellow drop-shadow-sm">{r.score.toFixed(1)}</span>
                      <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">{r.correct} {t('classSprint.review.correctShort', { defaultValue: 'DONE' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

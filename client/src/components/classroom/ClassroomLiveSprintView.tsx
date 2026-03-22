import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Classroom, Answer, ProblemStat, Player, NextProblemResult, IssuedProblemResult, Session } from '../../module_bindings/types.js';
import PageContainer from '../PageContainer.js';
import MasteryGrid from '../MasteryGrid.js';
import { StopIcon } from '../Icons.js';
import StudentObserverModal from './StudentObserverModal.js';
import { useState } from 'react';

interface Props {
  myClassroom: Classroom;
  sprintTimeLeft: number | null;
  endingClassSprint: boolean;
  onEndSprint: () => void;
  sprintAnswers: Answer[];
  problemStats: ProblemStat[];
  liveLB: { identityHex: string; username: string; correct: number; score: number }[];
  recentAnswers: Answer[];
  players: Player[];
  nextProblemResults: NextProblemResult[];
  issuedProblemResults: IssuedProblemResult[];
  sessions: Session[];
  isDiagnostic: boolean;
}

export default function ClassroomLiveSprintView({
  myClassroom,
  sprintTimeLeft,
  endingClassSprint,
  onEndSprint,
  sprintAnswers,
  problemStats,
  liveLB,
  recentAnswers,
  players,
  nextProblemResults,
  issuedProblemResults,
  sessions,
  isDiagnostic
}: Props) {
  const { t } = useTranslation();
  const [selectedStudentHex, setSelectedStudentHex] = useState<string | null>(null);

  return (
    <PageContainer maxWidth="max-w-7xl" className="pb-[140px] sm:pb-[160px]">
      {/* Live Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[32px] border border-brand-yellow/30 bg-white dark:bg-slate-800 shadow-sm p-8 sm:p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-brand-yellow/5" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between w-full gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-500/20 animate-pulse">
              <span className="h-4 w-4 rounded-full bg-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white line-clamp-1">{myClassroom.name}</h1>
              <p className="text-sm font-bold text-red-500 tracking-wide uppercase">{t('classSprint.live')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex-1 text-center sm:text-right">
              <div className="text-4xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
                {sprintTimeLeft !== null ? `${sprintTimeLeft}s` : '...'}
              </div>
            </div>
            <button
              onClick={onEndSprint}
              disabled={endingClassSprint}
              className="group flex items-center gap-3 rounded-2xl bg-red-500 px-6 sm:px-8 py-4 text-lg font-black tracking-tight text-white transition-all active:scale-95 hover:scale-[1.02] shadow-md shadow-red-500/20 disabled:opacity-50 disabled:hover:scale-100"
            >
              <StopIcon className="h-7 w-7 transition-transform group-hover:scale-110" />
              {t('classSprint.end')}
            </button>
          </div>
        </div>
        
        {/* Progress Bar (absolute to bottom of container) */}
        {sprintTimeLeft !== null && (
          <div className="absolute bottom-0 left-0 h-1.5 bg-slate-100 dark:bg-slate-900 w-full">
            <div 
              className="h-full transition-all duration-1000 ease-linear"
              style={{ 
                width: `${(sprintTimeLeft / 60) * 100}%`,
                backgroundColor: sprintTimeLeft <= 10 ? '#ef4444' : sprintTimeLeft <= 20 ? '#f59e0b' : '#3b82f6'
              }} 
            />
          </div>
        )}
      </div>

      {/* Live Content Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mt-8">
        <div className="xl:col-span-5 flex flex-col gap-6">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
            <h3 className="mb-4 text-sm font-bold tracking-widest text-slate-400 uppercase">{t('classSprint.grid')}</h3>
            <MasteryGrid answers={sprintAnswers} problemStats={problemStats} />
          </div>
        </div>

        {/* LEADERBOARD */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 xl:col-span-3 max-h-[800px] overflow-y-auto">
          <h3 className="mb-4 text-sm font-bold tracking-widest text-slate-400 uppercase">{t('classSprint.liveScores')}</h3>
          {liveLB.length === 0 ? (
            <p className="text-sm text-slate-400">{t('classSprint.noScoresYet')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {liveLB.map((r, i) => (
                <button 
                  key={r.identityHex} 
                  onClick={() => setSelectedStudentHex(r.identityHex)}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800/50 p-3 transition-colors hover:border-brand-yellow/30 hover:bg-brand-yellow/5 group cursor-pointer text-left"
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>
                    {i + 1}
                  </div>
                  <span className="flex-1 text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-brand-yellow transition-colors">{r.username}</span>
                  <span className="text-xs font-medium text-slate-400">{r.correct}✓</span>
                  <span className="text-sm font-black tabular-nums text-brand-yellow drop-shadow-sm">{r.score.toFixed(1)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* LIVE ANSWERS FEED */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 xl:col-span-4 max-h-[800px] overflow-y-auto">
          <h3 className="mb-4 text-sm font-bold tracking-widest text-slate-400 uppercase">{t('classSprint.liveAnswers')}</h3>
          {recentAnswers.length === 0 ? (
            <p className="text-sm text-slate-400">{t('classSprint.waitingForAnswers')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentAnswers.map(a => {
                const p = players.find(pl => pl.identity.toHexString() === a.playerIdentity.toHexString());
                return (
                  <div key={String(a.id)} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${a.isCorrect ? 'bg-green-50 text-green-700 dark:bg-green-900/10 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-400'}`}>
                    <span className="text-xs">{a.isCorrect ? '🟢' : '🔴'}</span>
                    <span className="flex-1 line-clamp-1 truncate">{p?.username ?? '?'}</span>
                    <span className="font-mono tracking-wider opacity-80">{a.a}×{a.b}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedStudentHex && (
        <StudentObserverModal
          studentIdentityHex={selectedStudentHex}
          studentName={liveLB.find(r => r.identityHex === selectedStudentHex)?.username ?? '?'}
          sprintAnswers={sprintAnswers}
          nextProblemResults={nextProblemResults}
          issuedProblemResults={issuedProblemResults}
          sessions={sessions}
          onClose={() => setSelectedStudentHex(null)}
          isDiagnostic={isDiagnostic}
        />
      )}
    </PageContainer>
  );
}

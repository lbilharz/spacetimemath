import React from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import type { Classroom, ClassroomMember, Answer, ProblemStat } from '../../module_bindings/types.js';
import PageContainer from '../PageContainer.js';
import MasteryGrid from '../MasteryGrid.js';
import { SettingsIcon, PlayIcon } from '../Icons.js';

interface LeaderRow {
  id: string;
  username: string;
  best?: number;
  hidden: boolean;
}

interface Props {
  myClassroom: Classroom;
  myIdentityHex: string;
  isTeacher: boolean;
  members: ClassroomMember[];
  visibleMembers: ClassroomMember[];
  leaderRows: LeaderRow[];
  classAnswers: Answer[];
  problemStats: ProblemStat[];
  sprintError: string | null;
  startingClassSprint: boolean;
  leaving: boolean;
  onOpenSettings: () => void;
  onOpenStartModal: () => void;
  onLeave: () => void;
  children?: React.ReactNode;
}

export default function ClassroomLobbyView({
  myClassroom,
  myIdentityHex,
  isTeacher,
  members,
  visibleMembers,
  leaderRows,
  classAnswers,
  problemStats,
  sprintError,
  startingClassSprint,
  leaving,
  onOpenSettings,
  onOpenStartModal,
  onLeave,
  children
}: Props) {
  const { t } = useTranslation();
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <PageContainer maxWidth="max-w-3xl" className="pb-[140px] sm:pb-[160px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white line-clamp-1">{myClassroom.name}</h1>
          <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {isTeacher ? t('classroom.youAreTeaching') : t('classroom.youAreStudent')} <span className="mx-2 opacity-50">•</span> {t('classroom.members', { count: members.length })}
          </div>
        </div>
        
        {isTeacher && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenSettings}
              className="group flex h-[56px] w-[56px] items-center justify-center rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:scale-[1.02] active:scale-95 transition-all focus:outline-none"
            >
              <SettingsIcon className="h-6 w-6 text-slate-500 dark:text-slate-400 transition-transform group-hover:rotate-[15deg]" />
            </button>
            <button
              data-testid="teacher-start-sprint-button"
              onClick={onOpenStartModal}
              disabled={startingClassSprint}
              className="group flex items-center justify-center gap-3 rounded-2xl bg-brand-yellow px-6 sm:px-8 py-4 text-[19px] font-black tracking-tight text-slate-900 h-[56px] shadow-sm shadow-brand-yellow/20 hover:scale-[1.02] active:scale-[0.97] transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              <PlayIcon className="h-7 w-7 transition-transform group-hover:scale-110" />
              {startingClassSprint ? t('classSprint.starting') : t('classSprint.start')}
            </button>
          </div>
        )}
      </div>

      {sprintError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400 mt-4">
          {sprintError}
        </div>
      )}

      {/* Primary Content Map */}
      {isTeacher && members.length === 0 ? (
        // Empty State: Always show login code
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-slate-200 bg-white p-8 sm:p-12 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 text-center mt-4">
          <div className="mb-6 rounded-3xl border-4 border-slate-50 dark:border-slate-700/50 bg-white p-6 shadow-inner">
            <QRCodeSVG value={`${window.location.origin}/?join=${myClassroom.code}`} size={180} level="H" />
          </div>
          <h2 className="mb-2 text-2xl font-black text-slate-900 dark:text-white">Raum bereit!</h2>
          <p className="mb-6 text-sm text-slate-500 max-w-sm">
            Zeige diesen Code, damit deine Schueler_innen beitreten können.
          </p>
          <div data-testid="classroom-code-display" className="font-mono text-4xl font-bold tracking-[0.25em] text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-8 py-4 rounded-2xl">
            {myClassroom.code}
          </div>
        </div>
      ) : (
        // Filled State: Leaderboard and Mastery
        <div className="flex flex-col gap-6 mt-2">
          
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
            <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">{t('classroom.leaderboard')}</h2>
            {leaderRows.length === 0 ? (
              <p className="text-slate-500">{t('classroom.leaderboardEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {leaderRows.map((m, i) => {
                  const isMe = m.id === myIdentityHex;
                  return (
                    <div key={m.id} className={`flex items-center gap-4 rounded-2xl p-4 transition-colors ${isMe ? 'bg-amber-50 dark:bg-amber-500/10 border border-brand-yellow/30' : 'bg-slate-50 dark:bg-slate-900/50 border border-transparent'}`}>
                      <div className={`flex w-8 justify-center font-black ${i < 3 ? 'text-brand-yellow text-xl drop-shadow-sm' : 'text-slate-400'}`}>
                        {i < 3 ? medals[i] : i + 1}
                      </div>
                      <div className={`flex-1 font-bold ${isMe ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        {m.username}
                        {isMe && <span className="ml-2 rounded-md bg-brand-yellow/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-400">{t('common.you')}</span>}
                      </div>
                      <div className="font-black tabular-nums tracking-tight text-brand-yellow text-lg">
                        {m.best!.toFixed(1)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-6 text-center text-xs text-slate-400">
              {t('classroom.liveCaption')}
            </p>
          </div>

          {classAnswers.length > 0 && (
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
              <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">{t('classroom.classMastery')}</h2>
              <p className="mb-6 text-sm text-slate-500">
                {t('classroom.classMasteryDesc', { count: visibleMembers.length })}
              </p>
              <MasteryGrid answers={classAnswers} problemStats={problemStats} />
            </div>
          )}

          {!isTeacher && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={onLeave}
                disabled={leaving}
                className="text-sm font-bold text-red-500 hover:text-red-600 hover:underline transition-colors"
              >
                {leaving ? t('classroom.leaving') : t('classroom.leaveClass')}
              </button>
            </div>
          )}
        </div>
      )}

      {children}
    </PageContainer>
  );
}

import { useTranslation } from 'react-i18next';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings/index.js';
import type { Answer, ClassSprint, Classroom, Player, ProblemStat, Session } from '../module_bindings/types.js';
import MasteryGrid from '../components/MasteryGrid.js';

interface Props {
  classSprintId: bigint;
  myIdentityHex: string;
}

const ResultsIcon = ({ className }: { className?: string }) => (
  <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <circle cx="50" cy="50" r="30" fill="none" stroke="#4FA7FF" strokeWidth="8" />
    <circle cx="50" cy="50" r="15" fill="#E8391D" />
    <path d="M70 30L85 15" stroke="#FBBA00" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

export default function ClassSprintResultsPage({ classSprintId, myIdentityHex }: Props) {
  const { t } = useTranslation();
  const [sessions]      = useTable(tables.sessions);
  const [answers]       = useTable(tables.answers);
  const [classSprints]  = useTable(tables.class_sprints);
  const [classrooms]    = useTable(tables.classrooms);
  const [players]       = useTable(tables.players);
  const [problemStats]  = useTable(tables.problem_stats);

  // Meta
  const classSprint = (classSprints as unknown as ClassSprint[]).find(s => s.id === classSprintId);
  const classroom   = classSprint
    ? (classrooms as unknown as Classroom[]).find(c => c.id === classSprint.classroomId)
    : null;

  // Sessions that belong to this class sprint (compare as strings to avoid bigint/number coercion issues)
  const classSprintIdStr = String(classSprintId);
  const sprintSessions = (sessions as unknown as Session[]).filter(
    s => String(s.classSprintId) === classSprintIdStr
  );
  const sessionIdStrs = new Set<string>(sprintSessions.map(s => String(s.id)));

  // Answers for those sessions
  const sprintAnswers = (answers as unknown as Answer[]).filter(a => sessionIdStrs.has(String(a.sessionId)));

  // Ranking — all sessions, completed ones use weightedScore, running ones use live answer scores
  const ranking = sprintSessions
    .map(s => {
      const identityHex = s.playerIdentity.toHexString();
      const player = (players as unknown as Player[]).find(p => p.identity.toHexString() === identityHex);
      const sa = sprintAnswers.filter(a => String(a.sessionId) === String(s.id));
      const correct = sa.filter(a => a.isCorrect).length;
      const total = sa.length;
      const isComplete = s.isComplete;
      // Completed sessions have final weightedScore; running ones: compute live from answers
      const score = isComplete
        ? s.weightedScore
        : sa.filter(a => a.isCorrect).reduce((sum, a) => {
            const key = a.a * 100 + a.b;
            const stat = (problemStats as unknown as ProblemStat[]).find(ps => ps.problemKey === key);
            return sum + (stat?.difficultyWeight ?? 1.0);
          }, 0);
      return { identityHex, username: player?.username ?? s.username, score, correct, total, isComplete };
    })
    .sort((a, b) => b.score - a.score);

  // Incomplete-session players still running
  const running = sprintSessions.filter(s => !s.isComplete).length;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 md:p-6 pb-[100px] sm:pb-[140px] animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Header */}
      <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-4 flex items-center gap-3">
        <div className="flex xl:h-[42px] xl:w-[42px] shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 shadow-sm">
          <ResultsIcon className="drop-shadow-sm scale-110" />
        </div>
        {t('classSprint.resultsTitle')}
      </h1>

      <div className="-mt-4 flex flex-col gap-1">
        {classroom && (
          <p className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-2">
            <span>📚</span> {classroom.name}
          </p>
        )}
        {running > 0 && (
          <p className="text-brand-yellow font-black text-xs uppercase tracking-widest animate-pulse">
            ⏱ {running} {t('classSprint.stillRunning', { defaultValue: 'läuft noch...' })}
          </p>
        )}
      </div>

      {/* Class ranking card */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 transition-colors">
        <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">{t('classSprint.rankingTitle')}</h2>
        {ranking.length === 0 ? (
          <p className="text-slate-500 italic">{t('classSprint.noResults')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[3rem_1fr_4rem_4rem] gap-4 px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">#</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('classroom.colPlayer')}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">{t('classSprint.colScore')}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">{t('classSprint.colCorrect')}</span>
            </div>
            {ranking.map((r, i) => {
              const isMe = r.identityHex === myIdentityHex;
              return (
                <div
                  key={r.identityHex}
                  className={`grid grid-cols-[3rem_1fr_4rem_4rem] gap-4 items-center rounded-2xl p-4 transition-colors ${
                    isMe ? 'bg-amber-50 dark:bg-amber-500/10 border border-brand-yellow/30' : 'bg-slate-50 dark:bg-slate-900/50 border border-transparent'
                  } ${!r.isComplete ? 'opacity-60 grayscale-[0.5]' : ''}`}
                >
                  <div className={`flex justify-center font-black ${i < 3 ? 'text-brand-yellow text-xl drop-shadow-sm' : 'text-slate-400'}`}>
                    {i < 3 ? medals[i] : i + 1}
                  </div>
                  <div className={`font-bold truncate ${isMe ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    {r.username}
                    {isMe && <span className="ml-2 rounded-md bg-brand-yellow/20 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-amber-700 dark:text-amber-400">{t('common.you')}</span>}
                    {!r.isComplete && <span className="ml-2 text-xs opacity-50">⏱</span>}
                  </div>
                  <div className="font-black tabular-nums text-right text-brand-yellow text-lg">
                    {r.score.toFixed(1)}
                  </div>
                  <div className="text-right text-xs font-bold text-slate-400 tabular-nums">
                    {r.correct}/{r.total}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Combined mastery grid for this sprint */}
      {sprintAnswers.length > 0 && (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 transition-colors">
          <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">{t('classSprint.grid')}</h2>
          <p className="mb-6 text-sm text-slate-500">
            {t('classSprint.gridDesc')}
          </p>
          <MasteryGrid answers={sprintAnswers} problemStats={problemStats as unknown as ProblemStat[]} />
        </div>
      )}
    </div>
  );
}

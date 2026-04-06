import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Classroom, ClassroomMember, Player, ProblemStat } from '../module_bindings/types.js';
import ScoringGuide from '../components/ScoringGuide.js';
import PageContainer from '../components/PageContainer.js';
import { PlayIcon } from '../components/Icons.js';
import NetworkLeaderboard from '../components/NetworkLeaderboard.js';

const TIER_EMOJI = ['🌱', '🔨', '⚡', '🎯', '🔥', '💫', '🌟', '🏆'];



interface Props {
  myPlayer: Player | undefined;
  myIdentityHex: string | undefined;
  onStartSprint: (sessionId: bigint) => void;
  onEnterClassroom: (id: bigint) => void;
  onGoToAccount: () => void;
}

export default function LobbyPage({ myPlayer, myIdentityHex, onStartSprint, onEnterClassroom, onGoToAccount }: Props) {
  const { t } = useTranslation();
  const [classrooms]        = useTable(tables.my_classrooms);
  const [classroomMembers]  = useTable(tables.my_classroom_members);
  const [problemStats]      = useTable(tables.problem_stats);
  const joinClassroom       = useSTDBReducer(reducers.joinClassroom);

  // Nag: teacher with students who hasn't emailed their recovery key yet
  const hasStudents = (classrooms as unknown as Classroom[]).some(c =>
    c.teacher.toHexString() === myIdentityHex &&
    (classroomMembers as unknown as ClassroomMember[]).some(m => m.classroomId === c.id && !m.hidden)
  );
  const showNag = hasStudents && !myPlayer?.recoveryEmailed;

  const [starting, setStarting]           = useState(false);
  // Pending auto-join code from ?join=CODE URL param; cleared once we navigate
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);

  // Auto-join from ?join=CODE URL param (QR code scan).
  // Step 1: detect the code and fire the reducer.
  useEffect(() => {
    if (!myPlayer) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (!code) return;
    window.history.replaceState({}, '', '/');   // clean the URL immediately
    const upperCode = code.trim().toUpperCase();
    setPendingJoinCode(upperCode);
    joinClassroom({ code: upperCode }).catch(() => setPendingJoinCode(null));
  }, [myPlayer?.identity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: navigate once the classrooms subscription delivers the joined classroom.
  // (classrooms may be empty when Step 1 fires — SpacetimeDB subscription catches up asynchronously)
  useEffect(() => {
    if (!pendingJoinCode) return;
    const classroom = (classrooms as unknown as Classroom[]).find(c => c.code === pendingJoinCode);
    if (classroom) {
      setPendingJoinCode(null);
      onEnterClassroom(classroom.id);
    }
  }, [pendingJoinCode, classrooms]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartSprint = () => {
    setStarting(true);
    onStartSprint(0n); // SprintPage owns session creation on mount
  };

  return (
    <PageContainer className="pb-[100px] sm:pb-[140px]">
      {/* Recovery key nag for teachers with students */}
      {showNag && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-brand-yellow bg-brand-yellow/10 p-3 md:p-4">
          <span className="text-xl">⚠️</span>
          <p className="flex-1 text-sm text-slate-800 dark:text-slate-200 font-medium">
            {t('lobby.recoveryNag')}
          </p>
          <button className="rounded-lg bg-brand-yellow px-4 py-2 text-sm font-bold text-slate-900 hover:bg-brand-yellow-hover whitespace-nowrap transition-colors" onClick={onGoToAccount}>
            {t('lobby.recoveryNagCta')}
          </button>
        </div>
      )}

      {/* Welcome + Sprint CTA */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 transition-colors">
        {myPlayer && (
          <div>
            <h1 className="mb-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {t('lobby.hello', { name: myPlayer.username })} 👋
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <a
                href="/progress#tier-status"
                className="font-semibold text-brand-yellow hover:text-brand-yellow-hover no-underline transition-colors"
              >
                {TIER_EMOJI[Math.min(myPlayer.learningTier ?? 0, 7)]}
                {' '}{t('tiers.statusLevel' as ParseKeys, { tier: myPlayer.learningTier ?? 0 })}
              </a>
              <span className="text-slate-400 dark:text-slate-500 text-xs">·</span>
              <span className="text-slate-500 dark:text-slate-400">
                {t('lobby.bestScore')} <b className="text-brand-yellow">{myPlayer.bestScore.toFixed(1)}</b>
              </span>
              <span className="text-slate-400 dark:text-slate-500 text-xs">·</span>
              <span className="text-slate-500 dark:text-slate-400">
                {t('lobby.sessions', { count: myPlayer.totalSessions })}
              </span>
            </div>
          </div>
        )}
        <button
          className={`group flex items-center justify-center gap-3 w-full rounded-2xl bg-brand-yellow py-4 text-[19px] font-black tracking-tight text-slate-900 transition-all active:scale-[0.97] mt-2 ${starting ? 'opacity-70 cursor-default' : 'hover:bg-brand-yellow-hover shadow-[0_8px_30px_rgba(250,204,21,0.35)] hover:shadow-[0_8px_30px_rgba(250,204,21,0.5)] hover:ring-4 hover:ring-brand-yellow/30'}`}
          onClick={handleStartSprint}
          disabled={starting}
        >
          <PlayIcon className={`h-8 w-8 transition-transform ${starting ? '' : 'group-hover:scale-110'}`} />
          {starting ? t('lobby.starting') : t('lobby.startSprint')}
        </button>
      </div>

      {/* Dynamic Network Leaderboard */}
      {myIdentityHex && (
        <div className="mt-6">
          <NetworkLeaderboard myIdentityHex={myIdentityHex} />
        </div>
      )}

      {/* Scoring Guide */}
      <ScoringGuide
        problemStats={problemStats as unknown as ProblemStat[]}
        playerLearningTier={myPlayer?.learningTier ?? 0}
      />
    </PageContainer>
  );
}

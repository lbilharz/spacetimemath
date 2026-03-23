import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { BestScore, Classroom, ClassroomMember, OnlinePlayer, Player, ProblemStat, Session } from '../module_bindings/types.js';
import Leaderboard from '../components/Leaderboard.js';
import ScoringGuide from '../components/ScoringGuide.js';
import PageContainer from '../components/PageContainer.js';
import { PlayIcon } from '../components/Icons.js';

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
  const [bestScores]        = useTable(tables.best_scores);
  const [classrooms]        = useTable(tables.classrooms);
  const [classroomMembers]  = useTable(tables.classroom_members);
  const [onlinePlayers]     = useTable(tables.online_players);
  const [sessions]          = useTable(tables.sessions);
  const [problemStats]      = useTable(tables.problem_stats);
  const joinClassroom       = useSTDBReducer(reducers.joinClassroom);

  // Build the live players list: self first (pinned), then others sorted by username
  const allOnline = onlinePlayers as unknown as OnlinePlayer[];
  const selfEntry = allOnline.find(p => p.identity.toHexString() === myIdentityHex);
  const others = allOnline
    .filter(p => p.identity.toHexString() !== myIdentityHex)
    .sort((a, b) => a.username.localeCompare(b.username));
  const liveList = selfEntry ? [selfEntry, ...others] : others;
  // connectedAt per identity — used to ignore stale pre-connection sessions
  const connectedAtMap = new Map(
    allOnline.map(p => [p.identity.toHexString(), p.connectedAt])
  );
  // Only count a session as "active sprint" if it started after the player's current connection.
  // This filters out orphaned incomplete sessions from previous browser sessions.
  const sprintingIds = new Set(
    (sessions as unknown as Session[])
      .filter(s => {
        if (s.isComplete) return false;
        const connectedAt = connectedAtMap.get(s.playerIdentity.toHexString());
        return connectedAt !== undefined &&
          s.startedAt.microsSinceUnixEpoch >= connectedAt.microsSinceUnixEpoch;
      })
      .map(s => s.playerIdentity.toHexString())
  );

  // Sorted best scores for rank lookup in the live board
  const sortedBestScores = [...(bestScores as unknown as BestScore[])]
    .sort((a, b) => b.bestWeightedScore - a.bestWeightedScore);

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
                {' '}Tier {myPlayer.learningTier ?? 0}
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

      {/* Live Players */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 transition-colors">
        <h2 className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-green-500/30 bg-green-500/15 px-3 py-1 font-semibold text-green-700 dark:text-green-400 text-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          {t('lobby.onlineCount', { count: allOnline.length })}
        </h2>

        <div className={`overflow-y-auto ${liveList.length > 8 ? 'max-h-[264px] pr-2' : ''}`}>
          <table className="w-full border-collapse">
            <tbody>
              {liveList.map((p, index) => {
                const idHex = p.identity.toHexString();
                const isSelf = idHex === myIdentityHex;
                const isSprinting = sprintingIds.has(idHex);
                const rankIdx = sortedBestScores.findIndex(s => s.playerIdentity.toHexString() === idHex);
                const scoreEntry = rankIdx >= 0 ? sortedBestScores[rankIdx] : null;
                return (
                  <tr
                    key={idHex}
                    className={`${index !== liveList.length - 1 ? 'border-b border-slate-100 dark:border-slate-700/50' : ''} ${isSelf ? 'bg-brand-yellow/5' : 'bg-transparent'}`}
                  >
                    {/* Rank */}
                    <td className={`w-9 px-1 py-3 text-center text-sm font-bold tabular-nums ${rankIdx < 3 && rankIdx >= 0 ? 'text-brand-yellow' : 'text-slate-400 dark:text-slate-500'}`}>
                      {rankIdx < 0 ? '—' : rankIdx < 3 ? ['🥇','🥈','🥉'][rankIdx] : rankIdx + 1}
                    </td>
                    {/* Player name + tier */}
                    <td className={`px-2 py-3 text-sm ${isSelf ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                      <span>{p.username}</span>
                      {scoreEntry && (
                        <span className="ml-1.5 text-[11px]">
                          {TIER_EMOJI[Math.min(scoreEntry.learningTier, 7)]}
                        </span>
                      )}
                      {isSelf && (
                        <span className="ml-2 text-xs font-semibold text-brand-yellow">
                          {t('common.you')}
                        </span>
                      )}
                    </td>
                    {/* Score */}
                    <td className="w-[52px] px-1 py-3 text-right text-sm font-bold tabular-nums text-brand-yellow">
                      {scoreEntry ? scoreEntry.bestWeightedScore.toFixed(1) : '—'}
                    </td>
                    {/* Playing badge or empty */}
                    <td className="w-[110px] pl-2 py-3 text-right text-sm">
                      {isSprinting && (
                        <span className="inline-block rounded-md bg-green-500 px-2 py-1 text-[11px] font-bold tracking-wider uppercase text-white shadow-sm">
                          {t('lobby.sprinting')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Leaderboard */}
      <Leaderboard
        bestScores={bestScores as unknown as BestScore[]}
        myIdentityHex={myIdentityHex}
        myLearningTier={myPlayer?.learningTier ?? 0}
      />

      {/* Scoring Guide */}
      <ScoringGuide
        problemStats={problemStats as unknown as ProblemStat[]}
        playerLearningTier={myPlayer?.learningTier ?? 0}
      />
    </PageContainer>
  );
}

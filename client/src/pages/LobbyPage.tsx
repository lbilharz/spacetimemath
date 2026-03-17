import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { BestScore, Classroom, ClassroomMember, OnlinePlayer, ProblemStat, Session } from '../module_bindings/types.js';
import Leaderboard from '../components/Leaderboard.js';
import ScoringGuide from '../components/ScoringGuide.js';

const TIER_EMOJI = ['🌱', '🔨', '⚡', '🎯', '🔥', '💫', '🌟', '🏆'];

type Player = {
  identity: { toHexString(): string };
  username: string;
  bestScore: number;
  totalSessions: number;
  learningTier?: number;
  recoveryEmailed?: boolean;
};

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
  const startSession        = useSTDBReducer(reducers.startSession);
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

  const handleStart = async () => {
    setStarting(true);
    await startSession();
    onStartSprint(0n);
  };

  return (
    <div className="page">
      {/* Recovery key nag for teachers with students */}
      {showNag && (
        <div className="row-wrap gap-12" style={{
          background: 'rgba(251,186,0,0.12)', border: '1.5px solid var(--accent)',
          borderRadius: 10, padding: '12px 16px',
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <p className="flex-1 text-sm">
            {t('lobby.recoveryNag')}
          </p>
          <button className="btn btn-primary text-sm nowrap" onClick={onGoToAccount}>
            {t('lobby.recoveryNagCta')}
          </button>
        </div>
      )}

      {/* Welcome + Sprint CTA */}
      <div className="card col gap-16">
        {myPlayer && (
          <>
            <div>
              <h2 className="text-22 fw-extrabold mb-6">
                {t('lobby.hello', { name: myPlayer.username })} 👋
              </h2>
              <div className="row flex-wrap gap-12">
                <a
                  href="/progress#tier-status"
                  className="fw-semibold text-accent no-underline text-14"
                >
                  {TIER_EMOJI[Math.min(myPlayer.learningTier ?? 0, 7)]}
                  {' '}Tier {myPlayer.learningTier ?? 0}
                </a>
                <span className="text-muted text-12">·</span>
                <span className="text-muted text-14">
                  {t('lobby.bestScore')} <b className="text-warn">{myPlayer.bestScore.toFixed(1)}</b>
                </span>
                <span className="text-muted text-12">·</span>
                <span className="text-muted text-14">
                  {t('lobby.sessions', { count: myPlayer.totalSessions })}
                </span>
              </div>
            </div>
          </>
        )}
        <button
          className="btn btn-primary btn-lg w-full"
          onClick={handleStart}
          disabled={starting}
        >
          {starting ? t('lobby.starting') : t('lobby.startSprint')}
        </button>
      </div>

      {/* Live Players */}
      <div className="card">
        <h2 style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'rgba(93,210,60,0.15)', border: '1px solid rgba(93,210,60,0.35)',
          borderRadius: 20, padding: '3px 10px', fontWeight: 600, color: 'var(--green)', marginBottom: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'green', display: 'inline-block' }} />
          {t('lobby.onlineCount', { count: allOnline.length })}</h2>
        <div style={{
          maxHeight: liveList.length > 8 ? 264 : undefined,
          overflowY: 'auto',
          borderTop: liveList.length > 0 ? '1px solid var(--border)' : undefined,
        }}>
          <table className="table-full">
            <tbody>
              {liveList.map(p => {
                const idHex = p.identity.toHexString();
                const isSelf = idHex === myIdentityHex;
                const isSprinting = sprintingIds.has(idHex);
                const rankIdx = sortedBestScores.findIndex(s => s.playerIdentity.toHexString() === idHex);
                const scoreEntry = rankIdx >= 0 ? sortedBestScores[rankIdx] : null;
                return (
                  <tr
                    key={idHex}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isSelf ? 'rgba(251,186,0,0.08)' : 'transparent',
                    }}
                  >
                    {/* Rank */}
                    <td className="tbl-td text-center fw-bold tabular-nums" style={{
                      color: rankIdx < 3 && rankIdx >= 0 ? 'var(--warn)' : 'var(--muted)',
                      width: 36,
                      padding: '9px 4px',
                      fontSize: 14,
                    }}>
                      {rankIdx < 0 ? '—' : rankIdx < 3 ? ['🥇','🥈','🥉'][rankIdx] : rankIdx + 1}
                    </td>
                    {/* Player name + tier */}
                    <td className="tbl-td" style={{ padding: '9px 4px', fontSize: 14, fontWeight: isSelf ? 700 : 400 }}>
                      <span>{p.username}</span>
                      {scoreEntry && (
                        <span className="ml-6 text-11">
                          {TIER_EMOJI[Math.min(scoreEntry.learningTier, 7)]}
                        </span>
                      )}
                      {isSelf && (
                        <span className="text-accent ml-6 text-12">
                          {t('common.you')}
                        </span>
                      )}
                    </td>
                    {/* Score */}
                    <td className="tbl-td tbl-td--right fw-bold text-warn tabular-nums" style={{ padding: '9px 4px', fontSize: 14, width: 52 }}>
                      {scoreEntry ? scoreEntry.bestWeightedScore.toFixed(1) : '—'}
                    </td>
                    {/* Playing badge or empty */}
                    <td className="tbl-td tbl-td--right" style={{ padding: '9px 4px', fontSize: 14, width: 110 }}>
                      {isSprinting && (
                        <span className="badge-playing">
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
    </div>
  );
}

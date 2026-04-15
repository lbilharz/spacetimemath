import { useTranslation } from 'react-i18next';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings/index.js';
import type { Classroom, ClassroomMember, Friendship, Player } from '../module_bindings/types.js';
import Leaderboard, { LeaderboardRow } from './Leaderboard.js';

interface Props {
  myIdentityHex: string;
}

export default function NetworkLeaderboard({ myIdentityHex }: Props) {
  const { t } = useTranslation();
  const [friendships] = useTable(tables.my_friendships);
  const [classroomMembers] = useTable(tables.my_classroom_members);
  const [players] = useTable(tables.players);
  const [onlinePlayers] = useTable(tables.online_players);

  // 1. Gather all identities linked to the user
  const networkIdentities = new Set<string>();

  // Add self
  networkIdentities.add(myIdentityHex);

  // Add friends
  (friendships as unknown as Friendship[]).forEach(f => {
    const initHex = f.initiatorIdentity.toHexString();
    const recHex = f.recipientIdentity.toHexString();
    if (initHex === myIdentityHex) networkIdentities.add(recHex);
    if (recHex === myIdentityHex) networkIdentities.add(initHex);
  });

  // Add classmates where I am a member
  const myClassroomsAsMember = (classroomMembers as unknown as ClassroomMember[])
    .filter(m => m.playerIdentity.toHexString() === myIdentityHex && !m.hidden)
    .map(m => m.classroomId);

  // Add my owned classrooms where I am the teacher
  const [classrooms] = useTable(tables.my_classrooms);
  const myOwnedClassrooms = (classrooms as unknown as Classroom[])
    .filter(c => c.teacher?.toHexString() === myIdentityHex)
    .map(c => c.id);

  const allRelevantClassroomIds = Array.from(new Set([...myClassroomsAsMember, ...myOwnedClassrooms]));

  if (allRelevantClassroomIds.length > 0) {
    (classroomMembers as unknown as ClassroomMember[])
      .filter(m => allRelevantClassroomIds.includes(m.classroomId) && !m.hidden)
      .forEach(m => {
        networkIdentities.add(m.playerIdentity.toHexString());
      });

    (classrooms as unknown as Classroom[])
      .filter(c => allRelevantClassroomIds.includes(c.id) && c.teacher)
      .forEach(c => {
        networkIdentities.add(c.teacher!.toHexString());
      });
  }

  // 2. Fetch and aggregate player stats for these identities
  const leaderRows = Array.from(networkIdentities)
    .map(hex => {
      const p = (players as unknown as Player[]).find(player => player.identity.toHexString() === hex);
      if (!p) return null;
      const isOnline = Array.from(onlinePlayers as unknown as any[]).some(
        op => op.identity.toHexString() === hex && op.connectionCount > 0
      );

      return {
        id: hex,
        username: p.username,
        best: p.bestScore,
        playerType: p.playerType?.tag,
        isOnline,
      };
    })
    .filter(row => row !== null && row.best > 0) // Hide users with no score
    .sort((a, b) => b!.best - a!.best)
    .slice(0, 20); // Show top 20 max to avoid massive lists

  if (leaderRows.length <= 1) {
    // Hide entirely if it's only the user themselves with no one else to compare against
    return null;
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 transition-colors">
      <h2 className="mb-6 text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
        🏆 {t('lobby.networkLeaderboard', 'Network Leaderboard')}
      </h2>
      <Leaderboard rows={leaderRows as LeaderboardRow[]} myIdentityHex={myIdentityHex} />
    </div>
  );
}

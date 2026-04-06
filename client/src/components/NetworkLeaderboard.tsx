import { useTranslation } from 'react-i18next';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings/index.js';
import type { Classroom, ClassroomMember, Friendship, Player } from '../module_bindings/types.js';

interface Props {
  myIdentityHex: string;
}

export default function NetworkLeaderboard({ myIdentityHex }: Props) {
  const { t } = useTranslation();
  const [friendships] = useTable(tables.friendships);
  const [classroomMembers] = useTable(tables.classroom_members);
  const [players] = useTable(tables.players);

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
  const [classrooms] = useTable(tables.classrooms);
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
      return {
        id: hex,
        username: p.username,
        best: p.bestScore,
        playerType: p.playerType?.tag,
      };
    })
    .filter(row => row !== null && row.best > 0) // Hide users with no score
    .sort((a, b) => b!.best - a!.best)
    .slice(0, 20); // Show top 20 max to avoid massive lists

  if (leaderRows.length <= 1) {
    // Hide entirely if it's only the user themselves with no one else to compare against
    return null;
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 mb-6 transition-colors">
      <h2 className="mb-6 text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
        🏆 {t('lobby.networkLeaderboard', 'Network Leaderboard')}
      </h2>
      <div className="flex flex-col gap-2">
        {leaderRows.map((m, i) => {
          const isMe = m!.id === myIdentityHex;
          return (
            <div key={m!.id} className={`flex items-center gap-4 rounded-2xl p-4 transition-colors ${isMe ? 'bg-amber-50 dark:bg-amber-500/10 border border-brand-yellow/30' : 'bg-slate-50 dark:bg-slate-900/50 border border-transparent'}`}>
              <div className={`flex w-8 justify-center font-black ${i < 3 ? 'text-brand-yellow text-xl drop-shadow-sm' : 'text-slate-400'}`}>
                {i < 3 ? medals[i] : i + 1}
              </div>
              <div className={`flex-1 font-bold ${isMe ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                {m!.username}
                {isMe && <span className="ml-2 rounded-md bg-brand-yellow/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-400">{t('common.you')}</span>}
                {!isMe && m!.playerType === 'Teacher' && <span className="ml-2 rounded-md bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-widest text-slate-600 dark:text-slate-300">{t('common.teacher')}</span>}
              </div>
              <div className="font-black tabular-nums tracking-tight text-brand-yellow text-lg">
                {m!.best.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

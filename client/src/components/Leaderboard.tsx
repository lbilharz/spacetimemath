import { useTranslation } from 'react-i18next';

export interface LeaderboardRow {
  id: string;
  username: string;
  best: number;
  isOnline?: boolean;
  playerType?: string;
}

interface Props {
  rows: LeaderboardRow[];
  myIdentityHex: string;
  emptyMessage?: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ rows, myIdentityHex, emptyMessage }: Props) {
  const { t } = useTranslation();

  if (rows.length === 0 && emptyMessage) {
    return <p className="text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((m, i) => {
        const isMe = m.id === myIdentityHex;
        return (
          <div key={m.id} className={`flex items-center gap-4 rounded-2xl p-4 transition-colors ${isMe ? 'bg-amber-50 dark:bg-amber-500/10 border border-brand-yellow/30' : 'bg-slate-50 dark:bg-slate-900/50 border border-transparent'}`}>
            <div className={`flex w-8 justify-center font-black ${i < 3 ? 'text-brand-yellow text-xl drop-shadow-sm' : 'text-slate-400'}`}>
              {i < 3 ? MEDALS[i] : i + 1}
            </div>
            <div className={`flex-1 font-bold flex items-center ${isMe ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
              {m.username}
              {m.isOnline && !isMe && (
                <span className="relative flex h-2 w-2 ml-2" title="Online">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
              {isMe && (
                <span className="ml-2 rounded-md bg-brand-yellow/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-400">
                  {t('common.you')}
                </span>
              )}
              {!isMe && m.playerType === 'Teacher' && (
                <span className="ml-2 rounded-md bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-widest text-slate-600 dark:text-slate-300">
                  {t('common.teacher')}
                </span>
              )}
            </div>
            <div className="font-black tabular-nums tracking-tight text-brand-yellow text-lg">
              {m.best.toFixed(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

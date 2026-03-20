import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Session, Answer } from '../module_bindings/types.js';
import { getSessionMastery } from './MasteryGrid.js';

interface Props {
  sessions: Session[];
  answers:  Answer[];
  myIdentityHex: string | undefined;
}

export default function SprintHistory({ sessions, answers, myIdentityHex }: Props) {
  const { t, i18n } = useTranslation();
  const [sectionOpen, setSectionOpen] = useState(false);
  const [openId, setOpenId] = useState<bigint | null>(null);

  const mySessions = (sessions as Session[])
    .filter(s => s.isComplete && s.playerIdentity.toHexString() === myIdentityHex)
    .sort((a, b) => Number(b.startedAt.microsSinceUnixEpoch - a.startedAt.microsSinceUnixEpoch));

  if (mySessions.length === 0) return null;

  return (
    <div className="w-full">
      <button
        onClick={() => setSectionOpen(o => !o)}
        className="w-full flex items-center justify-between cursor-pointer group mb-2"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-brand-yellow/80 transition-colors m-0">
          {t('history.title')}
        </h2>
        <span className="text-sm font-bold text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-3 py-1 rounded-full group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
          {mySessions.length} · {sectionOpen ? '▲' : '▼'}
        </span>
      </button>

      {sectionOpen && (
        <div className="flex flex-col gap-8 mt-6 animate-in slide-in-from-top-2">
          {(() => {
            const grouped = mySessions.reduce((acc, session) => {
              const date = new Date(Number(session.startedAt.microsSinceUnixEpoch / 1000n));
              const now = new Date();
              const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
              
              const yesterday = new Date(now); 
              yesterday.setDate(now.getDate() - 1);
              const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
              
              let dateStr = date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
              if (isToday) dateStr = 'Heute'; // we can use translation if available, e.g. t('history.today')
              else if (isYesterday) dateStr = 'Gestern';

              if (!acc[dateStr]) acc[dateStr] = [];
              acc[dateStr].push(session);
              return acc;
            }, {} as Record<string, Session[]>);

            return Object.entries(grouped).map(([dateStr, sessionsForDate]) => (
              <div key={dateStr} className="flex flex-col gap-4">
                <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2 -mb-1">
                  {dateStr === 'Heute' ? t('history.today', 'Heute') : dateStr === 'Gestern' ? t('history.yesterday', 'Gestern') : dateStr}
                </h3>
                
                {sessionsForDate.map((session) => {
                  const isOpen = openId === session.id;
                  const date = new Date(Number(session.startedAt.microsSinceUnixEpoch / 1000n));
                  const timeStr = date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

                  const sessionAnswers = (answers as Answer[])
                    .filter(a => a.sessionId === session.id)
                    .sort((a, b) => Number(a.id - b.id));

                  const wrongCount = sessionAnswers.filter(a => !a.isCorrect).length;

                  return (
                    <div key={String(session.id)} className="flex flex-col rounded-[16px] overflow-hidden border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/30 transition-all">
                      {/* Session toggle */}
                      <button
                        onClick={() => setOpenId(isOpen ? null : session.id)}
                        className={`w-full flex flex-wrap items-center justify-between p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-yellow/50 rounded-t-[16px] ${!isOpen ? 'rounded-[16px]' : ''} ${isOpen ? 'bg-slate-100 dark:bg-slate-800/50' : ''}`}
                      >
                        <span className="text-sm font-black text-slate-500 w-16 text-left shrink-0">
                          {timeStr}
                        </span>
                        
                        <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-5 flex-1">
                          <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                            <span className="text-green-500 mr-1">✓</span> {session.rawScore}
                            <span className="text-slate-400 font-medium ml-0.5">/{session.totalAnswered}</span>
                          </span>
                          
                          {wrongCount > 0 && (
                            <span className="text-sm font-black text-red-500">
                              ✗ {wrongCount}
                            </span>
                          )}
                          
                          <span className={`text-sm font-black drop-shadow-sm min-w-[60px] text-right ${session.weightedScore > 0 ? 'text-amber-500 dark:text-brand-yellow' : 'text-slate-400 dark:text-slate-500'}`}>
                            {session.weightedScore.toFixed(1)} <span className="text-xs opacity-70">pts</span>
                          </span>
                          
                          <span className="text-xs font-bold text-slate-400 min-w-[40px] text-right hidden sm:inline-block">
                            {session.accuracyPct}%
                          </span>
                          
                          <span className="text-xs text-slate-400 ml-1">
                            {isOpen ? '▲' : '▼'}
                          </span>
                        </div>
                      </button>

                      {/* Expanded answers */}
                      {isOpen && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/50">
                          {sessionAnswers.length === 0 ? (
                            <p className="text-slate-500 text-sm font-medium">{t('history.noAnswers')}</p>
                          ) : (
                            <div className="columns-1 md:columns-2 gap-8">
                              {sessionAnswers.map((ans) => {
                                const correct = ans.a * ans.b;
                                const ms = ans.responseMs ?? 0;
                                const msLabel = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
                                const attempts = Math.max(1, (ans as any).attempts ?? 1);
                                
                                const m = getSessionMastery(ans);
                                let colorClass = '';
                                if (m === 'mastered') colorClass = 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400';
                                else if (m === 'learning') colorClass = 'bg-yellow-500/10 border-yellow-500/40 text-yellow-700 dark:text-yellow-500';
                                else colorClass = 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400';

                                return (
                                  <div
                                    key={String(ans.id)}
                                    className={`flex items-center break-inside-avoid mb-3 gap-2 p-2 rounded-xl border ${colorClass}`}
                                  >
                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200 min-w-[36px] tracking-tight">
                                      {ans.a}×{ans.b}
                                    </span>
                                    <span className="text-slate-400 dark:text-slate-500 text-xs">=</span>
                                    <span className="font-black text-[15px]">
                                      {ans.userAnswer}
                                    </span>
                                    {!ans.isCorrect && (
                                      <span className="text-[11px] font-bold opacity-60 ml-0.5">
                                        → {correct}
                                      </span>
                                    )}
                                    <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                                      {attempts > 1 && (
                                        <span className="text-[10px] font-black opacity-50 bg-slate-200/50 dark:bg-slate-800/50 px-1 rounded-sm">
                                          {attempts}x
                                        </span>
                                      )}
                                      <span className="text-[11px] font-bold opacity-70">
                                        {msLabel}
                                      </span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

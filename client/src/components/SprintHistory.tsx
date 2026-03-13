import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Session, Answer } from '../module_bindings/types.js';

interface Props {
  sessions: Session[];
  answers:  Answer[];
  myIdentityHex: string | undefined;
}

export default function SprintHistory({ sessions, answers, myIdentityHex }: Props) {
  const { t, i18n } = useTranslation();
  const [sectionOpen, setSectionOpen] = useState(false);
  const [openId, setOpenId] = useState<bigint | null>(null);

  const mySessions: Session[] = (sessions as Session[])
    .filter(s => s.isComplete && s.playerIdentity.toHexString() === myIdentityHex)
    .sort((a, b) => Number(b.startedAt.microsSinceUnixEpoch - a.startedAt.microsSinceUnixEpoch));

  if (mySessions.length === 0) return null;

  return (
    <div className="card">
      <button
        onClick={() => setSectionOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text)', padding: 0, marginBottom: sectionOpen ? 12 : 0,
        }}
      >
        <h2 style={{ margin: 0 }}>{t('history.title')}</h2>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {mySessions.length} · {sectionOpen ? '▲' : '▼'}
        </span>
      </button>
      {sectionOpen && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mySessions.map((session: Session) => {
          const isOpen = openId === session.id;
          const date = new Date(Number(session.startedAt.microsSinceUnixEpoch / 1000n));
          const dateStr = date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
          const timeStr = date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

          const sessionAnswers: Answer[] = (answers as Answer[])
            .filter(a => a.sessionId === session.id)
            .sort((a, b) => {
              // Wrong answers first; within each group sort by pair
              if (a.isCorrect !== b.isCorrect) return a.isCorrect ? 1 : -1;
              return a.a !== b.a ? a.a - b.a : a.b - b.b;
            });

          const wrongCount = sessionAnswers.filter(a => !a.isCorrect).length;

          return (
            <div key={String(session.id)}>
              {/* Session row / toggle */}
              <button
                onClick={() => setOpenId(isOpen ? null : session.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: isOpen ? '6px 6px 0 0' : 6,
                  background: isOpen ? 'var(--card2)' : 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  textAlign: 'left',
                  gap: 8,
                  transition: 'border-color 0.15s',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 90 }}>
                  {dateStr} · {timeStr}
                </span>
                <span style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13 }}>
                    ✓ {session.rawScore}
                    <span style={{ color: 'var(--muted)', fontWeight: 400 }}>/{session.totalAnswered}</span>
                  </span>
                  {wrongCount > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--wrong)', fontWeight: 600 }}>
                      ✗ {wrongCount}
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: 'var(--warn)', fontWeight: 600 }}>
                    {session.weightedScore.toFixed(1)} pts
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {session.accuracyPct}%
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{isOpen ? '▲' : '▼'}</span>
                </span>
              </button>

              {/* Expanded answer breakdown */}
              {isOpen && (
                <div style={{
                  padding: '10px 10px',
                  border: '1px solid var(--accent)',
                  borderTop: 'none',
                  borderRadius: '0 0 6px 6px',
                  background: 'var(--card2)',
                }}>
                  {sessionAnswers.length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: 13 }}>{t('history.noAnswers')}</p>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
                      gap: 4,
                    }}>
                      {sessionAnswers.map((ans: Answer) => {
                        const correct = ans.a * ans.b;
                        const ms = ans.responseMs;
                        const msLabel = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
                        return (
                          <div
                            key={String(ans.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 13,
                              padding: '4px 7px',
                              borderRadius: 5,
                              background: ans.isCorrect
                                ? 'rgba(93,210,60,0.10)'
                                : 'rgba(232,57,29,0.10)',
                              border: ans.isCorrect
                                ? '1px solid rgba(93,210,60,0.3)'
                                : '1px solid rgba(232,57,29,0.3)',
                            }}
                          >
                            {/* Problem */}
                            <span style={{ fontWeight: 700, minWidth: 40 }}>
                              {ans.a}×{ans.b}
                            </span>
                            <span style={{ color: 'var(--muted)' }}>=</span>
                            {/* What they typed */}
                            <span style={{
                              fontWeight: 700,
                              color: ans.isCorrect ? 'var(--accent)' : 'var(--wrong)',
                            }}>
                              {ans.userAnswer}
                            </span>
                            {/* Correct answer hint */}
                            {!ans.isCorrect && (
                              <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                                →{correct}
                              </span>
                            )}
                            {/* Response time */}
                            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                              {msLabel}
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
      </div>}
    </div>
  );
}

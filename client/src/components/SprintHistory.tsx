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
        className="row-between w-full"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text)', padding: 0, marginBottom: sectionOpen ? 12 : 0,
        }}
      >
        <h2 style={{ margin: 0 }}>{t('history.title')}</h2>
        <span className="text-xs text-muted">
          {mySessions.length} · {sectionOpen ? '▲' : '▼'}
        </span>
      </button>
      {sectionOpen && <div className="col gap-6">
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
                <span className="text-sm text-muted" style={{ minWidth: 90 }}>
                  {dateStr} · {timeStr}
                </span>
                <span className="row gap-12 row-wrap">
                  <span className="text-sm">
                    ✓ {session.rawScore}
                    <span className="text-muted" style={{ fontWeight: 400 }}>/{session.totalAnswered}</span>
                  </span>
                  {wrongCount > 0 && (
                    <span className="text-xs fw-semibold text-error">
                      ✗ {wrongCount}
                    </span>
                  )}
                  <span className="text-sm fw-semibold text-warn">
                    {session.weightedScore.toFixed(1)} pts
                  </span>
                  <span className="text-xs text-muted">
                    {session.accuracyPct}%
                  </span>
                  <span className="text-xs text-muted">{isOpen ? '▲' : '▼'}</span>
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
                    <p className="text-muted text-sm">{t('history.noAnswers')}</p>
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
                            className="row gap-4 text-sm"
                            style={{
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
                            <span className="fw-bold" style={{ minWidth: 40 }}>
                              {ans.a}×{ans.b}
                            </span>
                            <span className="text-muted">=</span>
                            {/* What they typed */}
                            <span className="fw-bold" style={{
                              color: ans.isCorrect ? 'var(--accent)' : 'var(--wrong)',
                            }}>
                              {ans.userAnswer}
                            </span>
                            {/* Correct answer hint */}
                            {!ans.isCorrect && (
                              <span className="text-xs text-muted">
                                →{correct}
                              </span>
                            )}
                            {/* Response time */}
                            <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 10, flexShrink: 0 }}>
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

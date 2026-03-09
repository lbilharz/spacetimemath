import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings/index.js';
import { getRechenweg } from '../utils/rechenwege.js';
import MasteryGrid from '../components/MasteryGrid.js';

type Session = {
  id: bigint; playerIdentity: { toHexString(): string };
  weightedScore: number; rawScore: number; accuracyPct: number;
  totalAnswered: number; isComplete: boolean;
};
type Answer = {
  id: bigint; playerIdentity: { toHexString(): string }; sessionId: bigint;
  a: number; b: number; isCorrect: boolean; responseMs: number;
};

interface Props {
  sessionId: bigint;
  myIdentityHex: string;
  onBack: () => void;
}

export default function ResultsPage({ sessionId, myIdentityHex, onBack }: Props) {
  const { t } = useTranslation();
  const [sessions] = useTable(tables.sessions);
  const [allAnswers] = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);
  const [unlockLogs] = useTable(tables.unlock_logs);

  const session = sessions.find(s => (s as Session).id === sessionId) as Session | undefined;

  const tier1Unlocked = (unlockLogs as any[]).some(
    (u: any) => u.playerIdentity.toHexString() === myIdentityHex && u.tier === 1
  );
  // Detect fresh unlock this session: compare unlock timestamp to session start
  const myUnlock = (unlockLogs as any[]).find(
    (u: any) => u.playerIdentity.toHexString() === myIdentityHex && u.tier === 1
  );
  const sessionRow = sessions.find(s => (s as any).id === sessionId) as any;
  const isNewUnlock = myUnlock && sessionRow &&
    myUnlock.unlockedAt.microsSinceUnixEpoch >= sessionRow.startedAt.microsSinceUnixEpoch;
  const myAnswers = allAnswers.filter(a => a.playerIdentity.toHexString() === myIdentityHex) as Answer[];
  const sessionAnswers = myAnswers.filter(a => a.sessionId === sessionId);

  // Rank in leaderboard
  const completedSessions = sessions.filter(s => (s as Session).isComplete) as Session[];
  const sorted = [...completedSessions].sort((a, b) => b.weightedScore - a.weightedScore);
  const myRank = sorted.findIndex(s => s.id === sessionId) + 1;

  // Top 3 hardest pairs this session (wrong answers by difficulty weight)
  const wrongPairs = sessionAnswers
    .filter(ans => !ans.isCorrect)
    .map(ans => ({
      key: `${ans.a}×${ans.b}`,
      a: ans.a, b: ans.b,
      weight: (problemStats as any[]).find(s => s.problemKey === ans.a * 100 + ans.b)?.difficultyWeight ?? 1,
    }));
  const uniqueHard = [...new Map(wrongPairs.map(p => [p.key, p])).values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [gridFocus, setGridFocus] = useState<{ a: number; b: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isComplete = session?.isComplete ?? false;

  return (
    <div className="page" style={{ alignItems: 'center' }}>
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 4 }}>🏁</div>
        <h1>{t('results.heading')}</h1>
      </div>

      {/* New-unlock toast */}
      {isNewUnlock && (
        <div className="card" style={{ width: '100%', border: '1px solid var(--accent)', textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>🔓</div>
          <h2 style={{ color: 'var(--accent)', margin: '8px 0 4px' }}>{t('unlock.tier1Earned' as any)}</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{t('unlock.tier1EarnedDesc' as any)}</p>
        </div>
      )}

      {/* Score card */}
      <div className="card" style={{ width: '100%', textAlign: 'center' }}>
        {!isComplete ? (
          <p style={{ color: 'var(--muted)' }}>{t('results.finalizing')}</p>
        ) : (
          <>
            <div style={{
              fontSize: 72,
              fontWeight: 800,
              color: 'var(--warn)',
              lineHeight: 1,
              marginBottom: 8,
            }}>
              {session!.weightedScore.toFixed(1)}
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>{t('results.weightedScore')}</p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              marginTop: 24,
              padding: '20px 0',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}>
              <Stat label={t('results.correct')} value={`${session!.rawScore} / ${session!.totalAnswered}`} />
              <Stat label={t('results.accuracy')} value={`${session!.accuracyPct}%`} />
              <Stat label={t('results.rank')} value={myRank ? `#${myRank}` : '—'} accent />
            </div>

            {uniqueHard.length > 0 && (
              <div style={{ marginTop: 20, textAlign: 'left' }}>
                <h3 style={{ marginBottom: 12 }}>{t('results.struggled')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {uniqueHard.map(p => {
                    const rw = getRechenweg(p.a, p.b);
                    const isOpen = expandedKey === p.key;
                    return (
                      <div key={p.key}>
                        <button
                          onClick={() => {
                            setExpandedKey(isOpen ? null : p.key);
                            setGridFocus({ a: p.a, b: p.b });
                            setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '2px 0', width: '100%', textAlign: 'left',
                          }}
                        >
                          <span className="tag tag-red" style={{ fontSize: 14, padding: '4px 12px' }}>
                            {p.key} = {p.a * p.b}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {isOpen ? '▲' : '▼'}
                          </span>
                        </button>
                        {isOpen && (
                          <div style={{
                            background: 'var(--card2)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            padding: '10px 14px',
                            marginTop: 4,
                          }}>
                            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {t(rw.strategyKey as any)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {rw.steps.map((step, i) => (
                                <div key={i} style={{
                                  fontSize: 15,
                                  fontVariantNumeric: 'tabular-nums',
                                  fontWeight: i === rw.steps.length - 1 ? 700 : 400,
                                  color: i === rw.steps.length - 1 ? 'var(--accent)' : 'var(--text)',
                                }}>
                                  {step}{i === rw.steps.length - 1 ? ' ✓' : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                  {t('results.struggledHint')}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mastery grid */}
      {myAnswers.length > 0 && (
        <div ref={gridRef} className="card" style={{ width: '100%' }}>
          <h2 style={{ marginBottom: 4 }}>{t('results.masteryTitle')}</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {t('results.masteryDesc')}
          </p>
          <MasteryGrid
            answers={myAnswers}
            problemStats={problemStats as any[]}
            highlightSession={sessionId}
            sessionAnswers={sessionAnswers}
            tier1Unlocked={tier1Unlocked}
            focusCell={gridFocus}
          />
        </div>
      )}

      <button className="btn btn-primary btn-lg" onClick={onBack} style={{ width: '100%', maxWidth: 320 }}>
        {t('results.backToLobby')}
      </button>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: accent ? 'var(--accent)' : 'var(--text)',
      }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

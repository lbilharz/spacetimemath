import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings/index.js';
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
  const [sessions] = useTable(tables.sessions);
  const [allAnswers] = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);
  const [players] = useTable(tables.players);

  const session = sessions.find(s => (s as Session).id === sessionId) as Session | undefined;
  const myAnswers = allAnswers.filter(a => a.playerIdentity.toHexString() === myIdentityHex) as Answer[];
  const sessionAnswers = myAnswers.filter(a => a.sessionId === sessionId);

  // Rank in leaderboard
  const completedSessions = sessions.filter(s => (s as Session).isComplete) as Session[];
  const sorted = [...completedSessions].sort((a, b) => b.weightedScore - a.weightedScore);
  const myRank = sorted.findIndex(s => s.id === sessionId) + 1;

  // Top 3 hardest pairs this session (wrong answers by difficulty weight)
  const wrongPairs = sessionAnswers
    .filter(a => !a.isCorrect)
    .map(a => ({
      key: `${a.a}×${a.b}`,
      weight: (problemStats as any[]).find(s => s.problemKey === a.a * 100 + a.b)?.difficultyWeight ?? 1,
    }));
  const uniqueHard = [...new Map(wrongPairs.map(p => [p.key, p])).values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  const isComplete = session?.isComplete ?? false;

  return (
    <div className="page" style={{ alignItems: 'center' }}>
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 4 }}>🏁</div>
        <h1>Session Complete!</h1>
      </div>

      {/* Score card */}
      <div className="card" style={{ width: '100%', textAlign: 'center' }}>
        {!isComplete ? (
          <p style={{ color: 'var(--muted)' }}>Finalizing session…</p>
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
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>weighted score</p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              marginTop: 24,
              padding: '20px 0',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}>
              <Stat label="Correct" value={`${session!.rawScore} / ${session!.totalAnswered}`} />
              <Stat label="Accuracy" value={`${session!.accuracyPct}%`} />
              <Stat label="Rank" value={myRank ? `#${myRank}` : '—'} accent />
            </div>

            {uniqueHard.length > 0 && (
              <div style={{ marginTop: 20, textAlign: 'left' }}>
                <h3 style={{ marginBottom: 8 }}>You struggled with:</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {uniqueHard.map(p => (
                    <span key={p.key} className="tag tag-red" style={{ fontSize: 14, padding: '4px 12px' }}>
                      {p.key}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  These will appear more often in your next sprint.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mastery grid */}
      {myAnswers.length > 0 && (
        <div className="card" style={{ width: '100%' }}>
          <h2 style={{ marginBottom: 4 }}>Mastery Grid</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Your cumulative knowledge map across all sessions.
          </p>
          <MasteryGrid answers={myAnswers} problemStats={problemStats as any[]} highlightSession={sessionId} sessionAnswers={sessionAnswers} />
        </div>
      )}

      <button className="btn btn-primary btn-lg" onClick={onBack} style={{ width: '100%', maxWidth: 320 }}>
        Back to Lobby
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

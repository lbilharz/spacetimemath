import { useState } from 'react';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import MasteryGrid from '../components/MasteryGrid.js';
import Leaderboard from '../components/Leaderboard.js';

type Player = { identity: { toHexString(): string }; username: string; bestScore: number; totalSessions: number; };

interface Props {
  myPlayer: Player | undefined;
  myIdentityHex: string | undefined;
  onStartSprint: (sessionId: bigint) => void;
  onAccount: () => void;
}

export default function LobbyPage({ myPlayer, myIdentityHex, onStartSprint, onAccount }: Props) {
  const [sessions] = useTable(tables.sessions);
  const [answers] = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);
  const [starting, setStarting] = useState(false);
  const startSession = useSTDBReducer(reducers.startSession);

  const myAnswers = answers.filter(a => a.playerIdentity.toHexString() === myIdentityHex);

  const handleStart = async () => {
    setStarting(true);
    await startSession();
    // The SprintPage will pick up the new session from the sessions table
    // We navigate immediately; SprintPage handles session detection
    onStartSprint(0n); // placeholder — SprintPage reads the real id from DB
  };

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>⚡ Math Sprint</h1>
          {myPlayer && (
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 2 }}>
              Welcome back, <b style={{ color: 'var(--text)' }}>{myPlayer.username}</b>
              {' · '}Best score: <b style={{ color: 'var(--warn)' }}>{myPlayer.bestScore.toFixed(1)}</b>
              {' · '}{myPlayer.totalSessions} sessions
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={onAccount}
            style={{ fontSize: 14 }}
          >
            ⚙ Account
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleStart}
            disabled={starting}
            style={{ minWidth: 160 }}
          >
            {starting ? 'Starting…' : '▶ Start Sprint'}
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      <Leaderboard sessions={sessions as any[]} myIdentityHex={myIdentityHex} />

      {/* Mastery Grid */}
      {myIdentityHex && (
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>My Mastery Grid</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Each cell = one ordered pair. Green = mastered, yellow = learning, red = struggling, gray = untouched.
          </p>
          <MasteryGrid answers={myAnswers as any[]} problemStats={problemStats as any[]} />
        </div>
      )}
    </div>
  );
}

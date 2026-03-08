import { useState } from 'react';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import MasteryGrid from '../components/MasteryGrid.js';

interface Props {
  myIdentityHex: string;
  onStartSprint: (sessionId: bigint) => void;
  onLeave: () => void;
  onAccount: () => void;
}

export default function ClassroomPage({ myIdentityHex, onStartSprint, onLeave, onAccount }: Props) {
  const [classrooms] = useTable(tables.classrooms);
  const [classroomMembers] = useTable(tables.classroom_members);
  const [sessions] = useTable(tables.sessions);
  const [answers] = useTable(tables.answers);
  const [players] = useTable(tables.players);
  const [problemStats] = useTable(tables.problem_stats);

  const leaveClassroom = useSTDBReducer(reducers.leaveClassroom);
  const startSession = useSTDBReducer(reducers.startSession);

  const [codeCopied, setCodeCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Derive my classroom
  const myMembership = (classroomMembers as any[]).find(
    m => m.playerIdentity.toHexString() === myIdentityHex
  );
  const myClassroom = myMembership
    ? (classrooms as any[]).find(c => c.id === myMembership.classroomId)
    : null;

  if (!myClassroom) {
    return (
      <div className="loading">
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Classroom not found</span>
      </div>
    );
  }

  const isTeacher = myClassroom.teacher.toHexString() === myIdentityHex;

  // Members of this classroom
  const members = (classroomMembers as any[]).filter(m => m.classroomId === myClassroom.id);
  const memberIds = new Set(members.map((m: any) => m.playerIdentity.toHexString()));

  // Best weighted score per member (across all time)
  const bestByMember = new Map<string, number>();
  for (const s of sessions as any[]) {
    if (!s.isComplete || !memberIds.has(s.playerIdentity.toHexString())) continue;
    const id = s.playerIdentity.toHexString();
    if ((bestByMember.get(id) ?? 0) < s.weightedScore) {
      bestByMember.set(id, s.weightedScore);
    }
  }

  // Member rows enriched with player info, sorted by best score
  const memberRows = members.map((m: any) => {
    const id = m.playerIdentity.toHexString();
    const player = (players as any[]).find(p => p.identity.toHexString() === id);
    return { id, username: player?.username ?? id.slice(0, 8), best: bestByMember.get(id) };
  }).sort((a, b) => (b.best ?? 0) - (a.best ?? 0));

  // All answers from class members (for aggregate mastery grid)
  const classAnswers = (answers as any[]).filter(a => memberIds.has(a.playerIdentity.toHexString()));

  const handleStart = async () => {
    setStarting(true);
    await startSession();
    onStartSprint(0n);
  };

  const handleLeave = async () => {
    setLeaving(true);
    await leaveClassroom();
    onLeave();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(myClassroom.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>📚 {myClassroom.name}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 2 }}>
            {isTeacher ? 'You are teaching' : 'You are a student'} · {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onAccount} style={{ fontSize: 14 }}>⚙ Account</button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleStart}
            disabled={starting}
            style={{ minWidth: 140 }}
          >
            {starting ? 'Starting…' : '▶ Start Sprint'}
          </button>
        </div>
      </div>

      {/* Join code */}
      <div className="card">
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>Join code</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{
            fontFamily: 'monospace',
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: 10,
            color: 'var(--accent)',
          }}>
            {myClassroom.code}
          </div>
          <button className="btn btn-secondary" onClick={handleCopyCode} style={{ fontSize: 13 }}>
            {codeCopied ? '✓ Copied' : '⎘ Copy'}
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
          Students enter this code on the register screen under "Restore existing account → Join class".
        </p>
      </div>

      {/* Members + Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {/* Members */}
        <div className="card">
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>Members</h2>
          {memberRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No members yet.</p>
          ) : (
            memberRows.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < memberRows.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontWeight: m.id === myIdentityHex ? 700 : 400 }}>
                  {m.username}
                  {m.id === myIdentityHex && (
                    <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 12 }}>you</span>
                  )}
                </span>
                {m.best !== undefined ? (
                  <span style={{ color: 'var(--warn)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                    {m.best.toFixed(1)}
                  </span>
                ) : (
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>no sessions</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Class leaderboard */}
        <div className="card">
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>🏆 Class Leaderboard</h2>
          {memberRows.filter(m => m.best !== undefined).length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>Start sprinting to populate the board!</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={th}>#</th>
                  <th style={{ ...th, textAlign: 'left' }}>Player</th>
                  <th style={th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {memberRows
                  .filter(m => m.best !== undefined)
                  .map((m, i) => {
                    const isMe = m.id === myIdentityHex;
                    return (
                      <tr key={m.id} style={{
                        borderBottom: '1px solid var(--border)',
                        background: isMe ? 'rgba(0,212,170,0.05)' : 'transparent',
                      }}>
                        <td style={{ ...td, fontWeight: 700, color: i < 3 ? 'var(--warn)' : 'var(--muted)', textAlign: 'center' }}>
                          {i < 3 ? medals[i] : i + 1}
                        </td>
                        <td style={{ ...td, fontWeight: isMe ? 700 : 400 }}>
                          {m.username}
                          {isMe && <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 12 }}>you</span>}
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--warn)', fontVariantNumeric: 'tabular-nums' }}>
                          {m.best!.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            Best session score · Live via SpaceTimeDB
          </p>
        </div>
      </div>

      {/* Class mastery grid */}
      {classAnswers.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 4, fontSize: 16 }}>Class Mastery Grid</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Aggregate accuracy across all {members.length} class members.
          </p>
          <MasteryGrid answers={classAnswers} problemStats={problemStats as any[]} />
        </div>
      )}

      {/* Leave / Close */}
      <div>
        <button
          className="btn btn-secondary"
          onClick={handleLeave}
          disabled={leaving}
          style={{ fontSize: 14 }}
        >
          {leaving ? 'Leaving…' : isTeacher ? '✕ Close class' : '← Leave class'}
        </button>
        {isTeacher && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            Closing the class removes all members from the session.
          </p>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '8px 4px', fontSize: 12, fontWeight: 600, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right',
};
const td: React.CSSProperties = { padding: '10px 4px', fontSize: 15 };

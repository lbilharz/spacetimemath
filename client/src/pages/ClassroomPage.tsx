import { useState } from 'react';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import MasteryGrid from '../components/MasteryGrid.js';
import { QRCodeSVG } from 'qrcode.react';

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
  const toggleVisibility = useSTDBReducer(reducers.toggleClassroomVisibility);

  const [codeCopied, setCodeCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [togglingVis, setTogglingVis] = useState(false);

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
  const amHidden: boolean = myMembership?.hidden ?? false;

  // All members of this classroom
  const members = (classroomMembers as any[]).filter(m => m.classroomId === myClassroom.id);
  // Visible members (included in leaderboard + mastery)
  const visibleMembers = members.filter((m: any) => !m.hidden);
  const visibleIds = new Set(visibleMembers.map((m: any) => m.playerIdentity.toHexString()));

  // Best weighted score per VISIBLE member (across all time)
  const bestByMember = new Map<string, number>();
  for (const s of sessions as any[]) {
    if (!s.isComplete || !visibleIds.has(s.playerIdentity.toHexString())) continue;
    const id = s.playerIdentity.toHexString();
    if ((bestByMember.get(id) ?? 0) < s.weightedScore) {
      bestByMember.set(id, s.weightedScore);
    }
  }

  // All member rows (for the Members card — shows everyone)
  const memberIds = new Set(members.map((m: any) => m.playerIdentity.toHexString()));
  const memberRows = members.map((m: any) => {
    const id = m.playerIdentity.toHexString();
    const player = (players as any[]).find(p => p.identity.toHexString() === id);
    return { id, username: player?.username ?? id.slice(0, 8), best: bestByMember.get(id), hidden: m.hidden as boolean };
  }).sort((a, b) => (b.best ?? 0) - (a.best ?? 0));

  // Leaderboard rows — visible only, sorted by best score
  const leaderRows = memberRows.filter(m => !m.hidden && m.best !== undefined);

  // Mastery grid — only answers from visible members
  const classAnswers = (answers as any[]).filter(a => visibleIds.has(a.playerIdentity.toHexString()));

  const handleToggleVisibility = async () => {
    setTogglingVis(true);
    await toggleVisibility();
    setTogglingVis(false);
  };

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
    navigator.clipboard.writeText(`${window.location.origin}/?join=${myClassroom.code}`);
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

      {/* Join code + QR */}
      <div className="card">
        <h2 style={{ marginBottom: 12, fontSize: 16 }}>Join code</h2>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: 10,
              color: 'var(--accent)',
              marginBottom: 8,
            }}>
              {myClassroom.code}
            </div>
            <button className="btn btn-secondary" onClick={handleCopyCode} style={{ fontSize: 13 }}>
              {codeCopied ? '✓ Copied' : '⎘ Copy link'}
            </button>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, maxWidth: 220 }}>
              Students scan the QR code or type the code in the lobby.
            </p>
          </div>
          <div style={{ background: '#fff', padding: 8, borderRadius: 8, lineHeight: 0 }}>
            <QRCodeSVG
              value={`${window.location.origin}/?join=${myClassroom.code}`}
              size={120}
            />
          </div>
        </div>
      </div>

      {/* Members + Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {/* Members */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16 }}>Members</h2>
            <button
              className="btn btn-secondary"
              onClick={handleToggleVisibility}
              disabled={togglingVis}
              style={{ fontSize: 12, padding: '4px 10px' }}
              title={amHidden ? 'Your stats are hidden from this class. Click to show.' : 'Hide your stats from this class.'}
            >
              {amHidden ? '👁 Show my stats' : '🙈 Hide my stats'}
            </button>
          </div>
          {amHidden && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, fontStyle: 'italic' }}>
              Your stats are hidden from this class's leaderboard and mastery grid.
            </p>
          )}
          {memberRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No members yet.</p>
          ) : (
            memberRows.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < memberRows.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: m.hidden ? 0.5 : 1,
              }}>
                <span style={{ fontWeight: m.id === myIdentityHex ? 700 : 400 }}>
                  {m.username}
                  {m.id === myIdentityHex && (
                    <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 12 }}>you</span>
                  )}
                  {m.hidden && (
                    <span style={{ color: 'var(--muted)', marginLeft: 6, fontSize: 11 }}>hidden</span>
                  )}
                </span>
                {!m.hidden && m.best !== undefined ? (
                  <span style={{ color: 'var(--warn)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                    {m.best.toFixed(1)}
                  </span>
                ) : (
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {m.hidden ? '—' : 'no sessions'}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Class leaderboard */}
        <div className="card">
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>🏆 Class Leaderboard</h2>
          {leaderRows.length === 0 ? (
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
                {leaderRows.map((m, i) => {
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
            Aggregate accuracy across {visibleMembers.length} visible member{visibleMembers.length !== 1 ? 's' : ''}.
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

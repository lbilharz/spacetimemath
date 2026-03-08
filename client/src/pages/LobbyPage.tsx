import { useState, FormEvent, useEffect } from 'react';
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
  onEnterClassroom: () => void;
}

type ClassroomPanel = 'none' | 'create' | 'join';

export default function LobbyPage({ myPlayer, myIdentityHex, onStartSprint, onAccount, onEnterClassroom }: Props) {
  const [sessions] = useTable(tables.sessions);
  const [answers] = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);
  const [classrooms] = useTable(tables.classrooms);
  const [classroomMembers] = useTable(tables.classroom_members);

  const [starting, setStarting] = useState(false);
  const [panel, setPanel] = useState<ClassroomPanel>('none');
  const [className, setClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [classError, setClassError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const startSession = useSTDBReducer(reducers.startSession);
  const createClassroom = useSTDBReducer(reducers.createClassroom);
  const joinClassroom = useSTDBReducer(reducers.joinClassroom);

  const myAnswers = answers.filter(a => a.playerIdentity.toHexString() === myIdentityHex);

  // Check if already in a classroom
  const myMembership = myIdentityHex
    ? (classroomMembers as any[]).find(m => m.playerIdentity.toHexString() === myIdentityHex)
    : null;
  const myClassroom = myMembership
    ? (classrooms as any[]).find(c => c.id === myMembership.classroomId)
    : null;

  // Auto-join from ?join=CODE URL param (QR code scan)
  useEffect(() => {
    if (!myPlayer) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (!code) return;
    window.history.replaceState({}, '', '/');
    joinClassroom({ code: code.trim().toUpperCase() })
      .then(() => onEnterClassroom())
      .catch(() => {/* ignore — user can join manually */});
  }, [myPlayer?.identity]);

  const handleStart = async () => {
    setStarting(true);
    await startSession();
    onStartSprint(0n);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = className.trim();
    if (!name) return;
    setSubmitting(true);
    setClassError('');
    try {
      await createClassroom({ name });
      onEnterClassroom();
    } catch (err: any) {
      setClassError(err?.message ?? 'Failed to create classroom');
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) return;
    setSubmitting(true);
    setClassError('');
    try {
      await joinClassroom({ code });
      onEnterClassroom();
    } catch (err: any) {
      setClassError(err?.message ?? 'Classroom not found');
      setSubmitting(false);
    }
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onAccount} style={{ fontSize: 14 }}>⚙ Account</button>
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

      {/* Classroom section */}
      {myClassroom ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>You're in a class: </span>
            <b style={{ color: 'var(--accent)' }}>{myClassroom.name}</b>
            <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>
              code: <code style={{ color: 'var(--text)' }}>{myClassroom.code}</code>
            </span>
          </div>
          <button className="btn btn-primary" onClick={onEnterClassroom} style={{ fontSize: 14 }}>
            📚 View classroom →
          </button>
        </div>
      ) : panel === 'none' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => { setPanel('create'); setClassError(''); }}
            style={{ fontSize: 13 }}
          >
            + Create class
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => { setPanel('join'); setClassError(''); }}
            style={{ fontSize: 13 }}
          >
            → Join class
          </button>
        </div>
      ) : panel === 'create' ? (
        <div className="card">
          <h2 style={{ marginBottom: 8, fontSize: 16 }}>Create a classroom</h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="field"
              type="text"
              placeholder="Class name (e.g. 3B Mathe)"
              value={className}
              onChange={e => setClassName(e.target.value)}
              maxLength={40}
              autoFocus
              disabled={submitting}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button className="btn btn-primary" type="submit" disabled={submitting || !className.trim()}>
              {submitting ? 'Creating…' : 'Create →'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setPanel('none')} disabled={submitting}>
              Cancel
            </button>
          </form>
          {classError && <p style={{ color: 'var(--wrong)', fontSize: 13, marginTop: 8 }}>⚠ {classError}</p>}
        </div>
      ) : (
        <div className="card">
          <h2 style={{ marginBottom: 8, fontSize: 16 }}>Join a classroom</h2>
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="field"
              type="text"
              placeholder="6-char code"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoFocus
              disabled={submitting}
              style={{ width: 140, textAlign: 'center', fontSize: 20, letterSpacing: 4, fontWeight: 700 }}
            />
            <button className="btn btn-primary" type="submit" disabled={submitting || joinCode.trim().length !== 6}>
              {submitting ? 'Joining…' : 'Join →'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setPanel('none')} disabled={submitting}>
              Cancel
            </button>
          </form>
          {classError && <p style={{ color: 'var(--wrong)', fontSize: 13, marginTop: 8 }}>⚠ {classError}</p>}
        </div>
      )}

      {/* Global Leaderboard */}
      <Leaderboard sessions={sessions as any[]} myIdentityHex={myIdentityHex} />

      {/* Personal Mastery Grid */}
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

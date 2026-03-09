import { useState, FormEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import Leaderboard from '../components/Leaderboard.js';

type Player = { identity: { toHexString(): string }; username: string; bestScore: number; totalSessions: number; };

interface Props {
  myPlayer: Player | undefined;
  myIdentityHex: string | undefined;
  onStartSprint: (sessionId: bigint) => void;
  onEnterClassroom: (id: bigint) => void;
}

type ClassroomPanel = 'none' | 'create' | 'join';

export default function LobbyPage({ myPlayer, myIdentityHex, onStartSprint, onEnterClassroom }: Props) {
  const { t } = useTranslation();
  const [bestScores] = useTable(tables.best_scores);
  const [classrooms] = useTable(tables.classrooms);
  const [classroomMembers] = useTable(tables.classroom_members);

  const [starting, setStarting] = useState(false);
  const [panel, setPanel] = useState<ClassroomPanel>('none');
  const [className, setClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [classError, setClassError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Pending auto-join code from ?join=CODE URL param; cleared once we navigate
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);

  const startSession = useSTDBReducer(reducers.startSession);
  const createClassroom = useSTDBReducer(reducers.createClassroom);
  const joinClassroom = useSTDBReducer(reducers.joinClassroom);

  // All classrooms this player is a member of
  const myMemberships = myIdentityHex
    ? (classroomMembers as any[]).filter(m => m.playerIdentity.toHexString() === myIdentityHex)
    : [];
  const myClassrooms = myMemberships
    .map((m: any) => (classrooms as any[]).find(c => c.id === m.classroomId))
    .filter(Boolean);

  // Auto-join from ?join=CODE URL param (QR code scan).
  // Step 1: detect the code and fire the reducer.
  useEffect(() => {
    if (!myPlayer) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (!code) return;
    window.history.replaceState({}, '', '/');   // clean the URL immediately
    const upperCode = code.trim().toUpperCase();
    setPendingJoinCode(upperCode);
    joinClassroom({ code: upperCode }).catch(() => setPendingJoinCode(null));
  }, [myPlayer?.identity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: navigate once the classrooms subscription delivers the joined classroom.
  // (classrooms may be empty when Step 1 fires — SpacetimeDB subscription catches up asynchronously)
  useEffect(() => {
    if (!pendingJoinCode) return;
    const classroom = (classrooms as any[]).find(c => c.code === pendingJoinCode);
    if (classroom) {
      setPendingJoinCode(null);
      onEnterClassroom(classroom.id);
    }
  }, [pendingJoinCode, classrooms]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Find the newly created classroom (latest by this teacher)
      const created = (classrooms as any[])
        .filter((c: any) => c.teacher?.toHexString() === myIdentityHex)
        .sort((a: any, b: any) => Number(b.id - a.id))[0];
      if (created) onEnterClassroom(created.id);
      else setPanel('none');
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
      const classroom = (classrooms as any[]).find(c => c.code === code);
      if (classroom) onEnterClassroom(classroom.id);
      else setPanel('none');
    } catch (err: any) {
      setClassError(err?.message ?? 'Classroom not found');
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      {/* CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          {myPlayer && (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              {t('lobby.bestScore')} <b style={{ color: 'var(--warn)' }}>{myPlayer.bestScore.toFixed(1)}</b>
              {' · '}{t('lobby.sessions', { count: myPlayer.totalSessions })}
              {' · '}
              <a
                href="/progress#tier-status"
                style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
              >
                {['🌱','🔨','⚡','🏆'][Math.min((myPlayer as any).learningTier ?? 0, 3)]}
                {' '}Tier {(myPlayer as any).learningTier ?? 0}
              </a>
            </p>
          )}
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleStart}
          disabled={starting}
          style={{ minWidth: 160 }}
        >
          {starting ? t('lobby.starting') : t('lobby.startSprint')}
        </button>
      </div>

      {/* Classrooms */}
      <div>
        {myClassrooms.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            {myClassrooms.map((c: any) => {
              const isTeacher = c.teacher?.toHexString() === myIdentityHex;
              const memberCount = (classroomMembers as any[]).filter(m => m.classroomId === c.id).length;
              return (
                <div key={String(c.id)} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 16px' }}>
                  <div>
                    <b style={{ color: 'var(--accent)' }}>{c.name}</b>
                    <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>
                      {isTeacher ? t('common.teacher') : t('common.student')} · {t('classroom.members', { count: memberCount })} · {t('common.code')} <code style={{ color: 'var(--text)' }}>{c.code}</code>
                    </span>
                  </div>
                  <button className="btn btn-primary" onClick={() => onEnterClassroom(c.id)} style={{ fontSize: 13 }}>
                    {t('lobby.viewClass')}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {panel === 'none' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => { setPanel('create'); setClassError(''); }}
              style={{ fontSize: 13 }}
            >
              {t('lobby.createClass')}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setPanel('join'); setClassError(''); }}
              style={{ fontSize: 13 }}
            >
              {t('lobby.joinClass')}
            </button>
          </div>
        ) : panel === 'create' ? (
          <div className="card">
            <h2 style={{ marginBottom: 8, fontSize: 16 }}>{t('lobby.createClassHeading')}</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="field"
                type="text"
                placeholder={t('lobby.classNamePlaceholder')}
                value={className}
                onChange={e => setClassName(e.target.value)}
                maxLength={40}
                autoFocus
                disabled={submitting}
                style={{ flex: 1, minWidth: 180 }}
              />
              <button className="btn btn-primary" type="submit" disabled={submitting || !className.trim()}>
                {submitting ? t('lobby.creating') : t('lobby.create')}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setPanel('none')} disabled={submitting}>
                {t('common.cancel')}
              </button>
            </form>
            {classError && <p style={{ color: 'var(--wrong)', fontSize: 13, marginTop: 8 }}>⚠ {classError}</p>}
          </div>
        ) : (
          <div className="card">
            <h2 style={{ marginBottom: 8, fontSize: 16 }}>{t('lobby.joinClassHeading')}</h2>
            <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="field"
                type="text"
                placeholder={t('lobby.joinCodePlaceholder')}
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoFocus
                disabled={submitting}
                style={{ width: 140, textAlign: 'center', fontSize: 20, letterSpacing: 4, fontWeight: 700 }}
              />
              <button className="btn btn-primary" type="submit" disabled={submitting || joinCode.trim().length !== 6}>
                {submitting ? t('lobby.joining') : t('lobby.join')}
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setPanel('none')} disabled={submitting}>
                {t('common.cancel')}
              </button>
            </form>
            {classError && <p style={{ color: 'var(--wrong)', fontSize: 13, marginTop: 8 }}>⚠ {classError}</p>}
          </div>
        )}
      </div>

      {/* Global Leaderboard */}
      <Leaderboard
        bestScores={bestScores as any[]}
        myIdentityHex={myIdentityHex}
        myLearningTier={(myPlayer as any)?.learningTier ?? 0}
      />

    </div>
  );
}

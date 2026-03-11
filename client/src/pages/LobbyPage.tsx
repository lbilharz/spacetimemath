import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import Leaderboard from '../components/Leaderboard.js';

const EMAILED_KEY = 'noggin_recovery_emailed';

type Player = { identity: { toHexString(): string }; username: string; bestScore: number; totalSessions: number; };

interface Props {
  myPlayer: Player | undefined;
  myIdentityHex: string | undefined;
  onStartSprint: (sessionId: bigint) => void;
  onEnterClassroom: (id: bigint) => void;
  onGoToAccount: () => void;
}

export default function LobbyPage({ myPlayer, myIdentityHex, onStartSprint, onEnterClassroom, onGoToAccount }: Props) {
  const { t } = useTranslation();
  const [bestScores]        = useTable(tables.best_scores);
  const [classrooms]        = useTable(tables.classrooms);
  const [classroomMembers]  = useTable(tables.classroom_members);
  const startSession        = useSTDBReducer(reducers.startSession);
  const joinClassroom       = useSTDBReducer(reducers.joinClassroom);

  // Nag: teacher with students who hasn't emailed their recovery key yet
  const hasStudents = (classrooms as any[]).some(c =>
    c.teacher.toHexString() === myIdentityHex &&
    (classroomMembers as any[]).some(m => m.classroomId === c.id && !m.isHidden)
  );
  const showNag = hasStudents && !localStorage.getItem(EMAILED_KEY);

  const [starting, setStarting]           = useState(false);
  // Pending auto-join code from ?join=CODE URL param; cleared once we navigate
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);

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

  return (
    <div className="page">
      {/* Recovery key nag for teachers with students */}
      {showNag && (
        <div style={{
          background: 'rgba(251,186,0,0.12)', border: '1.5px solid var(--accent)',
          borderRadius: 10, padding: '12px 16px', display: 'flex',
          alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <p style={{ flex: 1, fontSize: 13, color: 'var(--text)', margin: 0 }}>
            {t('lobby.recoveryNag')}
          </p>
          <button className="btn btn-primary" style={{ fontSize: 13, whiteSpace: 'nowrap' }} onClick={onGoToAccount}>
            {t('lobby.recoveryNagCta')}
          </button>
        </div>
      )}

      {/* Sprint CTA */}
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

      {/* Global Leaderboard */}
      <Leaderboard
        bestScores={bestScores as any[]}
        myIdentityHex={myIdentityHex}
        myLearningTier={(myPlayer as any)?.learningTier ?? 0}
      />
    </div>
  );
}

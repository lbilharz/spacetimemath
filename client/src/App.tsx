import { useState, useEffect } from 'react';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { tables } from './module_bindings/index.js';
import RegisterPage from './pages/RegisterPage.js';
import LobbyPage from './pages/LobbyPage.js';
import SprintPage from './pages/SprintPage.js';
import ResultsPage from './pages/ResultsPage.js';
import AccountPage from './pages/AccountPage.js';
import ClassroomPage from './pages/ClassroomPage.js';

export type Page = 'register' | 'lobby' | 'sprint' | 'results' | 'account' | 'classroom';

export default function App() {
  const { identity, isActive, connectionError } = useSpacetimeDB();
  const [players] = useTable(tables.players);
  const [classroomMembers] = useTable(tables.classroom_members);
  const [page, setPage] = useState<Page>('register');
  const [sessionId, setSessionId] = useState<bigint | null>(null);
  const [classroomId, setClassroomId] = useState<bigint | null>(null);
  // Track where to return after sprint/results
  const [sprintOrigin, setSprintOrigin] = useState<'lobby' | 'classroom'>('lobby');

  const myIdentityHex = identity?.toHexString();
  const myPlayer = myIdentityHex
    ? players.find(p => p.identity.toHexString() === myIdentityHex)
    : undefined;

  // Check if still in the specific classroom (for post-sprint routing)
  const inClassroom = classroomId !== null && myIdentityHex
    ? (classroomMembers as any[]).some(
        m => m.playerIdentity.toHexString() === myIdentityHex && m.classroomId === classroomId
      )
    : false;

  // Auto-navigate to lobby if already registered
  useEffect(() => {
    if (myPlayer && page === 'register') {
      setPage('lobby');
    }
  }, [myPlayer?.identity, page]);

  const goToSprint = (id: bigint, origin: 'lobby' | 'classroom') => {
    setSessionId(id);
    setSprintOrigin(origin);
    setPage('sprint');
  };

  const goToClassroom = (id: bigint) => {
    setClassroomId(id);
    setPage('classroom');
  };

  if (connectionError) {
    return (
      <div className="loading" style={{ flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 24 }}>⚠️</span>
        <span>Cannot connect to SpaceTimeDB</span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          Make sure <code>spacetime start --in-memory</code> is running on port 3000
        </span>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="loading">
        <span>⚡ Connecting to SpacetimeDB…</span>
      </div>
    );
  }

  switch (page) {
    case 'register':
      return (
        <RegisterPage
          onRegistered={() => setPage('lobby')}
        />
      );
    case 'lobby':
      return (
        <LobbyPage
          myPlayer={myPlayer}
          myIdentityHex={myIdentityHex}
          onStartSprint={(id) => goToSprint(id, 'lobby')}
          onAccount={() => setPage('account')}
          onEnterClassroom={goToClassroom}
        />
      );
    case 'classroom':
      return (
        <ClassroomPage
          myIdentityHex={myIdentityHex!}
          classroomId={classroomId!}
          onStartSprint={(id) => goToSprint(id, 'classroom')}
          onLeave={() => setPage('lobby')}
          onAccount={() => setPage('account')}
        />
      );
    case 'sprint':
      return (
        <SprintPage
          myIdentityHex={myIdentityHex!}
          onFinished={(id) => { setSessionId(id); setPage('results'); }}
        />
      );
    case 'results':
      return (
        <ResultsPage
          sessionId={sessionId!}
          myIdentityHex={myIdentityHex!}
          onBack={() => setPage(inClassroom ? 'classroom' : sprintOrigin)}
        />
      );
    case 'account':
      return (
        <AccountPage
          myPlayer={myPlayer!}
          myIdentityHex={myIdentityHex!}
          onEnterClassroom={goToClassroom}
          onBack={() => setPage('lobby')}
        />
      );
  }
}

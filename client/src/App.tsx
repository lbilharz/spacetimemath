import { useState, useEffect } from 'react';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { tables } from './module_bindings/index.js';
import RegisterPage from './pages/RegisterPage.js';
import LobbyPage from './pages/LobbyPage.js';
import SprintPage from './pages/SprintPage.js';
import ResultsPage from './pages/ResultsPage.js';
import AccountPage from './pages/AccountPage.js';

export type Page = 'register' | 'lobby' | 'sprint' | 'results' | 'account';

export default function App() {
  const { identity, isActive, connectionError } = useSpacetimeDB();
  const [players] = useTable(tables.players);
  const [page, setPage] = useState<Page>('register');
  const [sessionId, setSessionId] = useState<bigint | null>(null);

  const myIdentityHex = identity?.toHexString();
  const myPlayer = myIdentityHex
    ? players.find(p => p.identity.toHexString() === myIdentityHex)
    : undefined;

  // Auto-navigate to lobby if already registered
  useEffect(() => {
    if (myPlayer && page === 'register') {
      setPage('lobby');
    }
  }, [myPlayer?.identity, page]);

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
          onStartSprint={(id) => { setSessionId(id); setPage('sprint'); }}
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
          onBack={() => setPage('lobby')}
        />
      );
    case 'account':
      return (
        <AccountPage
          myPlayer={myPlayer!}
          myIdentityHex={myIdentityHex!}
          onBack={() => setPage('lobby')}
        />
      );
  }
}

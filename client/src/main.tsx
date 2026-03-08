import React from 'react';
import ReactDOM from 'react-dom/client';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from './module_bindings/index.js';
import App from './App.js';
import { setCapturedToken } from './auth.js';
import './i18n.js';
import './index.css';

const CREDS_KEY = 'spacetimemath_credentials';

function loadSavedToken(): string | undefined {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? JSON.parse(raw).token : undefined;
  } catch { return undefined; }
}

const STDB_URI = import.meta.env.VITE_SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const STDB_DB  = import.meta.env.VITE_SPACETIMEDB_DB  ?? 'spacetimemath';

const savedToken = loadSavedToken();
const base = DbConnection.builder()
  .withUri(STDB_URI)
  .withDatabaseName(STDB_DB);

const connectionBuilder = (savedToken ? base.withToken(savedToken) : base)
  .onConnect((_conn, identity, token) => {
    setCapturedToken(token);
    localStorage.setItem(CREDS_KEY, JSON.stringify({ identity: identity.toHexString(), token }));
  })
  .onConnectError((_conn, err) => {
    console.error('[STDB] Connection error:', err);
  })
  .onDisconnect((_conn, err) => {
    console.warn('[STDB] Disconnected:', err);
  });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <App />
    </SpacetimeDBProvider>
  </React.StrictMode>,
);

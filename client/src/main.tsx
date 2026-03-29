import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from './module_bindings/index.js';
import App from './App.js';
import { setCapturedToken } from './auth.js';
import './i18n.js';
import './index.css';

// On iOS/Android use the system font so emoji render correctly in WKWebView.
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('is-native');
}

const CREDS_KEY = 'spacetimemath_credentials';

function loadSavedToken(): string | undefined {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? JSON.parse(raw).token : undefined;
  } catch { return undefined; }
}

const STDB_URI = import.meta.env.VITE_SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const STDB_DB  = import.meta.env.VITE_SPACETIMEDB_DB  ?? 'spacetimemath';

function Root() {
  const [reconnectCount, setReconnectCount] = React.useState(0);

  React.useEffect(() => {
    // Expose a global hook for App.tsx's visibility fallback to trigger a quiet SDK reconnect
    // without trashing React component state or scroll position.
    (window as any).__force_stdb_reconnect = () => {
      setReconnectCount(c => c + 1);
    };
  }, []);

  const connectionBuilder = React.useMemo(() => {
    const savedToken = loadSavedToken();
    
    // By appending `?rc=N` to the URI, we change the URI string.
    // The SpacetimeDB React `ConnectionManager` uses the URI as a cache key,
    // so changing it forces `SpacetimeDBProvider` to release the dead socket
    // and build a completely fresh DbConnection under the hood. 
    // The query param is safely discarded by underlying websocket URL parsing.
    const uriWithParam = reconnectCount > 0 
      ? `${STDB_URI}?rc=${reconnectCount}` 
      : STDB_URI;

    const base = DbConnection.builder()
      .withUri(uriWithParam)
      .withDatabaseName(STDB_DB);

    return (savedToken ? base.withToken(savedToken) : base)
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
  }, [reconnectCount]);

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <App />
    </SpacetimeDBProvider>
  );
}

import ScreenshotPage from './pages/ScreenshotPage.js';

if (typeof window !== 'undefined' && import.meta.env.DEV && window.location.pathname === '/screenshot') {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ScreenshotPage />
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
}

import { useState, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { TransferCode, RecoveryKey } from '../module_bindings/types.js';
import { capturedToken } from '../auth.js';
import SplashGrid from '../components/SplashGrid.js';

const CREDS_KEY = 'spacetimemath_credentials';

interface Props {
  onRegistered: () => void;
}

export default function RegisterPage({ onRegistered }: Props) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useSTDBReducer(reducers.register);
  const createRecoveryKey = useSTDBReducer(reducers.createRecoveryKey);

  const [showRestore, setShowRestore] = useState(false);
  const [code, setCode] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [transferCodes] = useTable(tables.transfer_codes);
  const [recoveryKeys] = useTable(tables.recovery_keys);
  const applyTransferCode = useSTDBReducer(reducers.useTransferCode);

  // Auto-restore from ?restore=CODE URL param (teacher-generated QR card scan)
  const [autoRestoreCode, setAutoRestoreCode] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restore = params.get('restore');
    if (restore && restore.trim().length >= 6) {
      const upper = restore.trim().toUpperCase();
      window.history.replaceState({}, '', '/'); // clean URL immediately
      setCode(upper);
      setShowRestore(true);
      setAutoRestoreCode(upper);
    }
  }, []);

  // Once recovery_keys subscription delivers data, auto-restore (no button tap needed)
  useEffect(() => {
    if (!autoRestoreCode || restoring) return;

    const transfer = (transferCodes as TransferCode[]).find(c => c.code === autoRestoreCode);
    if (transfer) {
      setAutoRestoreCode(null);
      setRestoring(true);
      localStorage.setItem(CREDS_KEY, JSON.stringify({ token: transfer.token }));
      applyTransferCode({ code: autoRestoreCode }).finally(() => window.location.reload());
      return;
    }

    const recovery = (recoveryKeys as RecoveryKey[]).find(k => k.code === autoRestoreCode);
    if (recovery) {
      setAutoRestoreCode(null);
      setRestoring(true);
      localStorage.setItem(CREDS_KEY, JSON.stringify({ token: recovery.token }));
      window.location.reload();
    }
  }, [autoRestoreCode, recoveryKeys, transferCodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name || name.length > 24) {
      setError(t('register.usernameError'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register({ username: name });
      // Auto-generate a recovery key so the teacher can immediately create a QR card
      if (capturedToken) {
        await createRecoveryKey({ token: capturedToken });
      }
      setTimeout(onRegistered, 300);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? t('register.usernameError'));
      setLoading(false);
    }
  };

  const handleRestore = async (e: FormEvent) => {
    e.preventDefault();
    const upper = code.trim().toUpperCase();
    setRestoring(true);
    setRestoreError('');

    const transfer = (transferCodes as TransferCode[]).find(c => c.code === upper);
    if (transfer) {
      localStorage.setItem(CREDS_KEY, JSON.stringify({ token: transfer.token }));
      await applyTransferCode({ code: upper });
      window.location.reload();
      return;
    }

    const recovery = (recoveryKeys as RecoveryKey[]).find(k => k.code === upper);
    if (recovery) {
      localStorage.setItem(CREDS_KEY, JSON.stringify({ token: recovery.token }));
      window.location.reload();
      return;
    }

    setRestoreError(t('register.restoreError'));
    setRestoring(false);
  };

  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '80vh' }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ marginBottom: 8 }}><SplashGrid /></div>
        <h1 style={{ fontSize: 36 }}>1UP</h1>
        {!showRestore && <p style={{ color: 'var(--muted)', marginTop: 8 }}>{t('register.tagline')}</p>}
      </div>

      {!showRestore ? (
        <div className="card">
          <h2 style={{ marginBottom: 16 }}>{t('register.chooseName')}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              className="field"
              type="text"
              placeholder={t('register.usernamePlaceholder')}
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={24}
              autoFocus
              disabled={loading}
            />
            {error && <p style={{ color: 'var(--wrong)', fontSize: 14 }}>⚠ {error}</p>}
            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={loading || !username.trim()}
            >
              {loading ? t('register.registering') : t('register.joinSprint')}
            </button>
          </form>

          <button
            onClick={() => setShowRestore(true)}
            style={{
              marginTop: 16, background: 'none', border: 'none',
              color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
              textDecoration: 'underline', padding: 0,
            }}
          >
            {t('register.restoreLink')}
          </button>
        </div>
      ) : (
        <div className="card">
          <h2 style={{ marginBottom: 8, fontSize: 16 }}>{t('register.restoreHeading')}</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {t('register.restoreDesc')}
          </p>
          {autoRestoreCode ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              {t('register.restoring')}
            </p>
          ) : (
            <form onSubmit={handleRestore} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                className="field"
                type="text"
                placeholder={t('register.restorePlaceholder')}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={12}
                autoFocus
                disabled={restoring}
                style={{ textAlign: 'center', fontSize: 20, letterSpacing: 4, fontWeight: 700 }}
              />
              {restoreError && <p style={{ color: 'var(--wrong)', fontSize: 14 }}>⚠ {restoreError}</p>}
              <button
                className="btn btn-primary btn-lg"
                type="submit"
                disabled={restoring || (code.trim().length !== 6 && code.trim().length !== 12)}
              >
                {restoring ? t('register.restoring') : t('register.restore')}
              </button>
            </form>
          )}

          <button
            onClick={() => { setShowRestore(false); setCode(''); setRestoreError(''); setAutoRestoreCode(null); }}
            style={{
              marginTop: 16, background: 'none', border: 'none',
              color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
              textDecoration: 'underline', padding: 0,
            }}
          >
            {t('register.newAccount')}
          </button>
        </div>
      )}

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
        {t('register.footer')}
      </p>
    </div>
  );
}

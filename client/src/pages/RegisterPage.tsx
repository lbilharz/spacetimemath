import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';

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

  const [showRestore, setShowRestore] = useState(false);
  const [code, setCode] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [transferCodes] = useTable(tables.transfer_codes);
  const [recoveryKeys] = useTable(tables.recovery_keys);
  const useTransferCode = useSTDBReducer(reducers.useTransferCode);

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
      setTimeout(onRegistered, 300);
    } catch (err: any) {
      setError(err?.message ?? t('register.usernameError'));
      setLoading(false);
    }
  };

  const handleRestore = async (e: FormEvent) => {
    e.preventDefault();
    const upper = code.trim().toUpperCase();
    setRestoring(true);
    setRestoreError('');

    const transfer = (transferCodes as any[]).find(c => c.code === upper);
    if (transfer) {
      localStorage.setItem(CREDS_KEY, JSON.stringify({ token: transfer.token }));
      await useTransferCode({ code: upper });
      window.location.reload();
      return;
    }

    const recovery = (recoveryKeys as any[]).find(k => k.code === upper);
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
        <div style={{ fontSize: 64, marginBottom: 8 }}>⚡</div>
        <h1 style={{ fontSize: 36 }}>Math Sprint</h1>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>
          {t('register.tagline')}
        </p>
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

          <button
            onClick={() => { setShowRestore(false); setCode(''); setRestoreError(''); }}
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

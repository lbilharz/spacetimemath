import { useState, useEffect, useRef, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducer as useSTDBReducer, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../module_bindings/index.js';
// transfer_codes and recovery_keys are now private tables (SEC-01/SEC-02).
// Account restore via code entry is temporarily broken — requires a server-side restore reducer.
import { capturedToken } from '../auth.js';
import SplashGrid from '../components/SplashGrid.js';


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
  const [autoRestoreCode, setAutoRestoreCode] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restore = params.get('restore');
    if (restore && restore.trim().length >= 6) {
      const upper = restore.trim().toUpperCase();
      window.history.replaceState({}, '', '/'); // clean URL immediately
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode(upper);
      setShowRestore(true);
      setAutoRestoreCode(upper);
    }
  }, []);

  const restoreAccount = useSTDBReducer(reducers.restoreAccount);
  const [restoreResults] = useTable(tables.restore_results);
  // Ref so the async polling loop always reads the latest rows (avoids stale closure)
  const restoreResultsRef = useRef<typeof restoreResults>([]);
  useEffect(() => { restoreResultsRef.current = restoreResults; }, [restoreResults]);

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
    if (upper.length !== 12) {
      setRestoreError(t('register.restoreError'));
      return;
    }
    setRestoring(true);
    setRestoreError('');
    try {
      await restoreAccount({ code: upper });
      // Poll for result row (private table rows arrive automatically to our identity)
      const POLL_INTERVAL = 50;
      const TIMEOUT = 5_000;
      const deadline = Date.now() + TIMEOUT;
      type RestoreRow = { caller: { toHexString: () => string }; token: string };
      const getRow = () =>
        (restoreResultsRef.current as unknown as RestoreRow[]).find(r => r.token.length > 0);
      let row = getRow();
      while (!row && Date.now() < deadline) {
        await new Promise(res => setTimeout(res, POLL_INTERVAL));
        row = getRow();
      }
      if (!row) {
        setRestoreError(t('register.restoreError'));
        setRestoring(false);
        return;
      }
      const CREDS_KEY = 'spacetimemath_credentials';
      localStorage.setItem(CREDS_KEY, JSON.stringify({ identity: '', token: row.token }));
      window.location.reload();
    } catch {
      setRestoreError(t('register.restoreError'));
      setRestoring(false);
    }
  };

  // Auto-trigger restore when code is pre-populated from URL
  useEffect(() => {
    if (autoRestoreCode && !restoring) {
      const synth = { preventDefault: () => {} } as unknown as FormEvent;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleRestore(synth);
    }
  }, [autoRestoreCode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page" style={{ justifyContent: 'center', minHeight: '80vh' }}>
      <div className="text-center mb-2">
        <div className="mb-2"><SplashGrid /></div>
        <h1 style={{ fontSize: 36 }}>1UP</h1>
        {!showRestore && <p className="text-muted mt-2">{t('register.tagline')}</p>}
      </div>

      {!showRestore ? (
        <div className="card">
          <h2 className="mb-4">{t('register.chooseName')}</h2>
          <form onSubmit={handleSubmit} className="col gap-12">
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
            {error && <p className="text-error text-base">⚠ {error}</p>}
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
            className="btn-link mt-4"
          >
            {t('register.restoreLink')}
          </button>
        </div>
      ) : (
        <div className="card">
          <h2 className="mb-2" style={{ fontSize: 16 }}>{t('register.restoreHeading')}</h2>
          <p className="text-sm text-muted mb-4">
            {t('register.restoreDesc')}
          </p>
          {autoRestoreCode ? (
            <p className="text-center text-muted text-base">
              {t('register.restoring')}
            </p>
          ) : (
            <form onSubmit={handleRestore} className="col gap-12">
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
              {restoreError && <p className="text-error text-base">⚠ {restoreError}</p>}
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
            className="btn-link mt-4"
          >
            {t('register.newAccount')}
          </button>
        </div>
      )}

      <p className="text-center text-sm text-muted">
        {t('register.footer')}
      </p>
    </div>
  );
}

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducer as useSTDBReducer, useTable, useSpacetimeDB } from 'spacetimedb/react';
import { reducers, tables } from '../module_bindings/index.js';
// transfer_codes and recovery_keys are now private tables (SEC-01/SEC-02).
// Account restore via code entry is temporarily broken — requires a server-side restore reducer.
import { capturedToken } from '../auth.js';
import SplashGrid from '../components/SplashGrid.js';
import LanguagePicker from '../components/LanguagePicker.js';

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

  const { identity } = useSpacetimeDB();
  const restoreAccount = useSTDBReducer(reducers.restoreAccount);
  const consumeRestoreResult = useSTDBReducer(reducers.consumeRestoreResult);
  const [restoreResults] = useTable(
    identity
      ? tables.restore_results.where(r => r.caller.eq(identity))
      : tables.restore_results
  );
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
        setRestoreError(t('register.restoreTimeout'));
        setRestoring(false);
        return;
      }
      const CREDS_KEY = 'spacetimemath_credentials';
      localStorage.setItem(CREDS_KEY, JSON.stringify({ identity: '', token: row.token }));
      // Consume the restore result row (best-effort; identity_disconnected is the backstop)
      try { await consumeRestoreResult(); } catch { /* ignore */ }
      window.location.reload();
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)) || t('register.restoreError');
      setRestoreError(msg);
      setRestoring(false);
    }
  };

  // Auto-trigger restore when code is pre-populated from URL
  useEffect(() => {
    if (autoRestoreCode && !restoring) {
      const synth = { preventDefault: () => { } } as unknown as FormEvent;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleRestore(synth);
    }
  }, [autoRestoreCode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex min-h-[100vh] flex-col items-center justify-center overflow-hidden bg-slate-50 p-6 pb-20 dark:bg-slate-950">
      {/* Decorative Background Elements */}
      <div className="absolute -top-24 -start-24 h-96 w-96 rounded-full bg-brand-yellow/10 blur-[100px] dark:bg-brand-yellow/5" />
      <div className="absolute top-1/2 -end-24 h-96 w-96 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[120px] dark:bg-blue-500/5" />
      <div className="absolute -bottom-24 start-1/2 h-96 w-96 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-purple-500/10 blur-[120px] dark:bg-purple-500/5" />

      {/* Language Switcher */}
      <div className="absolute top-6 end-6 lg:top-10 lg:end-10 overflow-visible">
        <LanguagePicker />
      </div>

      <div className="relative mb-6 flex animate-in fade-in slide-in-from-bottom-6 duration-1000 flex-row items-center justify-center gap-4 sm:mb-10 sm:flex-col sm:text-center">
        <div className="flex-shrink-0 drop-shadow-[0_10px_30px_rgba(234,179,8,0.3)] transition-all hover:scale-110 hover:rotate-3 active:scale-95 cursor-pointer sm:mb-8 sm:drop-shadow-[0_20px_50px_rgba(234,179,8,0.3)]">
          <div className="scale-75 sm:scale-100">
            <SplashGrid />
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-center">
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white sm:text-7xl">
            1UP
          </h1>
          {!showRestore && (
            <div className="mt-1 flex flex-col items-start gap-1 sm:mt-6 sm:items-center sm:gap-2">
              <p className="max-w-[200px] text-xs font-bold leading-tight text-slate-500 dark:text-slate-400 sm:max-w-md sm:text-xl sm:text-slate-600 dark:sm:text-slate-300">
                {t('register.tagline')}
              </p>
              <div className="h-0.5 w-8 rounded-full bg-brand-yellow sm:h-1 sm:w-12" />
            </div>
          )}
        </div>
      </div>

      <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
        {!showRestore ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
            <h2 className="mb-2 flex items-center gap-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              <span>{t('register.chooseName')}</span>
              <span className="animate-bounce text-3xl">👋</span>
            </h2>
            <p className="mb-8 animate-in fade-in ltr:slide-in-from-left-4 rtl:slide-in-from-right-4 duration-1000 delay-500 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {t('register.createAccountDesc')}
            </p>
            <form onSubmit={handleSubmit} className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700 flex flex-col gap-4">
              <input
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 text-lg font-semibold text-slate-900 transition-all focus:border-brand-yellow focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-yellow/10 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-brand-yellow dark:focus:bg-slate-900 lg:text-xl placeholder:text-slate-400"
                type="text"
                placeholder={t('register.usernamePlaceholder')}
                value={username}
                onChange={e => setUsername(e.target.value)}
                maxLength={24}
                autoFocus
                disabled={loading}
              />
              {error && (
                <p className="flex items-center gap-2 font-medium text-red-500">
                  <span className="text-xl">⚠</span> {error}
                </p>
              )}
              <button
                className="group relative h-16 w-full cursor-pointer overflow-hidden rounded-[20px] bg-brand-yellow px-8 py-4 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={loading || !username.trim()}
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="relative flex items-center justify-center gap-2 text-lg font-black uppercase tracking-wider text-slate-900">
                  {loading ? t('register.registering') : (
                    <>
                      {t('register.joinSprint')}
                      <span className="transition-transform ltr:group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180">→</span>
                    </>
                  )}
                </span>
              </button>
            </form>

            <div className="my-8 flex items-center gap-4 text-slate-300 dark:text-slate-700">
              <div className="h-px flex-1 bg-current" />
              <span className="text-xs font-bold uppercase tracking-widest">{t('common.or')}</span>
              <div className="h-px flex-1 bg-current" />
            </div>

            <button
              onClick={() => setShowRestore(true)}
              className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-6 text-sm font-bold text-slate-600 transition-all hover:border-slate-200 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <span>{t('register.restoreLink')}</span>
              <span className="text-lg transition-transform group-hover:rotate-12">↺</span>
            </button>
          </div>
        ) : (
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
            <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
              {t('register.restoreHeading')}
            </h2>
            <p className="mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('register.restoreDesc')}
            </p>
            {autoRestoreCode ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-yellow border-t-transparent" />
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('register.restoring')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleRestore} className="flex flex-col gap-6">
                <input
                  className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-6 text-2xl font-black tracking-[0.2em] text-slate-900 transition-all focus:border-brand-yellow focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-yellow/10 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-brand-yellow dark:focus:bg-slate-900 lg:text-3xl placeholder:text-slate-300 placeholder:tracking-normal"
                  type="text"
                  placeholder={t('register.restorePlaceholder')}
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  maxLength={12}
                  autoFocus
                  disabled={restoring}
                  style={{ textAlign: 'center' }}
                />
                {restoreError && (
                  <p className="flex items-center gap-2 font-medium text-red-500">
                    <span className="text-xl">⚠</span> {restoreError}
                  </p>
                )}
                <button
                  className="group relative h-16 w-full cursor-pointer overflow-hidden rounded-[20px] bg-brand-yellow px-8 py-4 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  type="submit"
                  disabled={restoring || (code.trim().length !== 6 && code.trim().length !== 12)}
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="relative flex items-center justify-center gap-2 text-lg font-black uppercase tracking-wider text-slate-900">
                    {restoring ? t('register.restoring') : (
                      <>
                        {t('register.restore')}
                        <span className="transition-transform ltr:group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180">→</span>
                      </>
                    )}
                  </span>
                </button>
              </form>
            )}

            <button
              onClick={() => { setShowRestore(false); setCode(''); setRestoreError(''); setAutoRestoreCode(null); }}
              className="group mt-6 flex w-full items-center justify-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-brand-yellow dark:text-slate-400 dark:hover:text-brand-yellow"
            >
              <span className="transition-transform ltr:group-hover:-translate-x-1 rtl:group-hover:translate-x-1 rtl:rotate-180">←</span>
              <span>{t('register.newAccount')}</span>
            </button>
          </div>
        )}
      </div>

      <p className="mt-12 max-w-xs text-center text-sm font-medium leading-relaxed text-slate-400 dark:text-slate-500 animate-in fade-in duration-1000 delay-500">
        {t('register.footer')}
      </p>
    </div>
  );
}

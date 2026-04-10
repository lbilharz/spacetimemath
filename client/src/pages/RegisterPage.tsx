import { useState, useEffect, useRef, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducer as useSTDBReducer, useTable, useSpacetimeDB } from 'spacetimedb/react';
import { reducers, tables } from '../module_bindings/index.js';
import { capturedToken } from '../auth.js';
import SplashGrid from '../components/SplashGrid.js';
import LanguagePicker from '../components/LanguagePicker.js';
import PageContainer from '../components/PageContainer.js';

interface Props {
  onRegistered: () => void;
}

export default function RegisterPage({ onRegistered }: Props) {
  const { t, i18n } = useTranslation();
  
  // Split flow states
  const [flowType, setFlowType] = useState<'teacher' | 'student' | 'solo' | null>(null);
  const [hasFriendInvite, setHasFriendInvite] = useState(false);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [classCode, setClassCode] = useState('');
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useSTDBReducer(reducers.register);
  const joinClassAsStudent = useSTDBReducer(reducers.joinClassAsStudent); // The new reducer
  const verifyTeacherUpgrade = useSTDBReducer(reducers.verifyTeacherUpgrade);
  const createRecoveryKey = useSTDBReducer(reducers.createRecoveryKey);

  const [verifyStep, setVerifyStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [hmacSignature, setHmacSignature] = useState('');
  const [expiresAtMs, setExpiresAtMs] = useState<number>(0);

  const [showRestore, setShowRestore] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'select' | 'code' | 'email' | 'email-verify'>('select');
  const [restoreEmail, setRestoreEmail] = useState('');
  const [code, setCode] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [autoRestoreCode, setAutoRestoreCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restore = params.get('restore');
    if (restore && restore.trim().length >= 6) {
      const upper = restore.trim().toUpperCase();
      window.history.replaceState({}, '', '/');
      setCode(upper);
      setShowRestore(true);
      setRestoreMode('code');
      setAutoRestoreCode(upper);
    }
    
    try {
      if (localStorage.getItem('_pendingFriendToken')) {
        setHasFriendInvite(true);
        setFlowType('solo');
      }
    } catch { /* ignore */ }
  }, []);

  const { identity } = useSpacetimeDB();
  const restoreAccount = useSTDBReducer(reducers.restoreAccount);
  const consumeRestoreResult = useSTDBReducer(reducers.consumeRestoreResult);
  const [restoreResults] = useTable(
    identity
      ? tables.my_restore_results.where(r => r.caller.eq(identity))
      : tables.my_restore_results
  );
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
      if (flowType === 'teacher') {
         if (!email || !consent1 || !consent2) {
            setError(t('register_split.consent_1'));
            setLoading(false);
            return;
         }
         
         const hex = identity?.toHexString();
         if (!hex) {
            setError("Connection not established");
            setLoading(false);
            return;
         }
         

         // Trigger verification email via Vercel Admin API
         const res = await fetch('/api/send-teacher-verif', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: email.trim(), identityHex: hex, name, locale: i18n.language })
         });
         
         if (!res.ok) {
           let errorMsg = "Failed to send verification email.";
           try {
             const errData = await res.json();
             errorMsg = errData.error || errorMsg;
           } catch {
             if (res.status === 404) {
               errorMsg = "API endpoint not found. On localhost, please use 'vercel dev' instead of 'npm run dev' to test email features.";
             } else {
               const text = await res.text().catch(() => '');
               errorMsg = `Server returned ${res.status}: ${text || 'Unknown Error'}`;
             }
           }
           setError(errorMsg);
           setLoading(false);
           return;
         }
         
         const data = await res.json();
         setHmacSignature(data.signature);
         setExpiresAtMs(data.expiresAt);
         
         setVerifyStep(true);
         setLoading(false);
         return; // Wait for verification before finishing!
         
      } else if (flowType === 'student') {
         if (!classCode) {
            setError(t('register_split.class_code_label'));
            setLoading(false);
            return;
         }
         // First register as solo/base identity so we have a Player. 
         // Or use the dedicated join_class_as_student reducer natively via normal STDB if we don't have an identity yet.
         // Actually, wait, `joinClassAsStudent` assumes player exists in auth.rs!
         // We should just register as Student directly, passing class_id? 
         // No, according to our backend changes we added `joinClassAsStudent(class_code, username)`.
         // Wait! We changed `register` to take `playerType` and `email`!
         // If we just register { playerType: { student: {} } }, it sets class_id to None in backend!
         // We must register as base (or Solo) and then immediately call joinClassAsStudent!
         await register({ username: name, playerType: { tag: 'Student' }, email: undefined });
         // We need to wait for the registration sequence to complete usually...
         await joinClassAsStudent({ classCode: classCode.trim(), classUsername: name });
         
      } else {
         // Solo
         try {
             await Promise.race([
                 register({ username: name, playerType: { tag: 'Solo' }, email: undefined }),
                 new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
             ]);
         } catch (e) {
             console.error('Registration error:', e);
             throw e;
         }
      }

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

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (verificationCode.trim().length !== 6) return;
    setVerifyLoading(true);
    setError('');
    try {
      await verifyTeacherUpgrade({ 
          username: username.trim(),
          email: email.trim(),
          code: verificationCode.trim(), 
          signature: hmacSignature,
          expiresAtMs: BigInt(expiresAtMs),
          gdprConsent: true, 
          teacherDeclaration: true 
      });
      if (capturedToken) {
        await createRecoveryKey({ token: capturedToken });
      }
      setTimeout(onRegistered, 300);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Invalid verification code");
      setVerifyLoading(false);
    }
  };

  const handleEmailRestore = async (e: FormEvent) => {
    e.preventDefault();
    if (!restoreEmail.trim()) return;
    setRestoring(true);
    setRestoreError('');
    try {
      const hex = identity?.toHexString();
      if (!hex) throw new Error("Connection not established");
      const res = await fetch('/api/send-email-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: restoreEmail.trim(), identityHex: hex, locale: i18n.language })
      });
      if (!res.ok) {
        let msg = "Failed to send email.";
        try { msg = (await res.json()).error || msg; } catch { /* best-effort */ }
        throw new Error(msg);
      }
      const data = await res.json();
      setHmacSignature(data.signature);
      setExpiresAtMs(data.expiresAt);
      setRestoreMode('email-verify');
    } catch (err: any) {
      setRestoreError(err.message);
    } finally {
      setRestoring(false);
    }
  };

  const [syncing, setSyncing] = useState(false);
  const restoreAccountViaEmail = useSTDBReducer(reducers.restoreAccountViaEmail);
  const handleVerifyEmailRestore = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) return;
    setRestoring(true);
    setRestoreError('');
    try {
      await restoreAccountViaEmail({
        email: restoreEmail.trim(),
        code: code.trim(),
        signature: hmacSignature,
        expiresAtMs: BigInt(expiresAtMs)
      });
      setSyncing(true);
      const POLL_INTERVAL = 50;
      const TIMEOUT = 5_000;
      const deadline = Date.now() + TIMEOUT;
      type RestoreRow = { caller: { toHexString: () => string }; token: string };
      const getRow = () => (restoreResultsRef.current as unknown as RestoreRow[]).find(r => r.token.length > 0);
      let row = getRow();
      while (!row && Date.now() < deadline) {
        await new Promise(res => setTimeout(res, POLL_INTERVAL));
        row = getRow();
      }
      if (!row) throw new Error(t('register.restoreTimeout'));
      localStorage.setItem('spacetimemath_credentials', JSON.stringify({ identity: '', token: row.token }));
      try { await consumeRestoreResult(); } catch { /* best-effort */ }
      setRestoring(false);
      setSyncing(false);
      window.location.reload();
    } catch (err: any) {
      setRestoreError(err.message || 'Verification failed');
      setRestoring(false);
      setSyncing(false);
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
      try { await consumeRestoreResult(); } catch { /* ignore */ }
      window.location.reload();
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)) || t('register.restoreError');
      setRestoreError(msg);
      setRestoring(false);
    }
  };

  useEffect(() => {
    if (autoRestoreCode && !restoring) {
      const synth = { preventDefault: () => { } } as unknown as FormEvent;
      handleRestore(synth);
    }
  }, [autoRestoreCode]);

  return (
    <PageContainer maxWidth="none" className="relative min-h-[100vh] items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="absolute -top-24 -start-24 h-96 w-96 rounded-full bg-brand-yellow/10 blur-[100px] dark:bg-brand-yellow/5" />
      <div className="absolute top-1/2 -end-24 h-96 w-96 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[120px] dark:bg-blue-500/5" />
      <div className="absolute -bottom-24 start-1/2 h-96 w-96 -translate-x-1/2 rtl:translate-x-1/2 rounded-full bg-purple-500/10 blur-[120px] dark:bg-purple-500/5" />

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
             
             {!flowType ? (
                 <>
                  <h2 className="mb-6 flex items-center justify-center gap-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    <span>{t('register.chooseName')}</span>
                    <span className="animate-bounce text-3xl">👋</span>
                  </h2>
                  <div className="flex flex-col gap-4">
                     <button
                        onClick={() => setFlowType('teacher')}
                        className="h-14 w-full rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors"
                     >
                        {t('register_split.teacher_btn')}
                     </button>
                     <button
                        onClick={() => setFlowType('student')}
                        className="h-14 w-full rounded-2xl bg-brand-yellow text-slate-900 font-bold hover:bg-yellow-400 transition-colors"
                     >
                        {t('register_split.student_btn')}
                     </button>
                     <button
                        onClick={() => setFlowType('solo')}
                        className="h-14 w-full rounded-2xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                     >
                        {t('register_split.solo_btn')}
                     </button>
                  </div>
                 </>
             ) : verifyStep ? (
                <>
                  <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
                    Verify Your Email
                  </h2>
                  <p className="mb-6 text-sm font-medium text-slate-500 dark:text-slate-400">
                    We just sent a 6-digit verification code to <strong className="text-slate-700 dark:text-slate-300">{email}</strong>. Entering this code upgrades your account to Teacher.
                  </p>
                  <form onSubmit={handleVerify} className="flex flex-col gap-4">
                     <input
                        className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-6 text-2xl font-black tracking-[0.2em] text-slate-900 transition-all focus:border-brand-yellow focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-brand-yellow dark:focus:bg-slate-900 text-center"
                        type="text"
                        placeholder="123456"
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                        maxLength={6}
                        autoFocus
                        disabled={verifyLoading}
                        required
                     />
                     {error && (
                        <p className="flex items-center gap-2 font-medium text-red-500">
                           <span className="text-xl">⚠</span> {error}
                        </p>
                     )}
                     <button
                        className="group flex h-16 w-full items-center justify-center gap-2 rounded-[20px] bg-[#10B981] px-8 text-lg font-black uppercase tracking-wider text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                        type="submit"
                        disabled={verifyLoading || verificationCode.length !== 6}
                     >
                        {verifyLoading ? 'Verifying...' : 'Verify Code'}
                     </button>
                     <div className="mt-4 flex flex-col gap-2 w-full text-center items-center justify-center">
                         <span className="text-xs text-slate-400">Didn't receive it? Check your spam folder.</span>
                         <button type="button" onClick={() => onRegistered()} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Skip and register as Solo</button>
                     </div>
                  </form>
                </>
             ) : (
                <>
                  <button onClick={() => setFlowType(null)} className="mb-4 text-sm font-bold text-slate-400 hover:text-slate-600">
                     ← {t('common.back')}
                  </button>
                  {hasFriendInvite && flowType === 'solo' && (
                     <div className="mb-6 flex gap-3 rounded-xl border-[1.5px] border-brand-yellow bg-brand-yellow/10 p-4 text-sm font-bold text-slate-800 shadow-sm shadow-brand-yellow/10 dark:text-slate-200">
                        <span className="text-xl">🤝</span>
                        <p>{t('register.friendInviteBanner', 'You\'ve been invited! Choose a name to connect with your friend and start racing.')}</p>
                     </div>
                  )}
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                     
                     {flowType === 'teacher' && (
                        <>
                           <input
                              className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-semibold text-slate-900 transition-colors focus:border-brand-yellow focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:bg-slate-900 dark:focus:border-brand-yellow"
                              type="email"
                              placeholder={t('register_split.email_label')}
                              value={email}
                              onChange={e => setEmail(e.target.value)}
                              disabled={loading}
                              required
                           />
                           <input
                              className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-semibold text-slate-900 transition-colors focus:border-brand-yellow focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:bg-slate-900 dark:focus:border-brand-yellow"
                              type="text"
                              placeholder={t('register.usernamePlaceholder')}
                              value={username}
                              onChange={e => setUsername(e.target.value)}
                              maxLength={24}
                              disabled={loading}
                              required
                           />
                           <label className="flex items-start gap-2 text-sm text-slate-600">
                              <input type="checkbox" checked={consent1} onChange={(e) => setConsent1(e.target.checked)} className="mt-1" required />
                              {t('register_split.consent_1')}
                           </label>
                           <label className="flex items-start gap-2 text-sm text-slate-600">
                              <input type="checkbox" checked={consent2} onChange={(e) => setConsent2(e.target.checked)} className="mt-1" required />
                              {t('register_split.consent_2')}
                           </label>
                        </>
                     )}

                     {flowType === 'student' && (
                        <>
                           <input
                              className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-semibold tracking-widest text-slate-900 uppercase transition-colors focus:border-brand-yellow focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:bg-slate-900 dark:focus:border-brand-yellow"
                              type="text"
                              placeholder={t('register_split.class_code_label')}
                              value={classCode}
                              onChange={e => setClassCode(e.target.value.toUpperCase())}
                              maxLength={6}
                              disabled={loading}
                              required
                           />
                           <input
                              className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-semibold text-slate-900 transition-colors focus:border-brand-yellow focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:bg-slate-900 dark:focus:border-brand-yellow"
                              type="text"
                              placeholder={t('register.usernamePlaceholder')}
                              value={username}
                              onChange={e => setUsername(e.target.value)}
                              maxLength={24}
                              disabled={loading}
                              required
                           />
                           <p className="text-xs text-brand-yellow font-bold bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                              {t('register_split.recovery_nag_student')}
                           </p>
                        </>
                     )}

                     {flowType === 'solo' && (
                        <>
                           <p className="mb-4 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                              {t('register.createAccountDesc')}
                           </p>
                           <input
                              className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-semibold text-slate-900 transition-colors focus:border-brand-yellow focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:bg-slate-900 dark:focus:border-brand-yellow"
                              type="text"
                              placeholder={t('register.usernamePlaceholder')}
                              value={username}
                              onChange={e => setUsername(e.target.value)}
                              maxLength={24}
                              autoFocus
                              disabled={loading}
                              required
                           />
                        </>
                     )}

                     {error && (
                        <p className="flex items-center gap-2 font-medium text-red-500">
                           <span className="text-xl">⚠</span> {error}
                        </p>
                     )}
                     <button
                        className="group flex h-16 w-full items-center justify-center gap-2 rounded-[20px] bg-brand-yellow px-8 text-lg font-black uppercase tracking-wider text-slate-900 transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                        type="submit"
                        disabled={loading || !username.trim()}
                     >
                        {loading ? t('register.registering') : t('register.joinSprint')}
                     </button>
                  </form>
                </>
             )}

            <div className="my-8 flex items-center gap-4 text-slate-300 dark:text-slate-700">
              <div className="h-px flex-1 bg-current" />
              <span className="text-xs font-bold uppercase tracking-widest">{t('common.or')}</span>
              <div className="h-px flex-1 bg-current" />
            </div>

            <button
              onClick={() => { setShowRestore(true); setRestoreMode('select'); }}
              className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-100 bg-white px-6 text-sm font-bold text-slate-600 transition-all hover:border-slate-200 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <span>{t('register.restoreLink')}</span>
              <span className="text-lg transition-transform group-hover:rotate-12">↺</span>
            </button>
          </div>
        ) : (
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
            {restoreMode === 'select' ? (
              <>
                <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
                  {t('register.restoreHeading')}
                </h2>
                <p className="mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {t('register.howToRestore')}
                </p>
                <div className="flex flex-col gap-4">
                  <button onClick={() => { setRestoreMode('code'); setCode(''); }} className="h-14 w-full rounded-2xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
                    {t('register.restoreViaCode')}
                  </button>
                  <button onClick={() => { setRestoreMode('email'); setCode(''); }} className="h-14 w-full rounded-2xl border-2 border-brand-yellow/30 bg-brand-yellow/10 text-brand-yellow font-bold hover:bg-brand-yellow/20 transition-colors relative">
                    {t('register.restoreViaEmail')} <span className="opacity-70 text-xs ml-1 font-medium bg-brand-yellow/20 px-2 py-0.5 rounded-md right-4 absolute top-1/2 -translate-y-1/2">{t('register.teacher')}</span>
                  </button>
                </div>
              </>
            ) : restoreMode === 'email' ? (
              <form onSubmit={handleEmailRestore} className="flex flex-col gap-6">
                <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">{t('register.restoreViaEmail')}</h2>
                <input
                  className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-semibold text-slate-900 transition-colors focus:border-brand-yellow focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-brand-yellow dark:focus:bg-slate-900"
                  type="email"
                  placeholder="name@school.edu"
                  value={restoreEmail}
                  onChange={e => setRestoreEmail(e.target.value)}
                  autoFocus
                  disabled={restoring}
                  required
                />
                {restoreError && (
                  <p className="flex items-center gap-2 font-medium text-red-500"><span className="text-xl">⚠</span> {restoreError}</p>
                )}
                <button type="submit" disabled={restoring || !restoreEmail} className="group relative h-16 w-full cursor-pointer overflow-hidden rounded-[20px] bg-brand-yellow px-8 py-4 transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center uppercase font-black text-slate-900">
                  {restoring ? t('register.restoring') : t('register.sendMagicLink')}
                </button>
              </form>
            ) : restoreMode === 'email-verify' ? (
              <form onSubmit={handleVerifyEmailRestore} className="flex flex-col gap-6">
                <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">{t('register.enter6DigitCode')}</h2>
                <input
                  className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-6 text-2xl font-black tracking-widest text-center transition-all focus:border-brand-yellow focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-brand-yellow dark:focus:bg-slate-900"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={6}
                  autoFocus
                  disabled={restoring || syncing}
                  required
                />
                {restoreError && (
                  <p className="flex items-center gap-2 font-medium text-red-500"><span className="text-xl">⚠</span> {restoreError}</p>
                )}
                <button type="submit" disabled={restoring || syncing || code.length !== 6} className="group relative h-16 w-full cursor-pointer overflow-hidden rounded-[20px] bg-[#10B981] px-8 py-4 transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center uppercase font-black tracking-wider text-white">
                  {syncing ? t('register.awaitingSync') : (restoring ? t('register.verifying') : t('register.verifyLogin'))}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRestore} className="flex flex-col gap-6">
                <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
                  {t('register.restoreHeading')}
                </h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {t('register.restoreDesc')}
                </p>
                {autoRestoreCode && (
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-yellow border-t-transparent" />
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {t('register.restoring')}
                    </p>
                  </div>
                )}
                {!autoRestoreCode && (
                  <>
                    <input
                      className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-6 text-2xl font-black tracking-[0.2em] text-slate-900 transition-all focus:border-brand-yellow focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-brand-yellow dark:focus:bg-slate-900 text-center"
                      type="text"
                      placeholder={t('register.restorePlaceholder')}
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      maxLength={12}
                      autoFocus
                      disabled={restoring}
                    />
                    {restoreError && (
                      <p className="flex items-center gap-2 font-medium text-red-500">
                        <span className="text-xl">⚠</span> {restoreError}
                      </p>
                    )}
                    <button
                      className="group relative h-16 w-full cursor-pointer overflow-hidden rounded-[20px] bg-brand-yellow px-8 py-4 transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center uppercase font-black text-slate-900"
                      type="submit"
                      disabled={restoring || code.trim().length !== 12}
                    >
                      {restoring ? t('register.restoring') : (
                         <>{t('register.restore')} <span className="transition-transform ltr:group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180">→</span></>
                      )}
                    </button>
                  </>
                )}
              </form>
            )}

            <button
               onClick={() => { 
                if (restoreMode === 'email' || restoreMode === 'code' || restoreMode === 'email-verify') {
                  setRestoreMode('select'); setRestoreError(''); setCode(''); setRestoreEmail('');
                } else {
                  setShowRestore(false); setCode(''); setRestoreError(''); setAutoRestoreCode(null); 
                }
              }}
              className="group mt-6 flex w-full items-center justify-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-brand-yellow dark:text-slate-400"
            >
              ← <span>{restoreMode !== 'select' ? t('register.backToRecovery') : t('register.newAccount')}</span>
            </button>
          </div>
        )}
      </div>

      <p className="mt-12 max-w-xs text-center text-sm font-medium leading-relaxed text-slate-400 dark:text-slate-500 pb-12">
        {t('register.footer')}
      </p>
    </PageContainer>
  );
}

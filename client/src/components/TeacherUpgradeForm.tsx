import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducer as useSTDBReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings/index.js';

interface Props {
  myIdentityHex: string | undefined;
  name?: string;
  /** Called after successful verification. */
  onUpgraded?: () => void;
}

/**
 * Self-contained teacher upgrade flow: email → HMAC verification code → reducer.
 * Used in both AccountPage and ClassroomsPage.
 */
export default function TeacherUpgradeForm({ myIdentityHex, name, onUpgraded }: Props) {
  const { t, i18n } = useTranslation();
  const verifyTeacherUpgrade = useSTDBReducer(reducers.verifyTeacherUpgrade);

  const [email, setEmail] = useState('');
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [verifyStep, setVerifyStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [hmacSignature, setHmacSignature] = useState('');
  const [expiresAtMs, setExpiresAtMs] = useState<number>(0);

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !consent1 || !consent2) {
      setError(t('register_split.consent_1'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const isNativeApp = window.location.origin === 'http://localhost' || window.location.origin.startsWith('capacitor://');
      const apiBase = import.meta.env.VITE_API_URL || (!isNativeApp ? window.location.origin : 'https://up.bilharz.eu');
      const res = await fetch(`${apiBase}/api/send-teacher-verif`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), identityHex: myIdentityHex, name, locale: i18n.language }),
      });
      if (!res.ok) {
        let errorMsg = 'Failed to send verification email';
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch {
          if (res.status === 404) {
            errorMsg =
              "API endpoint not found. On localhost, please use 'vercel dev' instead of 'npm run dev' to test email features.";
          } else {
            const text = await res.text().catch(() => '');
            errorMsg = `Server returned ${res.status}: ${text || 'Unknown Error'}`;
          }
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      setHmacSignature(data.signature);
      setExpiresAtMs(data.expiresAt);
      setVerifyStep(true);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? t('register.usernameError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (verificationCode.trim().length !== 6) return;
    setSubmitting(true);
    setError('');
    try {
      await verifyTeacherUpgrade({
        username: undefined,
        email: email.trim(),
        code: verificationCode.trim(),
        signature: hmacSignature,
        expiresAtMs: BigInt(expiresAtMs),
        gdprConsent: true,
        teacherDeclaration: true,
      });
      setVerifyStep(false);
      onUpgraded?.();
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Invalid verification code');
    } finally {
      setSubmitting(false);
    }
  };

  if (!verifyStep) {
    return (
      <div className="flex flex-col gap-4">
        <form onSubmit={handleSendCode} className="flex flex-col gap-4">
          <input
            className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5 text-[15px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 shadow-inner"
            type="email"
            placeholder={t('register_split.email_label')}
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={submitting}
            required
          />
          <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={consent1}
              onChange={e => setConsent1(e.target.checked)}
              className="mt-1 h-4 w-4 bg-white border-brand-yellow rounded-md checked:bg-brand-yellow checked:border-brand-yellow focus:ring-brand-yellow focus:ring-offset-0 dark:bg-slate-900"
              required
            />
            <span className="leading-snug relative top-[2px]">{t('register_split.consent_1')}</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={consent2}
              onChange={e => setConsent2(e.target.checked)}
              className="mt-1 h-4 w-4 bg-white border-brand-yellow rounded-md checked:bg-brand-yellow checked:border-brand-yellow focus:ring-brand-yellow focus:ring-offset-0 dark:bg-slate-900"
              required
            />
            <span className="leading-snug relative top-[2px]">{t('register_split.consent_2')}</span>
          </label>
          <button
            className="w-full rounded-2xl bg-brand-yellow px-6 py-4 text-[15px] font-black text-slate-900 uppercase tracking-widest transition-transform active:scale-95 disabled:opacity-50 shadow-sm shadow-brand-yellow/20"
            type="submit"
            disabled={submitting || !email.trim() || !consent1 || !consent2}
          >
            {submitting ? 'Sending Code...' : t('common.save')}
          </button>
        </form>
        {error && (
          <p className="text-red-600 dark:text-red-400 font-bold text-xs bg-red-50 dark:bg-red-900/20 py-2.5 px-3.5 rounded-lg border border-red-100 dark:border-red-900/50">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Verify Your Email</h3>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        We just sent a 6-digit verification code to{' '}
        <strong className="text-slate-700 dark:text-slate-300">{email}</strong>.
      </p>
      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        <input
          className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-6 text-2xl font-black tracking-[0.2em] text-slate-900 transition-all focus:border-brand-yellow focus:bg-white focus:outline-none dark:text-white dark:focus:border-brand-yellow text-center shadow-inner"
          type="text"
          placeholder="123456"
          value={verificationCode}
          onChange={e => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
          maxLength={6}
          autoFocus
          disabled={submitting}
          required
        />
        <button
          className="w-full rounded-2xl bg-[#10B981] px-6 py-4 text-[15px] font-black text-white uppercase tracking-widest transition-transform active:scale-95 disabled:opacity-50 shadow-sm"
          type="submit"
          disabled={submitting || verificationCode.length !== 6}
        >
          {submitting ? 'Verifying...' : 'Verify'}
        </button>
      </form>
      {error && (
        <p className="text-red-600 dark:text-red-400 font-bold text-xs bg-red-50 dark:bg-red-900/20 py-2.5 px-3.5 rounded-lg border border-red-100 dark:border-red-900/50">
          {error}
        </p>
      )}
    </div>
  );
}

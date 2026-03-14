import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { RecoveryCodeResult, TransferCodeResult } from '../module_bindings/types.js';
import type { ParseKeys } from 'i18next';
import { capturedToken } from '../auth.js';

type Player = {
  identity: { toHexString(): string };
  username: string;
  bestScore: number;
  totalSessions: number;
  recoveryEmailed?: boolean;
};

interface Props {
  myPlayer: Player;
  myIdentityHex: string;
  onBack: () => void;
}

export default function AccountPage({ myPlayer, myIdentityHex }: Props) {
  const { t, i18n } = useTranslation();
  const [transferCodeResults] = useTable(tables.transfer_code_results);
  const [recoveryCodeResults] = useTable(tables.recovery_code_results);
  const setUsernameReducer = useSTDBReducer(reducers.setUsername);
  const createTransferCode = useSTDBReducer(reducers.createTransferCode);
  const cleanupCode = useSTDBReducer(reducers.useTransferCode);
  const _createRecoveryKey = useSTDBReducer(reducers.createRecoveryKey);
  const regenerateRecoveryKey = useSTDBReducer(reducers.regenerateRecoveryKey);
  const markRecoveryEmailed = useSTDBReducer(reducers.markRecoveryEmailed);
  // Username rename
  const [newName, setNewName] = useState(myPlayer.username);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Recovery key — read from private result table populated by getMyRecoveryCode reducer (SEC-03)
  const myRecoveryKey = (recoveryCodeResults as unknown as RecoveryCodeResult[]).find(
    r => r.owner.toHexString() === myIdentityHex
  );
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const handleGenerateRecoveryKey = async () => {
    if (!capturedToken) return;
    setGeneratingKey(true);
    await regenerateRecoveryKey({ token: capturedToken });
    setGeneratingKey(false);
  };

  const handleCopyKey = () => {
    if (!myRecoveryKey) return;
    navigator.clipboard.writeText(myRecoveryKey.code);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  // Email recovery key
  const [emailInput, setEmailInput] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleEmailKey = async () => {
    if (!myRecoveryKey || !emailInput.trim()) return;
    setEmailSending(true);
    setEmailError('');
    try {
      const res = await fetch('/api/send-recovery-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim(), code: myRecoveryKey.code }),
      });
      if (!res.ok) throw new Error();
      await markRecoveryEmailed();
      setEmailSent(true);
    } catch {
      setEmailError(t('account.emailKeyError'));
    } finally {
      setEmailSending(false);
    }
  };

  // Transfer code
  const [generating, setGenerating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [codeShownAt, setCodeShownAt] = useState<number | null>(null);
  const [transferCopied, setTransferCopied] = useState(false);

  const CODE_TTL = 10 * 60; // 600 seconds — matches server TTL set in Plan 03 (SEC-03)

  // Transfer code — read from private result table populated by createTransferCode reducer (SEC-03)
  const myCode = (transferCodeResults as unknown as TransferCodeResult[]).find(
    c => c.owner.toHexString() === myIdentityHex
  );

  useEffect(() => {
    if (myCode && codeShownAt === null) {
      setCodeShownAt(Date.now());
    } else if (!myCode) {
      setCodeShownAt(null);
      setCountdown(null);
    }
  }, [myCode?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (codeShownAt === null) return;
    const tick = () => {
      const elapsed = Math.round((Date.now() - codeShownAt) / 1000);
      const left = Math.max(0, CODE_TTL - elapsed);
      setCountdown(left);
      if (left === 0 && myCode) cleanupCode({ code: myCode.code });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [codeShownAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRename = async () => {
    const name = newName.trim();
    if (!name || name === myPlayer.username) return;
    setNameSaving(true);
    await setUsernameReducer({ newUsername: name });
    setNameSaving(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const handleGenerateCode = async () => {
    if (!capturedToken) return;
    setGenerating(true);
    await createTransferCode({ token: capturedToken });
    setGenerating(false);
  };

  const handleCopyTransfer = () => {
    if (!myCode) return;
    navigator.clipboard.writeText(myCode.code);
    setTransferCopied(true);
    setTimeout(() => setTransferCopied(false), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem('spacetimemath_credentials');
    window.location.reload();
  };

  const fmtCountdown = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const initials = myPlayer.username.slice(0, 2).toUpperCase();

  return (
    <div className="page" style={{ maxWidth: 520 }}>

      {/* Profile header */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent)', color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 20, flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>{myPlayer.username}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {t('account.sessions', { count: myPlayer.totalSessions })}
            {' · '}{t('account.best')} <span style={{ color: 'var(--warn)', fontWeight: 600 }}>{myPlayer.bestScore.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Language selector */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{t('account.language')}</span>
        <button
          onClick={() => i18n.changeLanguage(i18n.language.startsWith('de') ? 'en' : 'de')}
          style={{
            fontSize: 13, fontWeight: 700,
            background: 'var(--card2)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '6px 16px',
            color: 'var(--text)', cursor: 'pointer',
          }}
        >
          {i18n.language.startsWith('de') ? 'English' : 'Deutsch'}
        </button>
      </div>

      {/* Display name */}
      <div className="card">
        <h2 style={{ marginBottom: 16, fontSize: 16 }}>{t('account.displayName')}</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="field"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={24}
            style={{ flex: 1 }}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
          />
          <button
            className="btn btn-primary"
            onClick={handleRename}
            disabled={nameSaving || !newName.trim() || newName.trim() === myPlayer.username}
          >
            {nameSaved ? t('common.saved') : nameSaving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {/* Account recovery */}
      <div className="card">
        <h2 style={{ marginBottom: 4, fontSize: 16 }}>{t('account.recovery')}</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
          {t('account.recoveryDesc')}
        </p>

        {/* Transfer code */}
        <h3 style={{ marginBottom: 4 }}>{t('account.transferCode')}</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          {t('account.transferDesc')}
        </p>
        {myCode ? (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: 'monospace', fontSize: 34, fontWeight: 800, letterSpacing: 8,
              color: 'var(--accent)', background: 'var(--card2)', border: '2px solid var(--accent)',
              borderRadius: 10, padding: '14px 20px', marginBottom: 8, textAlign: 'center',
            }}>
              {myCode.code}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleCopyTransfer}>
                {transferCopied ? t('common.copied') : t('common.copy')}
              </button>
              <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={handleGenerateCode} disabled={generating}>
                {t('account.newCode')}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
              {countdown !== null && countdown > 0 ? t('account.transferExpires', { time: fmtCountdown(countdown) }) : t('account.transferExpired')}
            </p>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleGenerateCode}
            disabled={generating || !capturedToken}
            style={{ width: '100%', marginBottom: 20 }}
          >
            {generating ? t('common.generating') : t('account.generateCode')}
          </button>
        )}

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 20px' }} />

        {/* Recovery key */}
        <h3 style={{ marginBottom: 4 }}>{t('account.recoveryKey')}</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          {t('account.recoveryKeyDesc')}
        </p>
        {myRecoveryKey ? (
          <div>
            <div style={{
              fontFamily: 'monospace', fontSize: 22, fontWeight: 800, letterSpacing: 5,
              color: 'var(--accent)', background: 'var(--card2)', border: '2px solid var(--accent)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 8, textAlign: 'center',
            }}>
              {myRecoveryKey.code}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleCopyKey}>
                {keyCopied ? t('common.copied') : t('common.copy')}
              </button>
              <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={handleGenerateRecoveryKey} disabled={generatingKey}>
                {t('account.regenerate')}
              </button>
            </div>
            {/* Email recovery key */}
            <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              {emailSent || myPlayer.recoveryEmailed ? (
                <p style={{ fontSize: 13, color: 'var(--correct)', textAlign: 'center' }}>
                  ✓ {t('account.emailKeySent')}
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                    {t('account.emailKeyDesc')}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      placeholder={t('account.emailKeyPlaceholder')}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--card2)', color: 'var(--text)', fontSize: 14,
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleEmailKey()}
                    />
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 13, whiteSpace: 'nowrap' }}
                      onClick={handleEmailKey}
                      disabled={emailSending || !emailInput.trim()}
                    >
                      {emailSending ? '…' : t('account.emailKeySend')}
                    </button>
                  </div>
                  {emailError && <p style={{ fontSize: 12, color: 'var(--wrong)', marginTop: 6 }}>{emailError}</p>}
                </>
              )}
            </div>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleGenerateRecoveryKey}
            disabled={generatingKey || !capturedToken}
            style={{ width: '100%' }}
          >
            {generatingKey ? t('common.generating') : t('account.generateRecoveryKey')}
          </button>
        )}
      </div>

      {/* Danger zone */}
      <div className="card" style={{ borderColor: 'rgba(232,57,29,0.4)' }}>
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>{t('account.session')}</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          {t('account.logoutDesc')}
        </p>
        <button className="btn btn-danger" onClick={handleLogout} style={{ width: '100%' }}>
          {t('account.logout')}
        </button>
      </div>

      {/* Legal */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', paddingBottom: 8 }}>
        {[
          { key: 'account.imprint',  href: 'https://www.bettermarks.com/impressum/' },
          { key: 'account.privacy',  href: 'https://www.bettermarks.com/datenschutz/' },
          { key: 'account.terms',    href: 'https://www.bettermarks.com/agb/' },
        ].map(({ key, href }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}
          >
            {t(key as ParseKeys)}
          </a>
        ))}
      </div>
    </div>
  );
}

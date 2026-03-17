import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer, useSpacetimeDB } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { RecoveryCodeResult } from '../module_bindings/types.js';
import type { ParseKeys } from 'i18next';
import { capturedToken } from '../auth.js';

type Player = {
  identity: { toHexString(): string };
  username: string;
  bestScore: number;
  totalSessions: number;
  recoveryEmailed?: boolean;
  learningTier: number;
  extendedMode: boolean;
};

interface Props {
  myPlayer: Player;
  myIdentityHex: string;
  onBack: () => void;
}

export default function AccountPage({ myPlayer }: Props) {
  const { t, i18n } = useTranslation();
  const { identity } = useSpacetimeDB();
  const [recoveryCodeResults] = useTable(
    identity
      ? tables.recovery_code_results.where(r => r.owner.eq(identity))
      : tables.recovery_code_results
  );
  const setUsernameReducer = useSTDBReducer(reducers.setUsername);
  const _createRecoveryKey = useSTDBReducer(reducers.createRecoveryKey);
  const regenerateRecoveryKey = useSTDBReducer(reducers.regenerateRecoveryKey);
  const markRecoveryEmailed = useSTDBReducer(reducers.markRecoveryEmailed);
  // Username rename
  const [newName, setNewName] = useState(myPlayer.username);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Recovery key — read from private result table populated by getMyRecoveryCode reducer (SEC-03)
  // Subscription is scoped to the caller's identity, so [0] is the only possible row.
  const myRecoveryKey = (recoveryCodeResults as unknown as RecoveryCodeResult[])[0];
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyRevealed, setKeyRevealed] = useState(false);

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

  const handleRename = async () => {
    const name = newName.trim();
    if (!name || name === myPlayer.username) return;
    setNameSaving(true);
    await setUsernameReducer({ newUsername: name });
    setNameSaving(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem('spacetimemath_credentials');
    window.location.reload();
  };

  const deletePlayer = useSTDBReducer(reducers.deletePlayer);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    await deletePlayer();
    localStorage.removeItem('spacetimemath_credentials');
    window.location.reload();
  };

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
        <div className="flex-1">
          <div className="fw-bold text-20">{myPlayer.username}</div>
          <div className="text-sm text-muted mt-1">
            {t('account.sessions', { count: myPlayer.totalSessions })}
            {' · '}{t('account.best')} <span className="text-warn fw-semibold">{myPlayer.bestScore.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Language selector */}
      <div className="card row-between">
        <span className="fw-semibold text-15">{t('account.language')}</span>
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
        <h2 className="mb-4 text-16">{t('account.displayName')}</h2>
        <div className="row gap-10">
          <input
            className="field flex-1"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={24}
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
        <h2 className="mb-1 text-16">{t('account.recovery')}</h2>
        <p className="text-sm text-muted mb-5">
          {t('account.recoveryDesc')}
        </p>

        {/* Recovery key */}
        <h3 className="mb-1">{t('account.recoveryKey')}</h3>
        <p className="text-sm text-muted mb-3">
          {t('account.recoveryKeyDesc')}
        </p>
        {myRecoveryKey ? (
          <div>
            <div className="code-box" style={{ fontSize: 22, letterSpacing: 5, padding: '12px 44px 12px 16px', position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ flex: 1 }}>{keyRevealed ? myRecoveryKey.code : '••••••••••••'}</span>
              <button
                onClick={() => setKeyRevealed(r => !r)}
                aria-label={keyRevealed ? t('account.hide') : t('account.reveal')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, opacity: keyRevealed ? 1 : 0.5, padding: 4 }}
              >
                👁️
              </button>
            </div>
            <div className="row-center gap-8">
              {keyRevealed && (
                <button className="btn btn-primary text-sm" onClick={handleCopyKey}>
                  {keyCopied ? t('common.copied') : t('common.copy')}
                </button>
              )}
              <button className="btn btn-secondary text-sm" onClick={handleGenerateRecoveryKey} disabled={generatingKey}>
                {t('account.regenerate')}
              </button>
            </div>
            {/* Email recovery key — always visible */}
            <div className="divider-top">
              <p className="text-sm text-muted mb-2">
                {t('account.emailKeyDesc')}
              </p>
              <div className="row gap-8">
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder={t('account.emailKeyPlaceholder')}
                  className="flex-1"
                  style={{
                    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--card2)', color: 'var(--text)', fontSize: 14,
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleEmailKey()}
                />
                <button
                  className="btn btn-primary text-sm"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={handleEmailKey}
                  disabled={emailSending || !emailInput.trim()}
                >
                  {emailSending ? '…' : t('account.emailKeySend')}
                </button>
              </div>
              {emailSent && <p className="text-sm text-correct mt-1">✓ {t('account.emailKeySent')}</p>}
              {emailError && <p className="text-error text-12 mt-1">{emailError}</p>}
            </div>
          </div>
        ) : (
          <button
            className="btn btn-primary w-full"
            onClick={handleGenerateRecoveryKey}
            disabled={generatingKey || !capturedToken}
          >
            {generatingKey ? t('common.generating') : t('account.generateRecoveryKey')}
          </button>
        )}
      </div>

      {/* Danger zone */}
      <div className="card" style={{ borderColor: 'rgba(232,57,29,0.4)' }}>
        <h2 className="mb-2 text-16">{t('account.session')}</h2>
        <p className="text-sm text-muted mb-4">
          {t('account.logoutDesc')}
        </p>
        <button className="btn btn-danger w-full" onClick={handleLogout}>
          {t('account.logout')}
        </button>

        {confirmDelete && (
          <>
            <div style={{ borderTop: '1px solid rgba(232,57,29,0.25)', margin: '16px 0 12px' }} />
            <div className="col gap-8">
              <p className="text-sm text-muted">{t('account.deleteDesc')}</p>
              <div className="row gap-8">
                <button
                  className="btn btn-secondary btn-sm flex-1"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  {t('account.deleteCancel')}
                </button>
                <button
                  className="btn btn-danger btn-sm flex-1"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? '…' : t('account.deleteConfirm')}
                </button>
              </div>
            </div>
          </>
        )}

        {!confirmDelete && (
          <div className="text-center mt-12">
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 8px',
                cursor: 'pointer',
                color: 'rgba(232,57,29,0.55)',
                fontSize: 12,
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
                textUnderlineOffset: 3,
              }}
            >
              {t('account.deleteAccount')}
            </button>
          </div>
        )}
      </div>

      {/* Legal */}
      <div className="row-center gap-16 flex-wrap pb-2">
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
            className="text-muted text-12 no-underline"
          >
            {t(key as ParseKeys)}
          </a>
        ))}
      </div>
    </div>
  );
}

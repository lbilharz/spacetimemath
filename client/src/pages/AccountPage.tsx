import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer, useSpacetimeDB } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { RecoveryCodeResult, Player } from '../module_bindings/types.js';
import type { ParseKeys } from 'i18next';
import { capturedToken } from '../auth.js';
import LanguagePicker from '../components/LanguagePicker.js';
import PageContainer from '../components/PageContainer.js';
import { AccountIcon } from '../components/Icons.js';


interface Props {
  myPlayer: Player;
  myIdentityHex: string;
  onBack: () => void;
}



export default function AccountPage({ myPlayer }: Props) {
  const { t } = useTranslation();
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
  const [nameEditing, setNameEditing] = useState(false);
  const [newName, setNewName] = useState(myPlayer.username);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Recovery key — read from private result table populated by getMyRecoveryCode reducer (SEC-03)
  // Subscription is scoped to the caller's identity, so [0] is the only possible row.
  const myRecoveryKey = (recoveryCodeResults as unknown as RecoveryCodeResult[])[0];
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const handleGenerateRecoveryKey = async () => {
    if (!capturedToken) return;
    setGeneratingKey(true);
    await regenerateRecoveryKey({ token: capturedToken });
    setGeneratingKey(false);
    setConfirmRegenerate(false);
    setKeyRevealed(false);
  };

  const handleCopyKey = () => {
    if (!myRecoveryKey) return;
    navigator.clipboard.writeText(myRecoveryKey.code);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  // Email recovery UI variables removed

  const handleRename = async () => {
    const name = newName.trim();
    if (!name || name === myPlayer.username) { setNameEditing(false); return; }
    setNameSaving(true);
    await setUsernameReducer({ newUsername: name });
    setNameSaving(false);
    setNameSaved(true);
    setNameEditing(false);
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
    <PageContainer className="pb-[100px] sm:pb-[140px]">
      <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-4 mb-2 flex items-center gap-3">
        <div className="flex xl:h-[42px] xl:w-[42px] shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 shadow-sm">
          <AccountIcon className="drop-shadow-sm scale-110" />
        </div>
        {t('nav.account')}
      </h1>

      {/* Profile header */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 transition-colors">
        <div className="flex items-center gap-5 relative">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-yellow font-black text-2xl text-slate-900 shadow-inner">
            {initials}
          </div>
          <div className="flex flex-1 flex-col justify-center gap-1.5 min-w-0">
            {nameEditing ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full mt-1">
                <input
                  className="flex-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  maxLength={24}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setNewName(myPlayer.username); setNameEditing(false); } }}
                />
                <div className="flex gap-2">
                  <button className="flex-1 sm:flex-none rounded-xl bg-brand-yellow px-4 py-2 text-sm font-bold text-slate-900 transition-transform active:scale-95 disabled:opacity-50" onClick={handleRename} disabled={nameSaving || !newName.trim()}>
                    {nameSaving ? '…' : nameSaved ? t('common.saved') : t('common.save')}
                  </button>
                  <button className="flex-1 sm:flex-none rounded-xl bg-slate-100 dark:bg-slate-700/50 px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 transition-transform active:scale-95 border border-slate-200 dark:border-slate-700/50" onClick={() => { setNewName(myPlayer.username); setNameEditing(false); }}>
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-slate-900 dark:text-white truncate">{myPlayer.username}</span>
                    <button
                      onClick={() => { setNewName(myPlayer.username); setNameEditing(true); }}
                      aria-label={t('account.displayName')}
                      className="rounded-full bg-slate-100 p-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 active:scale-90"
                    >
                      ✏️
                    </button>
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 whitespace-nowrap">
                    {t('account.sessions', { count: myPlayer.totalSessions })}
                    <span className="mx-1.5 text-slate-300 dark:text-slate-600">•</span>
                    {t('account.best')} <span className="font-bold text-amber-500 ml-1">{myPlayer.bestScore.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* App Preferences */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 transition-colors">
        <h2 className="mb-6 text-base font-bold text-slate-900 dark:text-white">⚙️ {t('account.settings')}</h2>
        
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-700 dark:text-slate-300">{t('account.darkMode')}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('account.darkModeDesc')}</div>
            </div>
            <button
              onClick={() => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
              }}
              className="flex h-10 w-14 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 text-lg transition-colors border border-slate-200 dark:border-slate-700 shadow-inner active:scale-95"
              title="Toggle Dark Mode"
            >
              <span className="dark:hidden opacity-80">🌙</span>
              <span className="hidden dark:inline opacity-80">☀️</span>
            </button>
          </div>

          <div className="h-px w-full bg-slate-100 dark:bg-slate-700/50" />

          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-slate-700 dark:text-slate-300">{t('account.language')}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('account.languageDesc')}</div>
            </div>
            <LanguagePicker />
          </div>
        </div>
      </div>

      {/* Account recovery */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 transition-colors">
        <h2 className="mb-1.5 text-base font-bold text-slate-900 dark:text-white">🔑 {t('account.recovery')}</h2>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {t('account.recoveryDesc')}
        </p>

        {/* Recovery key */}
        <h3 className="mb-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">{t('account.recoveryKey')}</h3>
        {myRecoveryKey ? (
          <div className="flex flex-col gap-4">
            <div className="relative flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="flex-1 p-3 px-4 font-mono text-lg font-bold tracking-[0.2em] text-slate-900 dark:text-slate-100">
                {keyRevealed ? myRecoveryKey.code : '••••••••••••'}
              </div>
              <button
                onClick={() => setKeyRevealed(r => !r)}
                aria-label={keyRevealed ? t('account.hide') : t('account.reveal')}
                className="flex h-full items-center justify-center px-4 text-xl opacity-70 transition-opacity hover:opacity-100 active:scale-95"
              >
                {keyRevealed ? '🙈' : '👁️'}
              </button>
            </div>
            
            {!confirmRegenerate ? (
              <div className="flex flex-wrap gap-2">
                {keyRevealed && (
                  <button className="flex-1 rounded-xl bg-brand-yellow px-4 py-2.5 text-xs font-bold text-slate-900 transition-transform active:scale-95 shadow-sm" onClick={handleCopyKey}>
                    {keyCopied ? t('common.copied') : t('common.copy')}
                  </button>
                )}
                <button className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-700/50 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-transform active:scale-95 border border-slate-200 dark:border-slate-700/50 shadow-sm" onClick={() => setConfirmRegenerate(true)} disabled={generatingKey}>
                  {generatingKey ? '...' : t('account.regenerate')}
                </button>
              </div>
            ) : (
              <div className="mt-1 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-500/10 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-xs font-bold text-red-600 dark:text-red-400">
                  {t('account.regenerateDesc')}
                </p>
                <div className="flex gap-2">
                  <button
                    className="flex-1 rounded-xl bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-transform active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm"
                    onClick={() => setConfirmRegenerate(false)}
                    disabled={generatingKey}
                  >
                    {t('account.deleteCancel')}
                  </button>
                  <button
                    className="flex-1 rounded-xl bg-red-600 dark:bg-red-500 text-white px-4 py-2.5 text-xs font-bold transition-transform active:scale-95 shadow-md shadow-red-600/20"
                    onClick={handleGenerateRecoveryKey}
                    disabled={generatingKey}
                  >
                    {generatingKey ? '...' : t('account.regenerateConfirm')}
                  </button>
                </div>
              </div>
            )}

            {/* Email recovery disabled until domain is purchased */}
            {!myPlayer.recoveryEmailed && (
              <div className="mt-3 pt-5 border-t border-slate-100 dark:border-slate-700/50 flex flex-col gap-2">
                <button
                  className="w-full rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors active:scale-[0.98]"
                  onClick={() => markRecoveryEmailed()}
                >
                  ✓ {t('account.keySaved')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="w-full rounded-xl bg-brand-yellow px-4 py-3 text-sm font-bold text-slate-900 transition-transform active:scale-[0.98] shadow-sm"
            onClick={handleGenerateRecoveryKey}
            disabled={generatingKey || !capturedToken}
          >
            {generatingKey ? t('common.generating') : t('account.generateRecoveryKey')}
          </button>
        )}
      </div>

      {/* Danger zone */}
      <div className="flex flex-col rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/30 dark:bg-slate-800/80 transition-colors">
        <h2 className="mb-2 text-base font-bold text-red-600 dark:text-red-400">{t('account.session')}</h2>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
          {t('account.logoutDesc')}
        </p>
        <button className="w-full rounded-xl bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-3 text-xs font-bold transition-transform active:scale-[0.98] border border-red-200 dark:border-red-500/20" onClick={handleLogout}>
          {t('account.logout')}
        </button>

        {confirmDelete && (
          <div className="mt-4 pt-4 border-t border-red-100 dark:border-red-900/50 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-xs font-bold text-red-600 dark:text-red-400">{t('account.deleteDesc')}</p>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-transform active:scale-95"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                {t('account.deleteCancel')}
              </button>
              <button
                className="flex-1 rounded-xl bg-red-600 dark:bg-red-500 text-white px-4 py-2.5 text-xs font-bold transition-transform active:scale-95 shadow-lg shadow-red-600/20"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? '…' : t('account.deleteConfirm')}
              </button>
            </div>
          </div>
        )}

        {!confirmDelete && (
          <div className="text-center mt-6">
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs font-bold text-red-400 dark:text-red-500/60 underline decoration-red-400/50 dark:decoration-red-500/30 underline-offset-4 transition-colors hover:text-red-600 dark:hover:text-red-400"
            >
              {t('account.deleteAccount')}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 pb-2">
        {[
          { key: 'account.imprint',  href: 'https://better1up.vercel.app/impressum' },
          { key: 'account.privacy',  href: 'https://better1up.vercel.app/datenschutz' },
        ].map(({ key, href }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            {t(key as ParseKeys)}
          </a>
        ))}
      </div>
    </PageContainer>
  );
}

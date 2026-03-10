import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import { capturedToken } from '../auth.js';

type Player = {
  identity: { toHexString(): string };
  username: string;
  bestScore: number;
  totalSessions: number;
};

interface Props {
  myPlayer: Player;
  myIdentityHex: string;
  onEnterClassroom: (id: bigint) => void;
  onBack: () => void;
}

export default function AccountPage({ myPlayer, myIdentityHex, onEnterClassroom }: Props) {
  const { t, i18n } = useTranslation();
  const [transferCodes] = useTable(tables.transfer_codes);
  const [recoveryKeys] = useTable(tables.recovery_keys);
  const [classrooms] = useTable(tables.classrooms);
  const [classroomMembers] = useTable(tables.classroom_members);
  const setUsernameReducer = useSTDBReducer(reducers.setUsername);
  const createTransferCode = useSTDBReducer(reducers.createTransferCode);
  const cleanupCode = useSTDBReducer(reducers.useTransferCode);
  const createRecoveryKey = useSTDBReducer(reducers.createRecoveryKey);
  const leaveClassroom = useSTDBReducer(reducers.leaveClassroom);

  // Username rename
  const [newName, setNewName] = useState(myPlayer.username);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Recovery key
  const myRecoveryKey = (recoveryKeys as any[]).find(
    k => k.owner.toHexString() === myIdentityHex
  );
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const handleGenerateRecoveryKey = async () => {
    if (!capturedToken) return;
    setGeneratingKey(true);
    await createRecoveryKey({ token: capturedToken });
    setGeneratingKey(false);
  };

  const handleCopyKey = () => {
    if (!myRecoveryKey) return;
    navigator.clipboard.writeText(myRecoveryKey.code);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  // Transfer code
  const [generating, setGenerating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [codeShownAt, setCodeShownAt] = useState<number | null>(null);
  const [transferCopied, setTransferCopied] = useState(false);

  const CODE_TTL = 60 * 60;

  const myCode = (transferCodes as any[]).find(
    c => c.owner.toHexString() === myIdentityHex
  );

  useEffect(() => {
    if (myCode && codeShownAt === null) {
      setCodeShownAt(Date.now());
    } else if (!myCode) {
      setCodeShownAt(null);
      setCountdown(null);
    }
  }, [myCode?.code]);

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
  }, [codeShownAt]);

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

  // Classrooms
  const myMemberships = (classroomMembers as any[]).filter(
    m => m.playerIdentity.toHexString() === myIdentityHex
  );
  const myClassroomList = myMemberships
    .map((m: any) => {
      const c = (classrooms as any[]).find(cl => cl.id === m.classroomId);
      if (!c) return null;
      const memberCount = (classroomMembers as any[]).filter(cm => cm.classroomId === c.id).length;
      const isTeacher = c.teacher?.toHexString() === myIdentityHex;
      return { ...c, memberCount, isTeacher };
    })
    .filter(Boolean);

  const [leavingId, setLeavingId] = useState<bigint | null>(null);
  const handleLeaveClassroom = async (cid: bigint) => {
    setLeavingId(cid);
    await leaveClassroom({ classroomId: cid });
    setLeavingId(null);
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

      {/* Classrooms */}
      {myClassroomList.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>{t('account.myClassrooms')}</h2>
          {myClassroomList.map((c: any) => (
            <div key={String(c.id)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 8, paddingBottom: 10, marginBottom: 10,
              borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <button
                  onClick={() => onEnterClassroom(c.id)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, color: 'var(--accent)', fontSize: 15 }}
                >
                  {c.name}
                </button>
                <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>
                  {c.isTeacher ? t('common.teacher') : t('common.student')} · {t('account.members', { count: c.memberCount })} · {t('common.code')} <code style={{ color: 'var(--text)' }}>{c.code}</code>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => onEnterClassroom(c.id)}
                  style={{ fontSize: 12 }}
                >
                  {t('account.viewClass')}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleLeaveClassroom(c.id)}
                  disabled={leavingId === c.id}
                  style={{ fontSize: 12 }}
                >
                  {leavingId === c.id ? '…' : c.isTeacher ? t('account.closeClass') : t('account.leaveClass')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}

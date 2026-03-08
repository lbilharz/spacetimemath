import { useState, useEffect } from 'react';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import { capturedToken } from '../auth.js';

type Player = { identity: { toHexString(): string }; username: string };

interface Props {
  myPlayer: Player;
  myIdentityHex: string;
  onEnterClassroom: (id: bigint) => void;
  onBack: () => void;
}

export default function AccountPage({ myPlayer, myIdentityHex, onEnterClassroom, onBack }: Props) {
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

  const CODE_TTL = 60 * 60; // 1 hour in seconds

  const myCode = (transferCodes as any[]).find(
    c => c.owner.toHexString() === myIdentityHex
  );

  // Start client-side countdown when a code appears
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

  // Classrooms — all memberships
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

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <button
        className="btn btn-secondary"
        onClick={onBack}
        style={{ alignSelf: 'flex-start', marginBottom: 8, fontSize: 13 }}
      >
        ← Back
      </button>

      <h1 style={{ fontSize: 22, marginBottom: 24 }}>⚙ Account</h1>

      {/* Username */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 16, fontSize: 16 }}>Display name</h2>
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
            {nameSaved ? '✓ Saved' : nameSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Transfer code */}
      <div className="card">
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>Transfer to another device</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Generate a one-time 6-character code. Enter it on your other device within 60 minutes
          to continue with the same account and score history.
        </p>

        {myCode ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: 8,
              color: 'var(--accent)',
              background: 'var(--card2)',
              border: '2px solid var(--accent)',
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 12,
            }}>
              {myCode.code}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              {countdown !== null && countdown > 0
                ? `Expires in ${fmtCountdown(countdown)} · single use`
                : 'Expired'}
            </p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 12, fontSize: 13 }}
              onClick={handleGenerateCode}
              disabled={generating}
            >
              Generate new code
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleGenerateCode}
            disabled={generating || !capturedToken}
            style={{ width: '100%' }}
          >
            {generating ? 'Generating…' : 'Generate code'}
          </button>
        )}
      </div>

      {/* Recovery key */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>Recovery key</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          A permanent 12-character key — never expires, works from any device.
          Store it in your password manager or write it down.
        </p>
        {myRecoveryKey ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'monospace',
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 5,
              color: 'var(--accent)',
              background: 'var(--card2)',
              border: '2px solid var(--accent)',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 12,
            }}>
              {myRecoveryKey.code}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13 }}
                onClick={handleCopyKey}
              >
                {keyCopied ? '✓ Copied' : '⎘ Copy'}
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 13 }}
                onClick={handleGenerateRecoveryKey}
                disabled={generatingKey}
              >
                Regenerate
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
            {generatingKey ? 'Generating…' : 'Generate recovery key'}
          </button>
        )}
      </div>

      {/* Classrooms */}
      {myClassroomList.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>My Classrooms</h2>
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
                  {c.isTeacher ? 'Teacher' : 'Student'} · {c.memberCount} member{c.memberCount !== 1 ? 's' : ''} · code <code style={{ color: 'var(--text)' }}>{c.code}</code>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => onEnterClassroom(c.id)}
                  style={{ fontSize: 12 }}
                >
                  View →
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleLeaveClassroom(c.id)}
                  disabled={leavingId === c.id}
                  style={{ fontSize: 12 }}
                >
                  {leavingId === c.id ? '…' : c.isTeacher ? '✕ Close' : 'Leave'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logout */}
      <div className="card" style={{ marginTop: 16, borderColor: 'var(--danger, #c0392b)' }}>
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>Session</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Logging out removes this device's access to your account. Your scores and username
          are kept on the server — use a transfer code first if you want to sign in again later.
        </p>
        <button
          className="btn btn-danger"
          onClick={handleLogout}
          style={{ width: '100%' }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}

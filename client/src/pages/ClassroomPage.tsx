import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import MasteryGrid from '../components/MasteryGrid.js';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  myIdentityHex: string;
  classroomId: bigint;
  onStartSprint: (sessionId: bigint) => void;
  onStartClassSprint: (classSprintId: bigint) => void;
  onLeave: () => void;
}

export default function ClassroomPage({ myIdentityHex, classroomId, onStartSprint, onStartClassSprint, onLeave }: Props) {
  const { t } = useTranslation();
  const [classrooms]        = useTable(tables.classrooms);
  const [classroomMembers]  = useTable(tables.classroom_members);
  const [classSprints]      = useTable(tables.class_sprints);
  const [sessions]          = useTable(tables.sessions);
  const [answers]           = useTable(tables.answers);
  const [players]           = useTable(tables.players);
  const [problemStats]      = useTable(tables.problem_stats);
  const [recoveryKeys]      = useTable(tables.recovery_keys);

  const leaveClassroom   = useSTDBReducer(reducers.leaveClassroom);
  const startSession     = useSTDBReducer(reducers.startSession);
  const toggleVisibility = useSTDBReducer(reducers.toggleClassroomVisibility);
  const startClassSprint = useSTDBReducer(reducers.startClassSprint);
  const endClassSprint   = useSTDBReducer(reducers.endClassSprint);

  const [codeCopied, setCodeCopied] = useState(false);
  const [codeTextCopied, setCodeTextCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startingClassSprint, setStartingClassSprint] = useState(false);
  const [isDiagnostic, setIsDiagnostic] = useState(false);
  const [sprintError, setSprintError] = useState<string | null>(null);
  const [endingClassSprint, setEndingClassSprint] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [togglingVis, setTogglingVis] = useState(false);

  // Teacher QR card modal
  const [qrStudent, setQrStudent] = useState<{ username: string; code: string } | null>(null);

  // Find this specific classroom
  const myClassroom = (classrooms as any[]).find(c => c.id === classroomId) ?? null;
  const myMembership = (classroomMembers as any[]).find(
    m => m.classroomId === classroomId && m.playerIdentity.toHexString() === myIdentityHex
  );

  if (!myClassroom) {
    return (
      <div className="loading">
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>{t('classroom.notFound')}</span>
      </div>
    );
  }

  const isTeacher = myClassroom.teacher.toHexString() === myIdentityHex;
  const amHidden: boolean = myMembership?.hidden ?? false;

  // ── Class sprint state ──────────────────────────────────────────────────────
  const roomSprints = (classSprints as any[])
    .filter(s => s.classroomId === classroomId)
    .sort((a, b) => Number(b.id - a.id));
  const latestSprint = roomSprints[0] ?? null;
  const activeSprint = latestSprint?.isActive ? latestSprint : null;
  const endedSprint  = latestSprint && !latestSprint.isActive ? latestSprint : null;

  // Sessions + answers belonging to the active/ended sprint (for live ticker + mini LB)
  const sprintSessions = latestSprint
    ? (sessions as any[]).filter(s => s.classSprintId === latestSprint.id)
    : [];
  const sprintSessionIds = new Set<bigint>(sprintSessions.map((s: any) => s.id as bigint));
  const sprintAnswers = (answers as any[]).filter(a => sprintSessionIds.has(a.sessionId));

  // Last 20 answers sorted newest-first for the live ticker
  const recentAnswers = [...sprintAnswers]
    .sort((a, b) => Number(b.id - a.id))
    .slice(0, 20);

  // Mini live leaderboard (top 5) — compute score from answers, not session.weightedScore
  // (weightedScore is only written at end_session; it stays 0 during an active sprint)
  const liveLB = sprintSessions
    .map((s: any) => {
      const p = (players as any[]).find(pl => pl.identity.toHexString() === s.playerIdentity.toHexString());
      const mine = sprintAnswers.filter((a: any) => a.sessionId === s.id);
      const score = mine
        .filter((a: any) => a.isCorrect)
        .reduce((sum: number, a: any) => {
          const key = (a.a as number) * 100 + (a.b as number);
          const stat = (problemStats as any[]).find(ps => ps.problemKey === key);
          return sum + (stat?.difficultyWeight ?? 1.0);
        }, 0);
      const correct = mine.filter((a: any) => a.isCorrect).length;
      return { username: p?.username ?? s.username, score, correct };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // True once every student session has finished — used to auto-end the sprint
  const allSessionsComplete =
    sprintSessions.length > 0 &&
    sprintSessions.every((s: any) => s.isComplete as boolean);

  const handleStartClassSprint = async () => {
    setStartingClassSprint(true);
    setSprintError(null);
    try {
      await startClassSprint({ classroomId, isDiagnostic });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSprintError(msg);
    } finally {
      setStartingClassSprint(false);
    }
  };

  const handleEndClassSprint = async () => {
    if (!activeSprint) return;
    setEndingClassSprint(true);
    try {
      await endClassSprint({ classSprintId: activeSprint.id });
    } finally {
      setEndingClassSprint(false);
    }
  };

  // Early exit: call end_class_sprint as soon as all online students finish,
  // rather than waiting for the server's 62 s scheduled auto-end.
  useEffect(() => {
    if (!isTeacher || !activeSprint || !allSessionsComplete) return;
    endClassSprint({ classSprintId: activeSprint.id }).catch(console.error);
  }, [allSessionsComplete, activeSprint?.id, isTeacher]); // eslint-disable-line react-hooks/exhaustive-deps
  // Offline-student deadline is handled server-side via the EndSprintSchedule table.

  // ── End of class sprint state ───────────────────────────────────────────────

  // All members of this classroom
  const members = (classroomMembers as any[]).filter(m => m.classroomId === classroomId);
  // Visible members (included in leaderboard + mastery)
  const visibleMembers = members.filter((m: any) => !m.hidden);
  const visibleIds = new Set(visibleMembers.map((m: any) => m.playerIdentity.toHexString()));

  // Best weighted score per VISIBLE member (across all time)
  const bestByMember = new Map<string, number>();
  for (const s of sessions as any[]) {
    if (!s.isComplete || !visibleIds.has(s.playerIdentity.toHexString())) continue;
    const id = s.playerIdentity.toHexString();
    if ((bestByMember.get(id) ?? 0) < s.weightedScore) {
      bestByMember.set(id, s.weightedScore);
    }
  }

  // Recovery key lookup (teacher only) — recovery_keys is a public table
  const recoveryKeyByIdentity = new Map<string, string>();
  if (isTeacher) {
    for (const k of recoveryKeys as any[]) {
      recoveryKeyByIdentity.set(k.owner.toHexString(), k.code);
    }
  }

  // All member rows (for the Members card — shows everyone)
  const memberRows = members.map((m: any) => {
    const id = m.playerIdentity.toHexString();
    const player = (players as any[]).find(p => p.identity.toHexString() === id);
    const recoveryCode = recoveryKeyByIdentity.get(id);
    return {
      id,
      username: player?.username ?? id.slice(0, 8),
      best: bestByMember.get(id),
      hidden: m.hidden as boolean,
      recoveryCode,
    };
  }).sort((a, b) => (b.best ?? 0) - (a.best ?? 0));

  // Leaderboard rows — visible only, sorted by best score
  const leaderRows = memberRows.filter(m => !m.hidden && m.best !== undefined);

  // Mastery grid — only answers from visible members
  const classAnswers = (answers as any[]).filter(a => visibleIds.has(a.playerIdentity.toHexString()));

  const handleToggleVisibility = async () => {
    setTogglingVis(true);
    await toggleVisibility({ classroomId });
    setTogglingVis(false);
  };

  const handleStart = async () => {
    setStarting(true);
    await startSession();
    onStartSprint(0n);
  };

  const handleLeave = async () => {
    setLeaving(true);
    await leaveClassroom({ classroomId });
    onLeave();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/?join=${myClassroom.code}`);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCopyCodeText = () => {
    navigator.clipboard.writeText(myClassroom.code);
    setCodeTextCopied(true);
    setTimeout(() => setCodeTextCopied(false), 2000);
  };

  const restoreUrl = (code: string) => `${window.location.origin}/?restore=${code}`;

  /** Open a printable window with one card per student who has a recovery key. */
  const handlePrintAll = () => {
    const rows = memberRows.filter(m => m.recoveryCode);
    if (rows.length === 0) return;

    const cards = rows.map(m => `
      <div class="card">
        <div class="name">${m.username}</div>
        <div class="class">${myClassroom.name}</div>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(restoreUrl(m.recoveryCode!))}" width="160" height="160" />
        <div class="code">${m.recoveryCode}</div>
        <div class="hint">Scan or type to log in on any device</div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${myClassroom.name} – Login Cards</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #fff; color: #000; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 16px; }
    .card { border: 1.5px solid #ccc; border-radius: 10px; padding: 16px 12px; text-align: center; break-inside: avoid; }
    .name { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
    .class { font-size: 12px; color: #888; margin-bottom: 12px; }
    img { display: block; margin: 0 auto 10px; }
    .code { font-family: monospace; font-size: 14px; letter-spacing: 2px; color: #444; margin-bottom: 4px; }
    .hint { font-size: 11px; color: #aaa; }
    @media print { @page { size: A4; margin: 12mm; } }
  </style>
</head>
<body>
  <div class="grid">${cards}</div>
  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const medals = ['🥇', '🥈', '🥉'];
  const studentsWithCards = memberRows.filter(m => m.recoveryCode).length;


  return (
    <div className="page">

      {/* Student QR login card modal */}
      {qrStudent && (
        <div
          onClick={() => setQrStudent(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 16, padding: 32, maxWidth: 300, width: '100%', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{qrStudent.username}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>{myClassroom.name}</div>
            <div style={{ background: '#fff', padding: 12, borderRadius: 10, display: 'inline-block', marginBottom: 12 }}>
              <QRCodeSVG value={restoreUrl(qrStudent.code)} size={180} />
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: 3, color: 'var(--muted)', marginBottom: 6 }}>
              {qrStudent.code}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
              {t('classroom.studentLoginHint')}
            </div>
            <button className="btn btn-secondary" onClick={() => setQrStudent(null)} style={{ width: '100%' }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>
            {activeSprint ? <span style={{ color: 'var(--wrong)', marginRight: 8 }}>🔴</span> : '📚 '}
            {myClassroom.name}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 2 }}>
            {isTeacher ? t('classroom.youAreTeaching') : t('classroom.youAreStudent')} · {t('classroom.members', { count: members.length })}
          </p>
          {activeSprint && isTeacher && (
            <p style={{ color: 'var(--wrong)', fontSize: 13, fontWeight: 700, marginTop: 4 }}>
              {t('classSprint.live')}
            </p>
          )}
        </div>

        {/* Right-side controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          {isTeacher ? (
            /* Teacher: class sprint controls only */
            <>
              {!activeSprint && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <label style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isDiagnostic}
                      onChange={e => setIsDiagnostic(e.target.checked)}
                      style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                    />
                    {t('classSprint.diagnostic')}
                  </label>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={handleStartClassSprint}
                    disabled={startingClassSprint}
                    style={{ minWidth: 160 }}
                  >
                    {startingClassSprint ? t('classSprint.starting') : t('classSprint.start')}
                  </button>
                  {sprintError && (
                    <p style={{ fontSize: 12, color: 'var(--wrong)', margin: 0, maxWidth: 220, textAlign: 'right' }}>
                      ⚠ {sprintError}
                    </p>
                  )}
                </div>
              )}
              {activeSprint && (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleEndClassSprint}
                  disabled={endingClassSprint}
                  style={{ minWidth: 160, background: 'var(--wrong)', borderColor: 'var(--wrong)' }}
                >
                  {t('classSprint.end')}
                </button>
              )}
              {endedSprint && !activeSprint && (
                <button
                  className="btn btn-secondary"
                  onClick={() => onStartClassSprint(endedSprint.id)}
                  style={{ minWidth: 160, fontSize: 13 }}
                >
                  {t('classSprint.viewResults')}
                </button>
              )}
            </>
          ) : (
            /* Student: solo sprint */
            <button
              className="btn btn-primary btn-lg"
              onClick={handleStart}
              disabled={starting}
              style={{ minWidth: 140 }}
            >
              {starting ? t('classroom.starting') : t('classroom.startSprint')}
            </button>
          )}
        </div>
      </div>

      {/* Live feed — shown during an active class sprint (teacher only) */}
      {isTeacher && activeSprint && (
        <div className="card" style={{ borderColor: 'rgba(255,60,60,0.4)' }}>

          {/* 1 — Combined class grid (always on top) */}
          <h3 style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('classSprint.grid')}
          </h3>
          <MasteryGrid answers={sprintAnswers} problemStats={problemStats as any[]} />

          {/* 2 — Ticker + leaderboard below the grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>

            {/* Rolling answer ticker — newest on top, old rows fall off the bottom */}
            <div>
              <h3 style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('classSprint.liveAnswers')}
              </h3>
              {recentAnswers.length === 0 ? (
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>{t('classSprint.waitingForAnswers')}</span>
              ) : (
                <div style={{ overflow: 'hidden', maxHeight: 180, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {recentAnswers.map((a: any) => {
                    const p = (players as any[]).find(pl => pl.identity.toHexString() === a.playerIdentity.toHexString());
                    const name = p?.username ?? '?';
                    return (
                      <div key={String(a.id)} style={{
                        display: 'flex', gap: 6, alignItems: 'center', fontSize: 13,
                        color: a.isCorrect ? 'var(--accent)' : 'var(--wrong)',
                        flexShrink: 0,
                      }}>
                        <span>{a.isCorrect ? '🟢' : '🔴'}</span>
                        <span style={{ fontWeight: 600 }}>{name}</span>
                        <span style={{ color: 'var(--muted)' }}>{a.a}×{a.b}</span>
                        <span>{a.isCorrect ? '✓' : '✗'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mini live leaderboard */}
            <div>
              <h3 style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('classSprint.liveScores')}
              </h3>
              {liveLB.length === 0 ? (
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>{t('classSprint.noScoresYet')}</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {liveLB.map((r, i) => (
                    <div key={r.username} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', width: 16, textAlign: 'right' }}>{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{r.username}</span>
                      <span style={{ fontSize: 13, color: 'var(--muted)', marginRight: 4 }}>{r.correct}✓</span>
                      <span style={{ fontSize: 13, color: 'var(--warn)', fontVariantNumeric: 'tabular-nums' }}>
                        {r.score.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Join code + QR */}
      <div className="card">
        <h2 style={{ marginBottom: 12, fontSize: 16 }}>{t('classroom.joinCode')}</h2>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <button
              onClick={handleCopyCodeText}
              title={t('classroom.copyCodeHint')}
              style={{
                fontFamily: 'monospace', fontSize: 36, fontWeight: 800,
                letterSpacing: 10, color: 'var(--accent)', marginBottom: 4,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'block', WebkitTapHighlightColor: 'transparent',
              }}
            >
              {myClassroom.code}
            </button>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 10px' }}>
              {codeTextCopied ? `✓ ${t('common.copied')}` : t('classroom.copyCodeHint')}
            </p>
            <button className="btn btn-secondary" onClick={handleCopyLink} style={{ fontSize: 13 }}>
              {codeCopied ? t('common.copied') : t('classroom.copyLink')}
            </button>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, maxWidth: 220 }}>
              {t('classroom.joinHint')}
            </p>
          </div>
          <div style={{ background: '#fff', padding: 8, borderRadius: 8, lineHeight: 0 }}>
            <QRCodeSVG
              value={`${window.location.origin}/?join=${myClassroom.code}`}
              size={120}
            />
          </div>
        </div>
      </div>

      {/* Members + Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {/* Members */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 16 }}>{t('classroom.membersHeading')}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isTeacher && studentsWithCards > 0 && (
                <button
                  className="btn btn-secondary"
                  onClick={handlePrintAll}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  🖨 {t('classroom.printCards')}
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={handleToggleVisibility}
                disabled={togglingVis}
                style={{ fontSize: 12, padding: '4px 10px' }}
                title={amHidden ? t('classroom.showStatsTitle') : t('classroom.hideStatsTitle')}
              >
                {amHidden ? t('classroom.showStats') : t('classroom.hideStats')}
              </button>
            </div>
          </div>
          {amHidden && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, fontStyle: 'italic' }}>
              {t('classroom.hiddenHint')}
            </p>
          )}
          {memberRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>{t('classroom.noMembers')}</p>
          ) : (
            memberRows.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: i < memberRows.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: m.hidden ? 0.5 : 1,
              }}>
                <span style={{ fontWeight: m.id === myIdentityHex ? 700 : 400 }}>
                  {m.username}
                  {m.id === myIdentityHex && (
                    <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 12 }}>{t('common.you')}</span>
                  )}
                  {m.hidden && (
                    <span style={{ color: 'var(--muted)', marginLeft: 6, fontSize: 11 }}>{t('classroom.hidden')}</span>
                  )}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!m.hidden && m.best !== undefined ? (
                    <span style={{ color: 'var(--warn)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                      {m.best.toFixed(1)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {m.hidden ? '—' : t('classroom.noSessions')}
                    </span>
                  )}
                  {/* Teacher: tap 🔑 to show this student's personal login QR */}
                  {isTeacher && m.recoveryCode && (
                    <button
                      onClick={() => setQrStudent({ username: m.username, code: m.recoveryCode! })}
                      title={t('classroom.showLoginCard')}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 16, padding: '0 2px', lineHeight: 1,
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      🔑
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Class leaderboard */}
        <div className="card">
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>{t('classroom.leaderboard')}</h2>
          {leaderRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>{t('classroom.leaderboardEmpty')}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={th}>{t('classroom.colHash')}</th>
                  <th style={{ ...th, textAlign: 'left' }}>{t('classroom.colPlayer')}</th>
                  <th style={th}>{t('classroom.colScore')}</th>
                </tr>
              </thead>
              <tbody>
                {leaderRows.map((m, i) => {
                  const isMe = m.id === myIdentityHex;
                  return (
                    <tr key={m.id} style={{
                      borderBottom: '1px solid var(--border)',
                      background: isMe ? 'rgba(251,186,0,0.08)' : 'transparent',
                    }}>
                      <td style={{ ...td, fontWeight: 700, color: i < 3 ? 'var(--warn)' : 'var(--muted)', textAlign: 'center' }}>
                        {i < 3 ? medals[i] : i + 1}
                      </td>
                      <td style={{ ...td, fontWeight: isMe ? 700 : 400 }}>
                        {m.username}
                        {isMe && <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 12 }}>{t('common.you')}</span>}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--warn)', fontVariantNumeric: 'tabular-nums' }}>
                        {m.best!.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            {t('classroom.liveCaption')}
          </p>
        </div>
      </div>

      {/* Class mastery grid */}
      {classAnswers.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 4, fontSize: 16 }}>{t('classroom.classMastery')}</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {t('classroom.classMasteryDesc', { count: visibleMembers.length })}
          </p>
          <MasteryGrid answers={classAnswers} problemStats={problemStats as any[]} />
        </div>
      )}

      {/* Leave / Close */}
      <div>
        <button
          className="btn btn-secondary"
          onClick={handleLeave}
          disabled={leaving}
          style={{ fontSize: 14 }}
        >
          {leaving ? t('classroom.leaving') : isTeacher ? t('classroom.closeClass') : t('classroom.leaveClass')}
        </button>
        {isTeacher && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            {t('classroom.closeHint')}
          </p>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '8px 4px', fontSize: 12, fontWeight: 600, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right',
};
const td: React.CSSProperties = { padding: '10px 4px', fontSize: 15 };

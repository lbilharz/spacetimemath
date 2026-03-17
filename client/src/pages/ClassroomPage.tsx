import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Answer, ClassSprint, Classroom, ClassroomMember, Player, ProblemStat, Session } from '../module_bindings/types.js';
import MasteryGrid from '../components/MasteryGrid.js';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  myIdentityHex: string;
  classroomId: bigint;
  onStartSprint: (sessionId: bigint) => void;
  onStartClassSprint: (classSprintId: bigint) => void;
  onLeave: () => void;
}

interface ClassRecoveryResult {
  memberIdentity: { toHexString: () => string };
  teacherIdentity: { toHexString: () => string };
  classroomId: bigint;
  username: string;
  code: string;
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
  // recovery_keys removed (SEC-01): private table — teachers can no longer read student recovery codes

  const leaveClassroom        = useSTDBReducer(reducers.leaveClassroom);
  const toggleVisibility      = useSTDBReducer(reducers.toggleClassroomVisibility);
  const startClassSprint      = useSTDBReducer(reducers.startClassSprint);
  const endClassSprint        = useSTDBReducer(reducers.endClassSprint);
  const getClassRecoveryCodes = useSTDBReducer(reducers.getClassRecoveryCodes);
  // Subscription not filtered server-side — rows are teacher-scoped at insert time.
  // Client filters by classroomId in the polling loop below.
  const [classRecoveryResults] = useTable(tables.class_recovery_results);
  // Ref so async polling in handleDownloadCodes always reads the latest rows
  const classRecoveryResultsRef = useRef<ClassRecoveryResult[]>([]);
  useEffect(() => {
    classRecoveryResultsRef.current = classRecoveryResults as unknown as ClassRecoveryResult[];
  }, [classRecoveryResults]);

  const [codeCopied, setCodeCopied] = useState(false);
  const [codeTextCopied, setCodeTextCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printCards, setPrintCards] = useState<ClassRecoveryResult[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [startingClassSprint, setStartingClassSprint] = useState(false);
  const [isDiagnostic, setIsDiagnostic] = useState(false);
  const [sprintError, setSprintError] = useState<string | null>(null);
  const [endingClassSprint, setEndingClassSprint] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [togglingVis, setTogglingVis] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);

  // Teacher QR card modal
  const [qrStudent, setQrStudent] = useState<{ username: string; code: string } | null>(null);

  // Countdown timer for teacher's live feed view
  const [sprintTimeLeft, setSprintTimeLeft] = useState<number | null>(null);

  // Find this specific classroom
  const myClassroom = (classrooms as unknown as Classroom[]).find(c => c.id === classroomId) ?? null;
  const myMembership = (classroomMembers as unknown as ClassroomMember[]).find(
    m => m.classroomId === classroomId && m.playerIdentity.toHexString() === myIdentityHex
  );

  // Derived state — computed unconditionally so hooks below are never called after an early return.
  const isTeacher = myClassroom?.teacher.toHexString() === myIdentityHex;
  const amHidden: boolean = myMembership?.hidden ?? false;

  // ── Class sprint state ──────────────────────────────────────────────────────
  const roomSprints = (classSprints as unknown as ClassSprint[])
    .filter(s => s.classroomId === classroomId)
    .sort((a, b) => Number(b.id - a.id));
  const latestSprint = roomSprints[0] ?? null;
  const activeSprint = latestSprint?.isActive ? latestSprint : null;
  const endedSprint  = latestSprint && !latestSprint.isActive ? latestSprint : null;

  // Sessions + answers belonging to the active/ended sprint (for live ticker + mini LB)
  const latestSprintIdStr = latestSprint ? String(latestSprint.id) : null;
  const sprintSessions = latestSprint
    ? (sessions as unknown as Session[]).filter(s => String(s.classSprintId) === latestSprintIdStr)
    : [];
  const sprintSessionIdStrs = new Set<string>(sprintSessions.map(s => String(s.id)));
  const sprintAnswers = (answers as unknown as Answer[]).filter(a => sprintSessionIdStrs.has(String(a.sessionId)));

  // Last 20 answers sorted newest-first for the live ticker
  const recentAnswers = [...sprintAnswers]
    .sort((a, b) => Number(b.id - a.id))
    .slice(0, 20);

  // Mini live leaderboard (top 5) — compute score from answers, not session.weightedScore
  // (weightedScore is only written at end_session; it stays 0 during an active sprint)
  const liveLB = sprintSessions
    .map(s => {
      const p = (players as unknown as Player[]).find(pl => pl.identity.toHexString() === s.playerIdentity.toHexString());
      const mine = sprintAnswers.filter(a => String(a.sessionId) === String(s.id));
      const score = mine
        .filter(a => a.isCorrect)
        .reduce((sum, a) => {
          const key = a.a * 100 + a.b;
          const stat = (problemStats as unknown as ProblemStat[]).find(ps => ps.problemKey === key);
          return sum + (stat?.difficultyWeight ?? 1.0);
        }, 0);
      const correct = mine.filter(a => a.isCorrect).length;
      return { username: p?.username ?? s.username, score, correct };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // True once every student session has finished — used to auto-end the sprint
  const allSessionsComplete =
    sprintSessions.length > 0 &&
    sprintSessions.every(s => s.isComplete);

  // Early exit: call end_class_sprint as soon as all online students finish,
  // rather than waiting for the server's 62 s scheduled auto-end.
  useEffect(() => {
    if (!isTeacher || !activeSprint || !allSessionsComplete) return;
    endClassSprint({ classSprintId: activeSprint.id }).catch(console.error);
  }, [allSessionsComplete, activeSprint?.id, isTeacher]); // eslint-disable-line react-hooks/exhaustive-deps
  // Offline-student deadline is handled server-side via the EndSprintSchedule table.

  // Countdown timer — ticks from server startedAt, same logic as SprintPage
  useEffect(() => {
    if (!activeSprint || !isTeacher) { setSprintTimeLeft(null); return; }
    const DURATION = 60;
    const startMs = Number(activeSprint.startedAt.microsSinceUnixEpoch / 1000n);
    const tick = () => setSprintTimeLeft(Math.max(0, DURATION - Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeSprint?.id, isTeacher]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger window.print() once inline cards are rendered
  useEffect(() => {
    if (!printCards) return;
    const id = setTimeout(() => {
      window.print();
      setPrintCards(null);
    }, 100);
    return () => clearTimeout(id);
  }, [printCards]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── End of class sprint state ───────────────────────────────────────────────

  if (!myClassroom) {
    return (
      <div className="loading">
        <span className="text-muted text-base">{t('classroom.notFound')}</span>
      </div>
    );
  }

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

  // All members of this classroom
  const members = (classroomMembers as unknown as ClassroomMember[]).filter(m => m.classroomId === classroomId);
  // Visible members (included in leaderboard + mastery)
  const visibleMembers = members.filter(m => !m.hidden);
  const visibleIds = new Set(visibleMembers.map(m => m.playerIdentity.toHexString()));

  // Best weighted score per VISIBLE member (across all time)
  const bestByMember = new Map<string, number>();
  for (const s of sessions as unknown as Session[]) {
    if (!s.isComplete || !visibleIds.has(s.playerIdentity.toHexString())) continue;
    const id = s.playerIdentity.toHexString();
    if ((bestByMember.get(id) ?? 0) < s.weightedScore) {
      bestByMember.set(id, s.weightedScore);
    }
  }

  // ACCT-04: Populate from class_recovery_results (teacher's private result table)
  // Subscription is already scoped to this teacher's identity server-side; only filter by classroomId.
  const myClassRecoveryCodes = (classRecoveryResults as unknown as ClassRecoveryResult[])
    .filter(r => r.classroomId === classroomId);
  const recoveryKeyByIdentity = new Map<string, string>(
    myClassRecoveryCodes.map(r => [r.memberIdentity.toHexString(), r.code])
  );

  // All member rows (for the Members card — shows everyone)
  const memberRows = members.map(m => {
    const id = m.playerIdentity.toHexString();
    const player = (players as unknown as Player[]).find(p => p.identity.toHexString() === id);
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
  const classAnswers = (answers as unknown as Answer[]).filter(a => visibleIds.has(a.playerIdentity.toHexString()));

  const handleToggleVisibility = async () => {
    setTogglingVis(true);
    await toggleVisibility({ classroomId });
    setTogglingVis(false);
  };

  const handleStart = () => {
    setStarting(true);
    onStartSprint(0n); // SprintPage owns session creation on mount
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

  /** Fetch recovery codes and trigger browser print dialog via inline overlay — no popup needed. */
  const handlePrintAll = async () => {
    if (printing || !myClassroom) return;
    setPrinting(true);
    setPrintError(null);
    try {
      const prevCount = classRecoveryResultsRef.current.filter(r => r.classroomId === classroomId).length;
      await getClassRecoveryCodes({ classroomId });
      const POLL = 50, TIMEOUT = 5_000;
      let resultRows: ClassRecoveryResult[] = [];
      if (prevCount > 0) {
        const clearDeadline = Date.now() + 2_000;
        while (Date.now() < clearDeadline) {
          if (classRecoveryResultsRef.current.filter(r => r.classroomId === classroomId).length === 0) break;
          await new Promise(res => setTimeout(res, POLL));
        }
      }
      const deadline = Date.now() + TIMEOUT;
      while (Date.now() < deadline) {
        resultRows = classRecoveryResultsRef.current.filter(r => r.classroomId === classroomId);
        if (resultRows.length > 0) break;
        await new Promise(res => setTimeout(res, POLL));
      }
      if (resultRows.length === 0) {
        setPrintError(t('classroom.printNoKeys'));
        return;
      }
      setPrintCards(resultRows);
    } finally {
      setPrinting(false);
    }
  };

  const medals = ['🥇', '🥈', '🥉'];


  return (
    <div className="page" style={isTeacher ? { maxWidth: 1100 } : undefined}>

      {/* Student QR login card modal */}
      {qrStudent && (
        <div
          onClick={() => setQrStudent(null)}
          className="modal-backdrop"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="modal-card modal-card--narrow"
          >
            <div className="fw-extrabold mb-1 text-lg">{qrStudent.username}</div>
            <div className="text-sm text-muted mb-4">{myClassroom.name}</div>
            <div className="qr-white-box--lg mb-3">
              <QRCodeSVG value={restoreUrl(qrStudent.code)} size={180} />
            </div>
            <div className="text-sm text-muted mb-2 mono letter-spacing-3">
              {qrStudent.code}
            </div>
            <div className="text-xs text-muted mb-20">
              {t('classroom.studentLoginHint')}
            </div>
            <button className="btn btn-secondary w-full" onClick={() => setQrStudent(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Print overlay — invisible on screen, visible only during window.print() */}
      {printCards && (
        <div className="print-cards-overlay" style={{ display: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 16 }}>
            {printCards.map(r => (
              <div key={r.memberIdentity.toHexString()} style={{ border: '1.5px solid #ccc', borderRadius: 10, padding: '16px 12px', textAlign: 'center', breakInside: 'avoid' }}>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{r.username}</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>{myClassroom.name}</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <QRCodeSVG value={restoreUrl(r.code)} size={160} />
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 14, letterSpacing: 2, color: '#444', marginBottom: 4 }}>{r.code}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>{t('classroom.studentLoginHint')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="row-between row-wrap gap-8 align-start">
        <div>
          <h1>
            {activeSprint ? <span className="text-error mr-2">🔴</span> : '📚 '}
            {myClassroom.name}
          </h1>
          <p className="text-muted text-base mt-2">
            {isTeacher ? t('classroom.youAreTeaching') : t('classroom.youAreStudent')} · {t('classroom.members', { count: members.length })}
          </p>
          {activeSprint && isTeacher && (
            <p className="text-error text-sm fw-bold mt-2">
              {t('classSprint.live')}
            </p>
          )}
        </div>

        {/* Right-side controls */}
        <div className="col gap-8 align-end">
          {isTeacher ? (
            /* Teacher: class sprint controls only */
            <>
              {!activeSprint && (
                <div className="col align-end gap-8">
                  <label className="text-sm text-muted row gap-6 cursor-pointer">
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
                  >
                    {startingClassSprint ? t('classSprint.starting') : t('classSprint.start')}
                  </button>
                  {sprintError && (
                    <p className="text-xs text-error text-right sprint-error">
                      ⚠ {sprintError}
                    </p>
                  )}
                </div>
              )}
              {activeSprint && (
                <button
                  className="btn btn-primary btn-lg btn-danger-outline"
                  onClick={handleEndClassSprint}
                  disabled={endingClassSprint}
                >
                  {t('classSprint.end')}
                </button>
              )}
              {endedSprint && !activeSprint && (
                <button
                  className="btn btn-secondary text-sm"
                  onClick={() => onStartClassSprint(endedSprint.id)}
                >
                  {t('classSprint.viewResults')}
                </button>
              )}
            </>
          ) : (
            /* Student: solo sprint */
            <button
              className="btn btn-primary btn-lg btn-sprint"
              onClick={handleStart}
              disabled={starting}
            >
              {starting ? t('classroom.starting') : t('classroom.startSprint')}
            </button>
          )}
        </div>
      </div>

      {/* Live feed — shown only during an active class sprint (teacher only) */}
      {isTeacher && activeSprint && (
        <div className="card classroom-live-card">

          {/* Timer bar — only while sprint is active */}
          {activeSprint && sprintTimeLeft !== null && (
            <div className="mb-4">
              <div className="row-between mb-1">
                <span className="text-xs text-muted label-caps">
                  {latestSprint?.isDiagnostic ? t('classSprint.diagnostic').replace(/\s*\(.*\)/, '') : t('classSprint.live')}
                </span>
                <span className={`text-sm fw-bold tabular-nums ${sprintTimeLeft <= 10 ? 'text-error' : sprintTimeLeft <= 20 ? 'text-warn' : 'text-accent'}`}>
                  {sprintTimeLeft}s
                </span>
              </div>
              <div className="sprint-timer-track">
                <div style={{
                  height: '100%',
                  width: `${(sprintTimeLeft / 60) * 100}%`,
                  background: sprintTimeLeft <= 10 ? 'var(--wrong)' : sprintTimeLeft <= 20 ? 'var(--warn)' : 'var(--accent)',
                  transition: 'width 1s linear, background 0.3s',
                  borderRadius: 3,
                }} />
              </div>
            </div>
          )}

          <div className="row gap-32 align-start row-wrap">

            {/* Left — Combined class grid */}
            <div className="flex-none">
              <h3 className="text-sm text-muted mb-2 label-caps">
                {t('classSprint.grid')}
              </h3>
              <MasteryGrid answers={sprintAnswers} problemStats={problemStats as unknown as ProblemStat[]} tier1Unlocked />
            </div>

            {/* Right — Ticker + leaderboard stacked */}
            <div className="row gap-24 sprint-ticker-panel">

              {/* Rolling answer ticker */}
              <div>
                <h3 className="text-sm text-muted mb-2 label-caps">
                  {t('classSprint.liveAnswers')}
                </h3>
                {recentAnswers.length === 0 ? (
                  <span className="text-muted text-sm">{t('classSprint.waitingForAnswers')}</span>
                ) : (
                  <div className="col gap-4">
                    {recentAnswers.map(a => {
                      const p = (players as unknown as Player[]).find(pl => pl.identity.toHexString() === a.playerIdentity.toHexString());
                      const name = p?.username ?? '?';
                      return (
                        <div key={String(a.id)} className={`row gap-6 text-sm ${a.isCorrect ? 'text-accent' : 'text-error'}`}>
                          <span>{a.isCorrect ? '🟢' : '🔴'}</span>
                          <span className="fw-semibold">{name}</span>
                          <span className="text-muted">{a.a}×{a.b}</span>
                          <span>{a.isCorrect ? '✓' : '✗'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mini live leaderboard */}
              <div>
                <h3 className="text-sm text-muted mb-2 label-caps">
                  {t('classSprint.liveScores')}
                </h3>
                {liveLB.length === 0 ? (
                  <span className="text-muted text-sm">{t('classSprint.noScoresYet')}</span>
                ) : (
                  <div className="col gap-6">
                    {liveLB.map((r, i) => (
                      <div key={r.username} className="row gap-8">
                        <span className="text-xs text-muted text-right w-4">{i + 1}</span>
                        <span className="text-sm fw-semibold flex-1">{r.username}</span>
                        <span className="text-sm text-muted mr-2">{r.correct}✓</span>
                        <span className="text-sm text-warn tabular-nums">
                          {r.score.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Members + Leaderboard */}
      <div className="classroom-two-col">
        {/* Members */}
        <div className="card">
          <div className="row-between row-wrap gap-8 mb-3">
            <h2 className="text-md">{t('classroom.membersHeading')}</h2>
            <div className="row gap-8">
              {isTeacher && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowJoinCode(v => !v)}
                >
                  🔗 {t('classroom.joinCode')} {showJoinCode ? '▲' : '▼'}
                </button>
              )}
              {isTeacher && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handlePrintAll}
                  disabled={members.length === 0 || printing}
                >
                  {printing ? '…' : `🖨 ${t('classroom.printCards')}`}
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleToggleVisibility}
                disabled={togglingVis}
                title={amHidden ? t('classroom.showStatsTitle') : t('classroom.hideStatsTitle')}
              >
                {amHidden ? t('classroom.showStats') : t('classroom.hideStats')}
              </button>
            </div>
          </div>
          {isTeacher && printError && (
            <p className="text-xs text-error mt-1">{printError}</p>
          )}

          {/* Inline join code — revealed on toggle */}
          {isTeacher && showJoinCode && (
            <div className="mb-3" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div className="row align-start gap-20 row-wrap">
                <div>
                  <button
                    onClick={handleCopyCodeText}
                    title={t('classroom.copyCodeHint')}
                    className="join-code-btn"
                  >
                    {myClassroom.code}
                  </button>
                  <p className="text-xs text-muted mb-10">
                    {codeTextCopied ? `✓ ${t('common.copied')}` : t('classroom.copyCodeHint')}
                  </p>
                  <button className="btn btn-secondary text-sm" onClick={handleCopyLink}>
                    {codeCopied ? t('common.copied') : t('classroom.copyLink')}
                  </button>
                  <p className="text-sm text-muted mt-2 max-w-220">
                    {t('classroom.joinHint')}
                  </p>
                </div>
                <div className="qr-white-box">
                  <QRCodeSVG
                    value={`${window.location.origin}/?join=${myClassroom.code}`}
                    size={110}
                  />
                </div>
              </div>
            </div>
          )}

          {amHidden && (
            <p className="text-xs text-muted mb-10 italic">
              {t('classroom.hiddenHint')}
            </p>
          )}
          {memberRows.length === 0 ? (
            <p className="text-muted text-base">{t('classroom.noMembers')}</p>
          ) : (
            memberRows.map((m, i) => (
              <div key={m.id} className="classroom-member-row" style={{
                borderBottom: i < memberRows.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: m.hidden ? 0.5 : 1,
              }}>
                <span className={m.id === myIdentityHex ? 'fw-bold' : ''}>
                  {m.username}
                  {m.id === myIdentityHex && (
                    <span className="text-accent ml-1 text-xs">{t('common.you')}</span>
                  )}
                  {m.hidden && (
                    <span className="text-muted ml-1 text-xs">{t('classroom.hidden')}</span>
                  )}
                </span>
                <div className="row gap-8">
                  {!m.hidden && m.best !== undefined ? (
                    <span className="text-warn text-base tabular-nums">
                      {m.best.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-muted text-xs">
                      {m.hidden ? '—' : t('classroom.noSessions')}
                    </span>
                  )}
                  {/* Teacher: tap 🔑 to show this student's personal login QR */}
                  {isTeacher && m.recoveryCode && (
                    <button
                      onClick={() => setQrStudent({ username: m.username, code: m.recoveryCode! })}
                      title={t('classroom.showLoginCard')}
                      className="btn-icon text-base"
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
          <h2 className="mb-3 text-md">{t('classroom.leaderboard')}</h2>
          {leaderRows.length === 0 ? (
            <p className="text-muted text-base">{t('classroom.leaderboardEmpty')}</p>
          ) : (
            <table className="table-full">
              <thead>
                <tr className="divider-bottom">
                  <th className="tbl-th">{t('classroom.colHash')}</th>
                  <th className="tbl-th tbl-th--left">{t('classroom.colPlayer')}</th>
                  <th className="tbl-th">{t('classroom.colScore')}</th>
                </tr>
              </thead>
              <tbody>
                {leaderRows.map((m, i) => {
                  const isMe = m.id === myIdentityHex;
                  return (
                    <tr key={m.id} className={isMe ? 'tr-highlight' : ''}>
                      <td className={`tbl-td fw-bold text-center ${i < 3 ? 'text-warn' : 'text-muted'}`}>
                        {i < 3 ? medals[i] : i + 1}
                      </td>
                      <td className={`tbl-td ${isMe ? 'fw-bold' : ''}`}>
                        {m.username}
                        {isMe && <span className="text-accent ml-1 text-xs">{t('common.you')}</span>}
                      </td>
                      <td className="tbl-td tbl-td--right fw-bold text-warn tabular-nums">
                        {m.best!.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="text-xs text-muted mt-3">
            {t('classroom.liveCaption')}
          </p>
        </div>
      </div>

      {/* Class mastery grid */}
      {classAnswers.length > 0 && (
        <div className="card">
          <h2 className="mb-1 text-md">{t('classroom.classMastery')}</h2>
          <p className="text-sm text-muted mb-4">
            {t('classroom.classMasteryDesc', { count: visibleMembers.length })}
          </p>
          <MasteryGrid answers={classAnswers} problemStats={problemStats as unknown as ProblemStat[]} tier1Unlocked />
        </div>
      )}

      {/* Leave / Close */}
      <div>
        <button
          className="btn btn-secondary text-base"
          onClick={handleLeave}
          disabled={leaving}
        >
          {leaving ? t('classroom.leaving') : isTeacher ? t('classroom.closeClass') : t('classroom.leaveClass')}
        </button>
        {isTeacher && (
          <p className="text-xs text-muted mt-2">
            {t('classroom.closeHint')}
          </p>
        )}
      </div>
    </div>
  );
}

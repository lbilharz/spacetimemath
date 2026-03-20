import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Answer, ClassSprint, Classroom, ClassroomMember, Player, ProblemStat, Session } from '../module_bindings/types.js';
import MasteryGrid from '../components/MasteryGrid.js';
import { QRCodeSVG } from 'qrcode.react';
import PageContainer from '../components/PageContainer.js';

interface Props {
  myIdentityHex: string;
  classroomId: bigint;
  onStartSprint: (id: bigint) => void;
  onStartClassSprint: (csId: bigint) => void;
  onLeave: () => void;
}

interface ClassRecoveryResult {
  memberIdentity: { toHexString: () => string };
  teacherIdentity: { toHexString: () => string };
  classroomId: bigint;
  username: string;
  code: string;
}

export default function ClassroomPage({ myIdentityHex, classroomId, onLeave }: Props) {
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
  const [startingClassSprint, setStartingClassSprint] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [sprintError, setSprintError] = useState<string | null>(null);
  const [endingClassSprint, setEndingClassSprint] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [togglingVis, setTogglingVis] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  // ── End of class sprint state ───────────────────────────────────────────────

  if (!myClassroom) {
    return (
      <div className="loading">
        <span className="text-muted text-base">{t('classroom.notFound')}</span>
      </div>
    );
  }

  const handleStartClassSprint = async (diagnostic: boolean) => {
    setShowStartModal(false);
    setStartingClassSprint(true);
    setSprintError(null);
    try {
      await startClassSprint({ classroomId, isDiagnostic: diagnostic });
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

  /** Fetch recovery codes and generate a PDF for direct download — no popup, no print dialog. */
  const handlePrintAll = async () => {
    if (printing || !myClassroom) return;
    setPrinting(true);
    setPrintError(null);
    try {
      // 1. Fetch recovery codes from server
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
      if (resultRows.length === 0) { setPrintError(t('classroom.printNoKeys')); return; }

      // 2. Fetch all QR images in parallel as data URLs
      const qrDataUrls = await Promise.all(resultRows.map(async r => {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(restoreUrl(r.code))}`;
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }));

      // 3. Build PDF — A4, 3×3 grid, 9 cards per page
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PAGE_W = 210, PAGE_H = 297;
      const MARGIN = 8, COLS = 3, ROWS = 3, GAP = 5;
      const CARD_W = (PAGE_W - 2 * MARGIN - (COLS - 1) * GAP) / COLS; // ~58.3mm
      const CARD_H = (PAGE_H - 2 * MARGIN - (ROWS - 1) * GAP) / ROWS; // ~89.7mm
      const HEADER_H = 12;
      const SMALL_PT = 11;   // class name, code, URL all share this size
      const CODE_FONT_SIZE = 15;   // class name, code, URL all share this size
      const NAME_PT  = 22;  // "1UP" wordmark
      const NAME_USER  = 16;  // username — matches visual weight of "1UP" wordmark
      // Logo grid colours: row-major, matches favicon.svg
      const LOGO_CELLS: [number, number, number][] = [
        [93, 210, 60], [93, 210, 60], [251, 186, 0],
        [93, 210, 60], [251, 186, 0], [79, 167, 255],
        [79, 167, 255], [232, 57, 29], [220, 220, 220],
      ];

      resultRows.forEach((r, i) => {
        const pageIdx = Math.floor(i / (COLS * ROWS));
        const posIdx  = i % (COLS * ROWS);
        if (posIdx === 0 && pageIdx > 0) pdf.addPage();
        const col = posIdx % COLS;
        const row = Math.floor(posIdx / COLS);
        const x = MARGIN + col * (CARD_W + GAP);
        const y = MARGIN + row * (CARD_H + GAP);

        // Card: white fill + light border + rounded corners
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(229, 229, 229);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, y, CARD_W, CARD_H, 3, 3, 'FD');

        // ── Navy header bar ───────────────────────────────────────────────────
        pdf.setFillColor(44, 62, 80);
        pdf.roundedRect(x, y, CARD_W, HEADER_H, 3, 3, 'F');
        // Cover bottom rounded corners so header meets body flush
        pdf.rect(x, y + HEADER_H / 2, CARD_W, HEADER_H / 2, 'F');

        // Logo: coloured grid squares on navy
        const LOGO_X = x + 3, LOGO_Y = y + 2.2;
        const CELL = 2.0, CELL_GAP = 0.38;
        LOGO_CELLS.forEach(([r2, g, b], ci) => {
          pdf.setFillColor(r2, g, b);
          pdf.roundedRect(
            LOGO_X + (ci % 3) * (CELL + CELL_GAP),
            LOGO_Y + Math.floor(ci / 3) * (CELL + CELL_GAP),
            CELL, CELL, 0.3, 0.3, 'F',
          );
        });
        // "1UP" wordmark in white, same visual weight as NAME_PT
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(NAME_PT);
        pdf.setFont('helvetica', 'bold');
        pdf.text('1UP', x + 11.5, y + HEADER_H - 3.2);

        // ── Body ──────────────────────────────────────────────────────────────
        let cursor = y + HEADER_H + 8;

        // Username — same pt as wordmark
        pdf.setTextColor(44, 62, 80);
        pdf.setFontSize(NAME_USER);
        pdf.setFont('helvetica', 'bold');
        pdf.text(r.username, x + CARD_W / 2, cursor, { align: 'center', maxWidth: CARD_W - 4 });
        cursor += 7;

        // Class name — small
        pdf.setTextColor(160, 160, 160);
        pdf.setFontSize(SMALL_PT);
        pdf.setFont('helvetica', 'normal');
        pdf.text(myClassroom!.name, x + CARD_W / 2, cursor, { align: 'center', maxWidth: CARD_W - 4 });
        cursor += 6;

        // QR code — no border, clean
        const QR_SIZE = 40;
        const QR_X = x + (CARD_W - QR_SIZE) / 2;
        pdf.addImage(qrDataUrls[i], 'PNG', QR_X, cursor, QR_SIZE, QR_SIZE);
        cursor += QR_SIZE + 6;

        // Recovery code — small, same size as class name
        pdf.setTextColor(120, 120, 120);
        pdf.setFontSize(CODE_FONT_SIZE);
        pdf.setFont('courier', 'normal');
        pdf.text(r.code, x + CARD_W / 2, cursor, { align: 'center' });
        cursor += 7;

        // URL — same small size
        pdf.setTextColor(190, 190, 190);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(SMALL_PT);
        pdf.text(globalThis.location.origin.split('//')[1], x + CARD_W / 2, cursor, { align: 'center' });
      });

      pdf.save(`${myClassroom.name}-login-cards.pdf`);
    } finally {
      setPrinting(false);
    }
  };

  const medals = ['🥇', '🥈', '🥉'];


  const SettingsIcon = ({ className }: { className?: string }) => (
    <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
      <rect x="6" y="14" width="88" height="10" rx="5" fill="currentColor" opacity="0.25" />
      <rect x="58" y="6" width="26" height="26" rx="8" fill="#4FA7FF" />
      <rect x="6" y="45" width="88" height="10" rx="5" fill="currentColor" opacity="0.25" />
      <rect x="26" y="37" width="26" height="26" rx="8" fill="#5DD23C" />
      <rect x="6" y="76" width="88" height="10" rx="5" fill="currentColor" opacity="0.25" />
      <rect x="42" y="68" width="26" height="26" rx="8" fill="#E8391D" />
    </svg>
  );

  const PlayIcon = ({ className }: { className?: string }) => (
    <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
      <rect x="22" y="16" width="20" height="68" rx="6" fill="#4FA7FF" />
      <rect x="46" y="28" width="20" height="44" rx="6" fill="#FBBA00" />
      <rect x="70" y="40" width="20" height="20" rx="6" fill="#5DD23C" />
    </svg>
  );

  const StopIcon = ({ className }: { className?: string }) => (
    <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
      <rect x="28" y="28" width="44" height="44" rx="10" fill="#E8391D" />
    </svg>
  );

  const BackIcon = ({ className }: { className?: string }) => (
    <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
      <rect x="58" y="16" width="20" height="20" rx="6" fill="#4FA7FF" />
      <rect x="42" y="40" width="20" height="20" rx="6" fill="#FBBA00" />
      <rect x="26" y="64" width="20" height="20" rx="6" fill="#E8391D" />
      <rect x="42" y="64" width="36" height="20" rx="6" fill="#E8391D" opacity="0.5" />
    </svg>
  );

  const TargetIcon = ({ className }: { className?: string }) => (
    <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
      <rect x="16" y="16" width="20" height="20" rx="6" fill="#4FA7FF" />
      <rect x="64" y="16" width="20" height="20" rx="6" fill="#4FA7FF" />
      <rect x="16" y="64" width="20" height="20" rx="6" fill="#4FA7FF" />
      <rect x="64" y="64" width="20" height="20" rx="6" fill="#4FA7FF" />
      <rect x="40" y="40" width="20" height="20" rx="6" fill="#E8391D" />
    </svg>
  );

  const LightningIcon = ({ className }: { className?: string }) => (
    <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
      <rect x="16" y="58" width="20" height="26" rx="6" fill="#4FA7FF" />
      <rect x="40" y="38" width="20" height="46" rx="6" fill="#FBBA00" />
      <rect x="64" y="18" width="20" height="66" rx="6" fill="#5DD23C" />
    </svg>
  );

  const KeyIcon = ({ className }: { className?: string }) => (
    <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <circle cx="35" cy="50" r="18" fill="none" stroke="currentColor" strokeWidth="12" />
      <rect x="52" y="44" width="40" height="12" rx="4" fill="currentColor" />
      <rect x="75" y="56" width="12" height="16" rx="4" fill="currentColor" />
    </svg>
  );

  // 1) Config & Onboarding View (Teacher Only)
  if (showSettings && isTeacher) {
    return (
      <PageContainer maxWidth="max-w-2xl" className="pb-[140px] sm:pb-[160px]">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Einstellungen
          </h1>
          <button
            onClick={() => setShowSettings(false)}
            className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700 transition-transform active:scale-95 hover:-translate-y-0.5"
          >
            <BackIcon className="h-5 w-5" />
            {t('common.back')}
          </button>
        </div>

        {/* Access Codes & QR */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
          <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">{t('classroom.accessAndInvite')}</h2>
          <div className="flex flex-col sm:flex-row gap-8 items-start">
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t('common.code')}</div>
                <button
                  onClick={handleCopyCodeText}
                  className="w-full text-left rounded-xl bg-slate-50 dark:bg-slate-900/50 px-4 py-3 font-mono text-2xl font-bold tracking-[0.2em] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:border-brand-yellow/50 transition-colors"
                >
                  {myClassroom.code}
                </button>
                <div className="text-xs text-slate-400 mt-1.5">{codeTextCopied ? `✓ ${t('common.copied')}` : t('classroom.copyCodeHint')}</div>
              </div>
              <button
                onClick={handleCopyLink}
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-transform active:scale-95"
              >
                {codeCopied ? t('common.copied') : t('classroom.copyLink')}
              </button>
            </div>
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div className="rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white p-3 shadow-sm">
                <QRCodeSVG
                  value={`${window.location.origin}/?join=${myClassroom.code}`}
                  size={120}
                  level="H"
                />
              </div>
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Scan to Join</span>
            </div>
          </div>
        </div>

        {/* Member Management */}
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('classroom.membersHeading')}</h2>
            <div className="flex gap-2">
              <button
                onClick={handleToggleVisibility}
                disabled={togglingVis}
                className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                {amHidden ? t('classroom.showStats') : t('classroom.hideStats')}
              </button>
              <button
                onClick={handlePrintAll}
                disabled={members.length === 0 || printing}
                className="rounded-xl bg-brand-yellow px-4 py-2 text-sm font-bold text-slate-900 transition-transform active:scale-95 disabled:opacity-50"
              >
                {printing ? 'Generiere...' : 'Print PDFs'}
              </button>
            </div>
          </div>
          
          {printError && <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{printError}</div>}

          {memberRows.length === 0 ? (
            <p className="text-slate-500">{t('classroom.noMembers')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {memberRows.map((m) => (
                <div key={m.id} className={`flex items-center justify-between rounded-xl p-3 border ${m.hidden ? 'opacity-50 border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {m.username} {m.hidden && <span className="ml-2 text-xs font-normal text-slate-500">(Versteckt)</span>}
                  </div>
                  {m.recoveryCode && (
                    <button
                      onClick={() => setQrStudent({ username: m.username, code: m.recoveryCode! })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <KeyIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="w-full rounded-2xl bg-red-50 dark:bg-red-500/10 px-4 py-3.5 text-sm font-bold text-red-600 dark:text-red-400 transition-transform active:scale-95 hover:bg-red-100 dark:hover:bg-red-500/20"
          >
            {leaving ? t('classroom.leaving') : t('classroom.closeClass')}
          </button>
        </div>

        {/* Modal for Student QR code */}
        {qrStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => setQrStudent(null)}>
            <div className="w-full max-w-sm rounded-[24px] bg-white p-8 text-center shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{qrStudent.username}</h3>
              <p className="mb-6 text-sm text-slate-500">{myClassroom.name}</p>
              <div className="mx-auto flex aspect-square w-48 items-center justify-center rounded-2xl border-4 border-slate-100 bg-white p-4">
                <QRCodeSVG value={restoreUrl(qrStudent.code)} size={160} level="H" />
              </div>
              <div className="mt-4 font-mono text-lg font-bold tracking-[0.2em] text-slate-700 dark:text-slate-300">
                {qrStudent.code}
              </div>
              <button onClick={() => setQrStudent(null)} className="mt-8 w-full rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300 active:scale-95 transition-transform">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </PageContainer>
    );
  }

  // 2) Live Class Sprint View (Teacher Only)
  if (activeSprint) {
    return (
      <PageContainer maxWidth="max-w-5xl" className="pb-[140px] sm:pb-[160px]">
        
        {/* Live Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[24px] border border-brand-yellow/30 bg-white dark:bg-slate-800 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-brand-yellow/5" />
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between w-full gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-500/20 animate-pulse">
                <span className="h-4 w-4 rounded-full bg-red-500" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white line-clamp-1">{myClassroom.name}</h1>
                <p className="text-sm font-bold text-red-500 tracking-wide uppercase">{t('classSprint.live')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="flex-1 text-center sm:text-right">
                <div className="text-4xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
                  {sprintTimeLeft !== null ? `${sprintTimeLeft}s` : '...'}
                </div>
              </div>
              <button
                onClick={handleEndClassSprint}
                disabled={endingClassSprint}
                className="flex items-center gap-2 rounded-2xl bg-red-500 px-6 py-3.5 font-bold text-white transition-transform active:scale-95 shadow-md shadow-red-500/20 disabled:opacity-50"
              >
                <StopIcon className="h-5 w-5" />
                {t('classSprint.end')}
              </button>
            </div>
          </div>
          
          {/* Progress Bar (absolute to bottom of container) */}
          {sprintTimeLeft !== null && (
            <div className="absolute bottom-0 left-0 h-1.5 bg-slate-100 dark:bg-slate-900 w-full">
              <div 
                className="h-full transition-all duration-1000 ease-linear"
                style={{ 
                  width: `${(sprintTimeLeft / 60) * 100}%`,
                  backgroundColor: sprintTimeLeft <= 10 ? '#ef4444' : sprintTimeLeft <= 20 ? '#f59e0b' : '#3b82f6'
                }} 
              />
            </div>
          )}
        </div>

        {/* Live Content Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
              <h3 className="mb-4 text-sm font-bold tracking-widest text-slate-400 uppercase">{t('classSprint.grid')}</h3>
              <MasteryGrid answers={sprintAnswers} problemStats={problemStats as unknown as ProblemStat[]} />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
              <h3 className="mb-4 text-sm font-bold tracking-widest text-slate-400 uppercase">{t('classSprint.liveScores')}</h3>
              {liveLB.length === 0 ? (
                <p className="text-sm text-slate-400">{t('classSprint.noScoresYet')}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {liveLB.map((r, i) => (
                    <div key={r.username} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800/50 p-3">
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>
                        {i + 1}
                      </div>
                      <span className="flex-1 text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{r.username}</span>
                      <span className="text-xs font-medium text-slate-400">{r.correct}✓</span>
                      <span className="text-sm font-black tabular-nums text-brand-yellow drop-shadow-sm">{r.score.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 max-h-64 overflow-y-auto">
              <h3 className="mb-4 text-sm font-bold tracking-widest text-slate-400 uppercase">{t('classSprint.liveAnswers')}</h3>
              {recentAnswers.length === 0 ? (
                <p className="text-sm text-slate-400">{t('classSprint.waitingForAnswers')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {recentAnswers.map(a => {
                    const p = (players as unknown as Player[]).find(pl => pl.identity.toHexString() === a.playerIdentity.toHexString());
                    return (
                      <div key={String(a.id)} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${a.isCorrect ? 'bg-green-50 text-green-700 dark:bg-green-900/10 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-400'}`}>
                        <span className="text-xs">{a.isCorrect ? '🟢' : '🔴'}</span>
                        <span className="flex-1 line-clamp-1 truncate">{p?.username ?? '?'}</span>
                        <span className="font-mono tracking-wider opacity-80">{a.a}×{a.b}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  // 3) Idle Classroom View
  return (
    <PageContainer maxWidth="max-w-3xl" className="pb-[140px] sm:pb-[160px]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white line-clamp-1">{myClassroom.name}</h1>
          <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {isTeacher ? t('classroom.youAreTeaching') : t('classroom.youAreStudent')} <span className="mx-2 opacity-50">•</span> {t('classroom.members', { count: members.length })}
          </div>
        </div>
        
        {isTeacher && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowSettings(true)}
              className="group flex h-[48px] w-[48px] items-center justify-center rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:scale-105 active:scale-95 transition-all focus:outline-none"
            >
              <SettingsIcon className="text-slate-500 dark:text-slate-400 transition-transform group-hover:rotate-[15deg]" />
            </button>
            <button
              onClick={() => setShowStartModal(true)}
              disabled={startingClassSprint}
              className="flex items-center gap-2 rounded-2xl bg-brand-yellow px-6 py-3 font-bold text-slate-900 h-[48px] shadow-sm shadow-brand-yellow/20 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              <PlayIcon className="h-5 w-5 -ml-1" />
              {startingClassSprint ? t('classSprint.starting') : t('classSprint.start')}
            </button>
          </div>
        )}
      </div>

      {sprintError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {sprintError}
        </div>
      )}

      {/* Primary Content Map */}
      {isTeacher && members.length === 0 ? (
        // Empty State: Always show login code
        <div className="flex flex-col items-center justify-center rounded-[32px] border border-slate-200 bg-white p-8 sm:p-12 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 text-center mt-4">
          <div className="mb-6 rounded-3xl border-4 border-slate-50 dark:border-slate-700/50 bg-white p-6 shadow-inner">
            <QRCodeSVG value={`${window.location.origin}/?join=${myClassroom.code}`} size={180} level="H" />
          </div>
          <h2 className="mb-2 text-2xl font-black text-slate-900 dark:text-white">Raum bereit!</h2>
          <p className="mb-6 text-sm text-slate-500 max-w-sm">
            Zeige diesen Code, damit deine Schueler_innen beitreten können.
          </p>
          <div className="font-mono text-4xl font-bold tracking-[0.25em] text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-8 py-4 rounded-2xl">
            {myClassroom.code}
          </div>
        </div>
      ) : (
        // Filled State: Leaderboard and Mastery
        <div className="flex flex-col gap-6 mt-2">
          
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
            <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">{t('classroom.leaderboard')}</h2>
            {leaderRows.length === 0 ? (
              <p className="text-slate-500">{t('classroom.leaderboardEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {leaderRows.map((m, i) => {
                  const isMe = m.id === myIdentityHex;
                  return (
                    <div key={m.id} className={`flex items-center gap-4 rounded-2xl p-4 transition-colors ${isMe ? 'bg-amber-50 dark:bg-amber-500/10 border border-brand-yellow/30' : 'bg-slate-50 dark:bg-slate-900/50 border border-transparent'}`}>
                      <div className={`flex w-8 justify-center font-black ${i < 3 ? 'text-brand-yellow text-xl drop-shadow-sm' : 'text-slate-400'}`}>
                        {i < 3 ? medals[i] : i + 1}
                      </div>
                      <div className={`flex-1 font-bold ${isMe ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        {m.username}
                        {isMe && <span className="ml-2 rounded-md bg-brand-yellow/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-400">{t('common.you')}</span>}
                      </div>
                      <div className="font-black tabular-nums tracking-tight text-brand-yellow text-lg">
                        {m.best!.toFixed(1)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-6 text-center text-xs text-slate-400">
              {t('classroom.liveCaption')}
            </p>
          </div>

          {classAnswers.length > 0 && (
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
              <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">{t('classroom.classMastery')}</h2>
              <p className="mb-6 text-sm text-slate-500">
                {t('classroom.classMasteryDesc', { count: visibleMembers.length })}
              </p>
              <MasteryGrid answers={classAnswers} problemStats={problemStats as unknown as ProblemStat[]} />
            </div>
          )}

          {!isTeacher && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="text-sm font-bold text-red-500 hover:text-red-600 hover:underline transition-colors"
              >
                {leaving ? t('classroom.leaving') : t('classroom.leaveClass')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Start Sprint Modal */}
      {showStartModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => setShowStartModal(false)}>
          <div className="w-full max-w-lg rounded-[32px] bg-white p-6 sm:p-8 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="mb-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{t('classSprint.modalTitle')}</h3>
            <p className="mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('classSprint.modalDesc')}
            </p>
            
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => handleStartClassSprint(true)}
                className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 transition-transform group-hover:scale-110">
                    <TargetIcon className="w-5 h-5" />
                  </div>
                  <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{t('classSprint.diagnosticTitle')}</span>
                </div>
                <span className="text-sm text-slate-500 leading-snug">
                  {t('classSprint.diagnosticDesc')}
                </span>
              </button>

              <button 
                onClick={() => handleStartClassSprint(false)}
                className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-brand-yellow/50 bg-amber-50 dark:bg-amber-500/10 p-5 text-left transition-all hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:border-brand-yellow shadow-sm active:scale-[0.98]"
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow text-slate-900 shadow-sm transition-transform group-hover:scale-110">
                      <LightningIcon className="w-5 h-5" />
                    </div>
                    <span className="text-lg font-black text-amber-900 dark:text-brand-yellow">{t('classSprint.trainingTitle')}</span>
                  </div>
                </div>
                <span className="text-sm font-medium text-amber-800/80 dark:text-amber-200/60 leading-snug">
                  {t('classSprint.trainingDesc')}
                </span>
              </button>
            </div>

            <button onClick={() => setShowStartModal(false)} className="mt-6 w-full rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-3.5 font-bold text-slate-600 dark:text-slate-400 active:scale-95 transition-transform">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

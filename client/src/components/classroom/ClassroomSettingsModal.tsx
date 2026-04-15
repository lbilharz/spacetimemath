import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../../module_bindings/index.js';
import type { ClassroomMember, Classroom, Player } from '../../module_bindings/types.js';
import { QRCodeSVG } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { pdf } from '@react-pdf/renderer';
import { Concept3PdfCards } from '../Concept3PdfCards.js';
import PageContainer from '../PageContainer.js';
import { BackIcon, KeyIcon } from '../Icons.js';
import { Capacitor } from '@capacitor/core';

interface ClassRecoveryResult {
  memberIdentity: { toHexString: () => string };
  teacherIdentity: { toHexString: () => string };
  classroomId: bigint;
  username: string;
  code: string;
}

interface Props {
  classroomId: bigint;
  myClassroom: Classroom;
  members: ClassroomMember[];
  bestByMember: Map<string, number>;
  amHidden: boolean;
  onClose: () => void;
  onLeave: () => void;
}

export default function ClassroomSettingsModal({
  classroomId,
  myClassroom,
  members,
  bestByMember,
  amHidden,
  onClose,
  onLeave
}: Props) {
  const { t } = useTranslation();
  const [players] = useTable(tables.players);
  const [classRecoveryResults] = useTable(tables.my_class_recovery_results);
  
  const isNativeApp = Capacitor.isNativePlatform();
  const shareOrigin = !isNativeApp ? window.location.origin : 'https://up.bilharz.eu';
  const shareDomain = !isNativeApp ? window.location.origin.split('//')[1] : 'up.bilharz.eu';
  
  const classRecoveryResultsRef = useRef<ClassRecoveryResult[]>([]);
  useEffect(() => {
    classRecoveryResultsRef.current = classRecoveryResults as unknown as ClassRecoveryResult[];
  }, [classRecoveryResults]);

  const toggleVisibility = useSTDBReducer(reducers.toggleClassroomVisibility);
  const leaveClassroom = useSTDBReducer(reducers.leaveClassroom);
  const getClassRecoveryCodes = useSTDBReducer(reducers.getClassRecoveryCodes);
  const removeClassroomMember = useSTDBReducer(reducers.removeClassroomMember);

  // Always fetch fresh recovery codes when the settings modal opens.
  // class_recovery_results is a point-in-time snapshot that can go stale
  // if a student regenerates their key between teacher views.
  useEffect(() => {
    getClassRecoveryCodes({ classroomId }).catch(() => {/* ignore — non-teachers will 403 */});
  }, [classroomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [togglingVis, setTogglingVis] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeTextCopied, setCodeTextCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printingModern, setPrintingModern] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [qrStudent, setQrStudent] = useState<{ username: string; code: string } | null>(null);
  
  const [studentToRemove, setStudentToRemove] = useState<{ id: string; username: string } | null>(null);
  const [removeNameConfirm, setRemoveNameConfirm] = useState('');
  const [removingMember, setRemovingMember] = useState(false);

  const restoreUrl = (code: string) => `${shareOrigin}/?restore=${code}`;

  const myClassRecoveryCodes = (classRecoveryResults as unknown as ClassRecoveryResult[])
    .filter(r => r.classroomId === classroomId);
  const recoveryKeyByIdentity = new Map<string, string>(
    myClassRecoveryCodes.map(r => [r.memberIdentity.toHexString(), r.code])
  );

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

  const handleCopyCodeText = () => {
    navigator.clipboard.writeText(myClassroom.code);
    setCodeTextCopied(true);
    setTimeout(() => setCodeTextCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${shareOrigin}/?join=${myClassroom.code}`);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

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

  const handleRemoveMember = async () => {
    if (!studentToRemove) return;
    setRemovingMember(true);
    try {
      await removeClassroomMember({ classroomId, studentHex: studentToRemove.id });
      setStudentToRemove(null);
      setRemoveNameConfirm('');
    } finally {
      setRemovingMember(false);
    }
  };

  const fetchPrintData = async () => {
    const prevCount = classRecoveryResultsRef.current.filter(r => r.classroomId === classroomId).length;
    await getClassRecoveryCodes({ classroomId });
    const POLL = 50, TIMEOUT = 5_000;
    if (prevCount > 0) {
      const clearDeadline = Date.now() + 2_000;
      while (Date.now() < clearDeadline) {
        if (classRecoveryResultsRef.current.filter(r => r.classroomId === classroomId).length === 0) break;
        await new Promise(res => setTimeout(res, POLL));
      }
    }
    const deadline = Date.now() + TIMEOUT;
    while (Date.now() < deadline) {
      const rows = classRecoveryResultsRef.current.filter(r => r.classroomId === classroomId);
      if (rows.length > 0) return rows;
      await new Promise(res => setTimeout(res, POLL));
    }
    return [];
  };

  const fetchQrUrls = async (rows: ClassRecoveryResult[]) => {
    return Promise.all(rows.map(async (r) => {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(restoreUrl(r.code))}`;
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }));
  };

  const handlePrintAll = async () => {
    if (printing || !myClassroom) return;
    setPrinting(true); setPrintError(null);
    try {
      const resultRows = await fetchPrintData();
      if (resultRows.length === 0) { setPrintError(t('classroom.printNoKeys')); return; }
      
      const qrDataUrls = await fetchQrUrls(resultRows);
      
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PAGE_W = 210, PAGE_H = 297;
      const MARGIN = 8, COLS = 3, ROWS = 3, GAP = 5;
      const CARD_W = (PAGE_W - 2 * MARGIN - (COLS - 1) * GAP) / COLS;
      const CARD_H = (PAGE_H - 2 * MARGIN - (ROWS - 1) * GAP) / ROWS;
      const QR_SIZE = CARD_W * 0.6;
      
      const LARGE_PT = CARD_W * 0.35, SMALL_PT = CARD_W * 0.15, CODE_FONT_SIZE = CARD_W * 0.18;
      
      resultRows.forEach((r, i) => {
        if (i > 0 && i % (COLS * ROWS) === 0) doc.addPage();
        const ci = i % (COLS * ROWS);
        const col = ci % COLS, row = Math.floor(ci / COLS);
        const x = MARGIN + col * (CARD_W + GAP), y = MARGIN + row * (CARD_H + GAP);
        
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, CARD_W, CARD_H, 3, 3, 'S');
        
        let cursor = y + 12;
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(SMALL_PT);
        doc.text(myClassroom.name, x + CARD_W / 2, cursor, { align: 'center' });
        
        cursor += 8;
        doc.setFontSize(LARGE_PT);
        doc.setFont('helvetica', 'bold');
        let un = r.username;
        if (doc.getTextWidth(un) > CARD_W - 6) {
          while (un.length > 2 && doc.getTextWidth(un + '...') > CARD_W - 6) un = un.slice(0, -1);
          un += '...';
        }
        doc.text(un, x + CARD_W / 2, cursor, { align: 'center' });
        
        cursor += 4;
        const qrX = x + (CARD_W - QR_SIZE) / 2;
        doc.addImage(qrDataUrls[i], 'PNG', qrX, cursor, QR_SIZE, QR_SIZE);
        cursor += QR_SIZE + 6;
        
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(CODE_FONT_SIZE);
        doc.setFont('courier', 'normal');
        doc.text(r.code, x + CARD_W / 2, cursor, { align: 'center' });
        
        cursor += 7;
        doc.setTextColor(190, 190, 190);
        doc.setFontSize(SMALL_PT);
        doc.text(shareDomain, x + CARD_W / 2, cursor, { align: 'center' });
      });
      doc.save(`${myClassroom.name}-login-cards.pdf`);
    } catch (err: unknown) {
        setPrintError(err instanceof Error ? err.message : String(err));
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintModernAll = async () => {
    if (printingModern || !myClassroom) return;
    setPrintingModern(true); setPrintError(null);
    try {
      const resultRows = await fetchPrintData();
      if (resultRows.length === 0) { setPrintError(t('classroom.printNoKeys')); return; }
      
      const qrDataUrls = await fetchQrUrls(resultRows);
      const cardsData = resultRows.map((r, i) => ({
        username: r.username,
        code: r.code,
        qrDataUrl: qrDataUrls[i],
      }));
      
      const blob = await pdf(
        <Concept3PdfCards cards={cardsData} classroomName={myClassroom.name} origin={shareDomain} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${myClassroom.name}-concept3-cards.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
        setPrintError(err instanceof Error ? err.message : String(err));
    } finally {
      setPrintingModern(false);
    }
  };

  return (
    <PageContainer maxWidth="max-w-2xl" className="pb-[140px] sm:pb-[160px]">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Einstellungen
        </h1>
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700 transition-transform active:scale-95 hover:-translate-y-0.5"
        >
          <BackIcon className="h-5 w-5" />
          {t('common.back')}
        </button>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 mt-4">
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
                value={`${shareOrigin}/?join=${myClassroom.code}`}
                size={120}
                level="H"
              />
            </div>
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Scan to Join</span>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 mt-6">
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
              disabled={members.length === 0 || printing || printingModern}
              className="rounded-xl bg-slate-200 dark:bg-slate-700 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 transition-transform active:scale-95 disabled:opacity-50"
            >
              {printing ? 'Generiere...' : 'Print (Alt)'}
            </button>
            <button
              onClick={handlePrintModernAll}
              disabled={members.length === 0 || printing || printingModern}
              className="rounded-xl bg-brand-yellow px-4 py-2 text-sm font-bold text-slate-900 transition-transform active:scale-95 disabled:opacity-50"
            >
              {printingModern ? 'Generiere...' : 'Print PDFs'}
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
                <div className="flex gap-2">
                  {m.recoveryCode && (
                    <button
                      onClick={() => setQrStudent({ username: m.username, code: m.recoveryCode! })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <KeyIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => { setStudentToRemove({ id: m.id, username: m.username }); setRemoveNameConfirm(''); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 transition-colors"
                    title={t('classroom.remove')}
                  >
                    <span className="text-sm">🗑️</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
        <button
          onClick={handleLeave}
          disabled={leaving}
          className="w-full rounded-2xl bg-red-50 dark:bg-red-500/10 px-4 py-3.5 text-sm font-bold text-red-600 dark:text-red-400 transition-transform active:scale-95 hover:bg-red-100 dark:hover:bg-red-500/20"
        >
          {leaving ? t('classroom.leaving') : t('classroom.closeClass')}
        </button>
      </div>

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

      {studentToRemove && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => !removingMember && setStudentToRemove(null)}>
          <div className="w-full max-w-sm rounded-[24px] bg-white p-8 text-center shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('classroom.removeMemberTitle')}</h3>
            <p className="mb-6 text-sm text-slate-500">{t('classroom.removeMemberDesc', { name: studentToRemove.username })}</p>
            <input
              type="text"
              placeholder={studentToRemove.username}
              value={removeNameConfirm}
              onChange={e => setRemoveNameConfirm(e.target.value)}
              disabled={removingMember}
              className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900 text-center transition-colors focus:border-red-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setStudentToRemove(null)} 
                disabled={removingMember}
                className="flex-1 rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300 active:scale-95 transition-transform"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={handleRemoveMember}
                disabled={removingMember || removeNameConfirm.trim() !== studentToRemove.username.trim()}
                className="flex-1 rounded-2xl bg-red-500 px-4 py-3.5 font-bold text-white active:scale-95 transition-transform disabled:opacity-50"
              >
                {t('classroom.remove')}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

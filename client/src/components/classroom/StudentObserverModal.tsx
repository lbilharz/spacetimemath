import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../../module_bindings/index.js';
import type { Answer, IssuedProblemResult, NextProblemResult, Session } from '../../module_bindings/types.js';
import { Identity } from 'spacetimedb';

interface Props {
  studentIdentityHex: string;
  studentName: string;
  sprintAnswers: Answer[];
  nextProblemResults: NextProblemResult[];
  issuedProblemResults: IssuedProblemResult[];
  sessions: Session[];
  onClose: () => void;
  isDiagnostic: boolean;
}

export default function StudentObserverModal({
  studentIdentityHex,
  studentName,
  sprintAnswers,
  nextProblemResults,
  issuedProblemResults,
  sessions,
  onClose,
  isDiagnostic
}: Props) {
  const { t } = useTranslation();
  const [studentKeystrokes] = useTable(tables.student_keystrokes);
  const focusStudent = useSTDBReducer(reducers.focusStudent);
  const [lastPressedKey, setLastPressedKey] = useState<string | null>(null);

  useEffect(() => {
    // 1. Tell backend we are watching this student
    focusStudent({ studentId: Identity.fromString(studentIdentityHex) }).catch(console.error);
    return () => {
      // 2. Un-focus on modal close to let the student stop transmitting
      focusStudent({ studentId: undefined }).catch(console.error);
    };
  }, [studentIdentityHex, focusStudent]);

  // Read the active live input telemetry
  const liveInputList = Array.from(studentKeystrokes as unknown as any[]);
  const currentKeystrokeRow = liveInputList.find(k => k.studentId.toHexString() === studentIdentityHex);
  const liveInput = currentKeystrokeRow?.currentInput || '';

  // Update last pressed key for visual feedback
  useEffect(() => {
    if (liveInput.length > 0) {
      const char = liveInput[liveInput.length - 1];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastPressedKey(char);
      const timer = setTimeout(() => setLastPressedKey(null), 150);
      return () => clearTimeout(timer);
    } else {
      // Clear was pressed
      setLastPressedKey('C');
      const timer = setTimeout(() => setLastPressedKey(null), 150);
      return () => clearTimeout(timer);
    }
  }, [liveInput]);

  // 1. Find the student's active session
  const studentSession = sessions.find(s => s.playerIdentity.toHexString() === studentIdentityHex);

  // 2. Find the exact problem they are currently looking at on their screen
  const activeProblemRow = useMemo(() => {
    if (isDiagnostic) {
      return (issuedProblemResults as unknown as IssuedProblemResult[]).find(r => r.owner.toHexString() === studentIdentityHex);
    } else {
      return (nextProblemResults as unknown as NextProblemResult[]).find(r => r.owner.toHexString() === studentIdentityHex);
    }
  }, [isDiagnostic, issuedProblemResults, nextProblemResults, studentIdentityHex]);

  // 3. Find their recent answers (to show their stumbles on the current or previous problems)
  const studentRecentAnswers = useMemo(() => {
    return sprintAnswers
      .filter(a => a.playerIdentity.toHexString() === studentIdentityHex)
      .sort((a, b) => Number(b.id - a.id)) // Newest first
      .slice(0, 10); // Last 10 submissions
  }, [sprintAnswers, studentIdentityHex]);

  const parsedA = activeProblemRow && 'a' in activeProblemRow ? Number((activeProblemRow as any).a) : null;
  const parsedB = activeProblemRow && 'b' in activeProblemRow ? Number((activeProblemRow as any).b) : null;

  // The answers they have submitted for this *specific* active problem
  const attemptsOnActiveProblem = useMemo(() => {
    if (!activeProblemRow || parsedA === null || parsedB === null) return [];
    return studentRecentAnswers.filter(ans => ans.a === parsedA && ans.b === parsedB);
  }, [studentRecentAnswers, activeProblemRow, parsedA, parsedB]);

  if (!studentSession || !activeProblemRow) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
        <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl dark:bg-slate-900">
          <div className="p-8 text-center text-slate-500">{t('classroom.waitingForStudentState', { defaultValue: 'Waiting for student to receive next problem...' })}</div>
          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
             <button onClick={onClose} className="rounded-xl px-6 py-3 font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200">Close</button>
          </div>
        </div>
      </div>
    );
  }

  const { heat, rawScore } = studentSession;

  const { promptMode } = activeProblemRow;
  // Convert standard typed options to array safely
  const options = Array.from(activeProblemRow.options || []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="flex w-full max-w-4xl flex-col xl:flex-row overflow-hidden rounded-[32px] bg-white shadow-2xl dark:bg-slate-900 max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        {/* LEFT PANEL: The Live UI Replica */}
        <div className="flex-1 p-8 sm:p-12 relative flex flex-col bg-slate-50 dark:bg-slate-900">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white line-clamp-1">{studentName}</h2>
              <div className="text-sm font-bold text-slate-400 flex items-center gap-2 mt-1">
                <span>{t('sprint.score')}: {rawScore}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className={`transition-colors ${heat >= 3 ? 'text-orange-500' : 'text-slate-400'}`}>
                  {heat} {t('common.heat', { defaultValue: 'Heat' })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-slate-200/50 dark:bg-slate-800 px-4 py-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('classroom.liveObserver', { defaultValue: 'LIVE VIEW' })}</span>
            </div>
          </div>

          {/* Center Math Problem */}
          <div className="flex-1 flex flex-col items-center justify-center mb-8">
            <div className="text-[120px] leading-none font-black tracking-tighter text-slate-900 dark:text-white drop-shadow-sm flex items-center justify-center gap-4">
              <span>{parsedA ?? '?'}</span>
              <span className="text-slate-300 dark:text-slate-600 font-medium">×</span>
              <span>{parsedB ?? '?'}</span>
            </div>
            <div className="h-6 w-32 mt-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-200 dark:border-slate-700">
              <span className="w-2 h-2 rounded-full bg-brand-yellow animate-pulse" />
            </div>
          </div>

          {/* Reconstructed Input Interface */}
          <div className="h-64 flex items-center justify-center w-full max-w-md mx-auto">
            {promptMode === 1 ? (
              // TAP MODE REPLICA
              <div className="grid grid-cols-2 gap-4 w-full">
                {options.map((opt, i) => {
                  const alreadyTried = attemptsOnActiveProblem.some(atmpt => atmpt.userAnswer === opt && !atmpt.isCorrect);
                  const isSimulatedBotTap = liveInput === String(opt);
                  return (
                    <div 
                      key={i} 
                      className={`flex aspect-[2.5/1] items-center justify-center rounded-[24px] border-4 text-4xl font-black transition-all ${
                        alreadyTried 
                          ? 'border-red-200 bg-red-50 text-red-300 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-800' // Faded out penalty look
                          : isSimulatedBotTap
                            ? 'bg-slate-400 text-white scale-95 border-slate-400 dark:bg-slate-500 shadow-inner' // Pressed highlight
                            : 'border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                      }`}
                    >
                      {opt}
                    </div>
                  );
                })}
              </div>
            ) : (
              // TYPE MODE REPLICA
              <div className="flex flex-col items-center">
                <div className="h-16 w-full mb-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-inner flex items-center justify-end px-6 overflow-hidden">
                   <span className="text-4xl font-black tabular-nums tracking-tight text-slate-800 dark:text-slate-200">
                     {liveInput}
                     <span className="animate-pulse ml-0.5 text-brand-yellow">|</span>
                   </span>
                </div>
                <div className="grid grid-cols-3 gap-3 w-[280px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '✓'].map((key) => {
                    const isPressed = lastPressedKey === String(key);
                    return (
                      <div 
                        key={key} 
                        className={`flex aspect-square items-center justify-center rounded-2xl text-2xl font-black transition-all ${
                          isPressed 
                            ? 'bg-slate-400 text-white scale-95 dark:bg-slate-500 shadow-inner' 
                            : 'bg-slate-200/50 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                        }`}
                      >
                        {key}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: The Action Log */}
        <div className="xl:w-80 border-t xl:border-t-0 xl:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold tracking-widest text-slate-400 uppercase">{t('classroom.actionLog', { defaultValue: 'Recent Actions' })}</h3>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            >
              ×
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {studentRecentAnswers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center mt-10 italic">{t('classroom.noActionsYet', { defaultValue: 'No answers submitted yet.' })}</p>
            ) : (
              studentRecentAnswers.map(ans => (
                <div key={String(ans.id)} className={`rounded-xl border p-3 ${ans.isCorrect ? 'border-green-100 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10' : 'border-red-100 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-400 tracking-wider font-mono">{ans.a} × {ans.b}</span>
                    <span className="text-xs font-bold opacity-60 flex items-center gap-1">
                      {ans.responseMs / 1000}s
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{ans.isCorrect ? '🟢' : '🔴'}</span>
                    <span className={`text-base font-black ${ans.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {t('classroom.submitted', { defaultValue: 'Submitted' })} {ans.userAnswer}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

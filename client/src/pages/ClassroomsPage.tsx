import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Classroom, ClassroomMember } from '../module_bindings/types.js';
import PageContainer from '../components/PageContainer.js';
import { AddIcon, JoinIcon, ViewArrowIcon, EmptyClassroomIcon, ClassesIcon } from '../components/Icons.js';

interface Props {
  myIdentityHex: string | undefined;
  onEnterClassroom: (id: bigint) => void;
}

type Panel = 'none' | 'create' | 'join';



export default function ClassroomsPage({ myIdentityHex, onEnterClassroom }: Props) {
  const { t } = useTranslation();
  const [classrooms] = useTable(tables.classrooms);
  const [classroomMembers] = useTable(tables.classroom_members);
  const createClassroom = useSTDBReducer(reducers.createClassroom);
  const joinClassroom = useSTDBReducer(reducers.joinClassroom);

  const [panel, setPanel] = useState<Panel>('none');
  const [className, setClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [classError, setClassError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const myMemberships = myIdentityHex
    ? (classroomMembers as unknown as ClassroomMember[]).filter(m => m.playerIdentity.toHexString() === myIdentityHex)
    : [];
  const memberClassroomIds = new Set(myMemberships.map(m => m.classroomId));
  // Also include classrooms the user owns — teacher row may be missing after a data restore.
  const ownedClassrooms = myIdentityHex
    ? (classrooms as unknown as Classroom[]).filter(c => c.teacher?.toHexString() === myIdentityHex && !memberClassroomIds.has(c.id))
    : [];
  const myClassrooms = [
    ...myMemberships
      .map(m => (classrooms as unknown as Classroom[]).find(c => c.id === m.classroomId))
      .filter((c): c is Classroom => c !== undefined),
    ...ownedClassrooms,
  ];

  const openPanel = (p: Panel) => {
    setPanel(p); setClassError(''); setClassName(''); setJoinCode('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = className.trim();
    if (!name) return;
    setSubmitting(true); setClassError('');
    try {
      await createClassroom({ name });
      const created = (classrooms as unknown as Classroom[])
        .filter(c => c.teacher?.toHexString() === myIdentityHex)
        .sort((a, b) => Number(b.id - a.id))[0];
      if (created) onEnterClassroom(created.id);
      else { setPanel('none'); setClassName(''); }
    } catch (err: unknown) {
      setClassError((err as Error)?.message ?? t('classes.createError'));
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) return;
    setSubmitting(true); setClassError('');
    try {
      await joinClassroom({ code });
      const classroom = (classrooms as unknown as Classroom[]).find(c => c.code === code);
      if (classroom) onEnterClassroom(classroom.id);
      else { setPanel('none'); setJoinCode(''); }
    } catch (err: unknown) {
      setClassError((err as Error)?.message ?? t('classes.joinError'));
      setSubmitting(false);
    }
  };

  return (
    <PageContainer className="pb-[100px] sm:pb-[140px]">
      <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-2 flex items-center gap-3">
        <div className="flex xl:h-[42px] xl:w-[42px] shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 shadow-sm">
          <ClassesIcon className="drop-shadow-sm scale-110" />
        </div>
        {t('nav.classes')}
      </h1>

      {/* Classroom list */}
      {myClassrooms.length > 0 ? (
        <div className="flex flex-col gap-4">
          {myClassrooms.map(c => {
            const isTeacher = c.teacher?.toHexString() === myIdentityHex;
            const memberCount = (classroomMembers as unknown as ClassroomMember[]).filter(m => m.classroomId === c.id).length;
            return (
              <button
                key={String(c.id)}
                onClick={() => onEnterClassroom(c.id)}
                className="group w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white p-5 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80 transition-all hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-brand-yellow/50 dark:hover:border-brand-yellow/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-bold text-slate-900 dark:text-white mb-1.5 truncate transition-colors group-hover:text-brand-yellow">
                    {c.name}
                  </div>
                  <div className="flex flex-wrap items-center text-[13px] font-medium text-slate-500 dark:text-slate-400 gap-x-2.5 gap-y-1.5">
                    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${isTeacher ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {isTeacher ? t('common.teacher') : t('common.student')}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span>{t('classroom.members', { count: memberCount })}</span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span>
                      {t('common.code')}{' '}
                      <code className="ml-1 rounded-md bg-slate-100 dark:bg-slate-900/50 px-1.5 py-0.5 font-mono text-[13px] font-bold text-slate-700 dark:text-slate-300 tracking-wider border border-slate-200 dark:border-slate-700">
                        {c.code}
                      </code>
                    </span>
                  </div>
                </div>
                <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 transition-colors group-hover:bg-brand-yellow/10">
                  <ViewArrowIcon className="scale-110 transition-transform group-hover:scale-125 group-hover:drop-shadow-sm text-slate-400" />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        panel === 'none' && (
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/20">
            <EmptyClassroomIcon className="mb-4 opacity-40 drop-shadow-sm grayscale saturate-0 text-slate-400 dark:text-slate-500" />
            <div className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('classes.empty')}</div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xs">{t('classes.emptyHint')}</div>
          </div>
        )
      )}

      {/* Action buttons */}
      {panel === 'none' && (
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <button className="flex-1 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-[15px] font-bold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-3.5 group shadow-sm" onClick={() => openPanel('create')}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 transition-colors group-hover:bg-brand-yellow/10">
              <AddIcon className="scale-110 transition-transform group-hover:scale-[1.2] group-hover:drop-shadow-sm" />
            </div>
            {t('lobby.createClass')}
          </button>
          <button className="flex-1 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-[15px] font-bold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-3.5 group shadow-sm" onClick={() => openPanel('join')}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 transition-colors group-hover:bg-brand-yellow/10">
              <JoinIcon className="scale-110 transition-transform group-hover:scale-[1.2] group-hover:drop-shadow-sm" />
            </div>
            {t('lobby.joinClass')}
          </button>
        </div>
      )}

      {/* Create form */}
      {panel === 'create' && (
        <div className="flex flex-col rounded-3xl border border-brand-yellow/30 bg-brand-yellow/5 p-6 dark:bg-brand-yellow/5 dark:border-brand-yellow/20 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm mt-2">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">{t('lobby.createClassHeading')}</h2>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3.5 text-[15px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 shadow-inner"
              type="text"
              placeholder={t('lobby.classNamePlaceholder')}
              value={className}
              onChange={e => setClassName(e.target.value)}
              maxLength={40}
              autoFocus
              disabled={submitting}
            />
            <div className="flex gap-2">
              <button className="flex-1 sm:flex-none rounded-2xl bg-brand-yellow px-6 py-3.5 text-[15px] font-bold text-slate-900 transition-transform active:scale-95 disabled:opacity-50 shadow-sm shadow-brand-yellow/20" type="submit" disabled={submitting || !className.trim()}>
                {submitting ? t('lobby.creating') : t('lobby.create')}
              </button>
              <button className="flex-1 sm:flex-none rounded-2xl bg-slate-200 dark:bg-slate-800 px-5 py-3.5 text-[15px] font-bold text-slate-600 dark:text-slate-300 transition-transform active:scale-95 border border-slate-300 dark:border-slate-700/50" type="button" onClick={() => openPanel('none')} disabled={submitting}>
                ✕
              </button>
            </div>
          </form>
          {classError && <p className="text-red-600 dark:text-red-400 font-bold text-xs mt-4 bg-red-50 dark:bg-red-900/20 py-2.5 px-3.5 rounded-lg border border-red-100 dark:border-red-900/50">⚠ {classError}</p>}
        </div>
      )}

      {/* Join form */}
      {panel === 'join' && (
        <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800/80 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-300 mt-2">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">{t('lobby.joinClassHeading')}</h2>
          <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3.5 text-center text-xl tracking-[0.2em] font-bold text-slate-900 dark:text-white uppercase placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-brand-yellow focus:outline-none focus:ring-2 focus:ring-brand-yellow/50 focus:bg-white shadow-inner transition-colors"
              type="text"
              placeholder={t('lobby.joinCodePlaceholder')}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoFocus
              disabled={submitting}
            />
            <div className="flex gap-2">
              <button className="flex-1 sm:flex-none rounded-2xl bg-brand-yellow px-6 py-3.5 text-[15px] font-bold text-slate-900 transition-transform active:scale-95 disabled:opacity-50 shadow-sm shadow-brand-yellow/20" type="submit" disabled={submitting || joinCode.trim().length !== 6}>
                {submitting ? t('lobby.joining') : t('lobby.join')}
              </button>
              <button className="flex-1 sm:flex-none rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-5 py-3.5 text-[15px] font-bold text-slate-600 dark:text-slate-300 transition-transform active:scale-95" type="button" onClick={() => openPanel('none')} disabled={submitting}>
                ✕
              </button>
            </div>
          </form>
          {classError && <p className="text-red-600 dark:text-red-400 font-bold text-xs mt-4 bg-red-50 dark:bg-red-900/20 py-2.5 px-3.5 rounded-lg border border-red-100 dark:border-red-900/50">⚠ {classError}</p>}
        </div>
      )}

    </PageContainer>
  );
}

import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Classroom, ClassroomMember, Player } from '../module_bindings/types.js';
import PageContainer from '../components/PageContainer.js';
import TeacherUpgradeForm from '../components/TeacherUpgradeForm.js';
import { AddIcon, JoinIcon, ViewArrowIcon, ClassesIcon, Swosh } from '../components/Icons.js';

interface Props {
  myIdentityHex: string | undefined;
  onEnterClassroom: (id: bigint) => void;
}

export default function ClassroomsPage({ myIdentityHex, onEnterClassroom }: Props) {
  const { t } = useTranslation();
  const [classrooms] = useTable(tables.my_classrooms);
  const [classroomMembers] = useTable(tables.my_classroom_members);
  const [players] = useTable(tables.players);
  const createClassroom = useSTDBReducer(reducers.createClassroom);
  const joinClassroom = useSTDBReducer(reducers.joinClassroom);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [className, setClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [classError, setClassError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [joining, setJoining] = useState(false);

  const myPlayer = myIdentityHex ? (players as unknown as Player[]).find(p => p.identity.toHexString() === myIdentityHex) : undefined;
  const isTeacher = myPlayer?.playerType?.tag === 'Teacher';

  const myMemberships = myIdentityHex
    ? (classroomMembers as unknown as ClassroomMember[]).filter(m => m.playerIdentity.toHexString() === myIdentityHex)
    : [];
  const memberClassroomIds = new Set(myMemberships.map(m => m.classroomId));
  const ownedClassrooms = myIdentityHex
    ? (classrooms as unknown as Classroom[]).filter(c => c.teacher?.toHexString() === myIdentityHex && !memberClassroomIds.has(c.id))
    : [];
  const myClassrooms = [
    ...myMemberships
      .map(m => (classrooms as unknown as Classroom[]).find(c => c.id === m.classroomId))
      .filter((c): c is Classroom => c !== undefined),
    ...ownedClassrooms,
  ];

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
      else { setShowCreate(false); setClassName(''); }
    } catch (err: unknown) {
      setClassError((err as Error)?.message ?? t('classes.createError'));
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) return;
    setJoining(true); setJoinError('');
    try {
      await joinClassroom({ code });
      const classroom = (classrooms as unknown as Classroom[]).find(c => c.code === code);
      if (classroom) onEnterClassroom(classroom.id);
      else { setJoinCode(''); }
    } catch (err: unknown) {
      setJoinError((err as Error)?.message ?? t('classes.joinError'));
      setJoining(false);
    }
  };

  return (
    <PageContainer className="pb-[100px] sm:pb-[140px]">
      {/* Header */}
      <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mt-2 flex items-center gap-3">
        <div className="flex xl:h-[42px] xl:w-[42px] shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 shadow-sm">
          <ClassesIcon className="drop-shadow-sm scale-110" />
        </div>
        <span className="relative z-10 inline-block text-slate-900 dark:text-white">
          {t('nav.classes')}
          <Swosh className="absolute w-[105%] h-[0.35em] -bottom-1 -left-[2.5%] text-brand-yellow/40 z-[-1]" />
        </span>
      </h1>

      <div className="flex flex-col gap-6">
        {/* 1. Classroom list OR empty state */}
        {myClassrooms.length > 0 ? (
          myClassrooms.map(c => {
            const ownsClass = c.teacher?.toHexString() === myIdentityHex;
            const memberCount = (classroomMembers as unknown as ClassroomMember[]).filter(m => m.classroomId === c.id).length;
            return (
              <button
                key={String(c.id)}
                onClick={() => onEnterClassroom(c.id)}
                className="group w-full text-left flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800/80 transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 dark:text-white truncate transition-colors group-hover:text-brand-yellow">
                    {c.name}
                  </div>
                  <div className="flex flex-wrap items-center text-xs text-slate-500 dark:text-slate-400 gap-x-2 mt-1">
                    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${ownsClass ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {ownsClass ? t('common.teacher') : t('common.student')}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">&middot;</span>
                    <span>{t('classroom.members', { count: memberCount })}</span>
                    <span className="text-slate-300 dark:text-slate-600">&middot;</span>
                    <span>
                      <code className="rounded-md bg-slate-100 dark:bg-slate-900/50 px-1.5 py-0.5 font-mono text-[12px] font-bold text-slate-600 dark:text-slate-300 tracking-wider">
                        {c.code}
                      </code>
                    </span>
                  </div>
                </div>
                <ViewArrowIcon className="shrink-0 text-slate-300 dark:text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-brand-yellow" />
              </button>
            );
          })
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white dark:bg-slate-800/50 dark:border-slate-800 p-8 text-center shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-yellow via-brand-yellow to-brand-yellow animate-pulse" />
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3 mt-2">{t('classes.emptyHeading', { defaultValue: 'Learn together! 🏫' })}</h3>
            <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-sm mx-auto mb-6">
              {t('classes.emptyDesc', { defaultValue: 'Join a classroom to compete with classmates, conquer assignments together, and let your teacher guide your learning journey!' })}
            </p>
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">— {t('classes.empty')} —</div>
          </div>
        )}

        {/* 2 & 3. Action icon buttons / inline forms */}
        <div className={`flex flex-col md:flex-row gap-3 ${!isTeacher ? 'justify-center max-w-sm mx-auto w-full' : ''}`}>
          {showJoin ? (
            <form onSubmit={handleJoin} className="flex-1 rounded-3xl border border-brand-yellow bg-brand-yellow/5 p-4 shadow-sm flex flex-col gap-3 justify-center animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('lobby.joinClassHeading')}</span>
                <button type="button" onClick={() => setShowJoin(false)} className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors">✕</button>
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 w-full rounded-2xl border-2 border-slate-200 bg-white dark:bg-slate-900 px-3 py-2 text-center text-sm tracking-[0.2em] font-black text-slate-900 dark:text-white uppercase placeholder:text-slate-300 dark:border-slate-700 dark:placeholder:text-slate-600 focus:border-brand-yellow focus:outline-none transition-colors"
                  type="text"
                  inputMode="numeric"
                  placeholder={t('lobby.joinCodePlaceholder')}
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase())}
                  maxLength={6}
                  autoFocus
                  autoComplete="off"
                  disabled={joining}
                />
                <button
                  className="bg-brand-yellow px-5 rounded-2xl font-black text-[13px] text-slate-900 transition-transform active:scale-95 disabled:opacity-50 tracking-wider uppercase"
                  type="submit"
                  disabled={joining || joinCode.trim().length !== 6}
                >
                  {joining ? '...' : t('lobby.join')}
                </button>
              </div>
              {joinError && <p className="text-red-500 text-sm font-bold">{joinError}</p>}
            </form>
          ) : (
            <button
              className="flex-1 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-[15px] font-bold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-3.5 group shadow-sm"
              onClick={() => { setShowJoin(true); setShowCreate(false); setJoinError(''); setJoinCode(''); }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 transition-colors group-hover:bg-brand-yellow/10">
                <JoinIcon className="scale-110 transition-transform group-hover:scale-[1.2] group-hover:drop-shadow-sm" />
              </div>
              {t('lobby.joinClass')}
            </button>
          )}

          {isTeacher && (
            showCreate ? (
              <form onSubmit={handleCreate} className="flex-1 rounded-3xl border border-brand-yellow bg-brand-yellow/5 p-4 shadow-sm flex flex-col gap-3 justify-center animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('lobby.createClassHeading')}</span>
                  <button type="button" onClick={() => setShowCreate(false)} className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors">✕</button>
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 w-full rounded-2xl border-2 border-slate-200 bg-white dark:bg-slate-900 px-3 py-2 text-[15px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 border-slate-300 dark:border-slate-700 focus:border-brand-yellow focus:outline-none transition-colors"
                    type="text"
                    placeholder={t('lobby.classNamePlaceholder')}
                    value={className}
                    onChange={e => setClassName(e.target.value)}
                    maxLength={40}
                    autoFocus
                    autoComplete="off"
                    disabled={submitting}
                  />
                  <button
                    className="bg-brand-yellow px-5 rounded-2xl font-black text-[13px] text-slate-900 transition-transform active:scale-95 disabled:opacity-50 tracking-wider uppercase shadow-sm shadow-brand-yellow/20"
                    type="submit"
                    disabled={submitting || !className.trim()}
                  >
                    {submitting ? '...' : t('lobby.create')}
                  </button>
                </div>
                {classError && <p className="text-red-600 dark:text-red-400 font-bold text-xs">{classError}</p>}
              </form>
            ) : (
              <button
                className="flex-1 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-[15px] font-bold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-3.5 group shadow-sm"
                onClick={() => { setShowCreate(true); setShowJoin(false); setClassError(''); setClassName(''); }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 transition-colors group-hover:bg-brand-yellow/10">
                  <AddIcon className="scale-110 transition-transform group-hover:scale-[1.2] group-hover:drop-shadow-sm" />
                </div>
                {t('lobby.createClass')}
              </button>
            )
          )}
        </div>
      </div>

      {/* Teacher upgrade prompt — only for non-teachers with no classrooms */}
      {!isTeacher && myClassrooms.length === 0 && !showUpgrade && (
        <div className="mt-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
            {t('classes.areYouTeacher')}
          </p>
          <button
            onClick={() => setShowUpgrade(true)}
            className="text-sm font-bold text-brand-yellow hover:text-amber-500 transition-colors underline decoration-brand-yellow/30 underline-offset-4"
          >
            {t('classes.upgradePrompt')}
          </button>
        </div>
      )}

      {showUpgrade && (
        <div className="rounded-3xl border-2 border-brand-yellow/50 bg-brand-yellow/5 p-6 animate-in fade-in zoom-in-95 duration-300 mt-6 max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{t('register_split.teacher_btn')}</h2>
            <button
              className="rounded-xl bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-500 dark:text-slate-400 transition-transform active:scale-95 border border-slate-300 dark:border-slate-700/50"
              type="button"
              onClick={() => setShowUpgrade(false)}
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{t('classes.upgradeDesc')}</p>
          <TeacherUpgradeForm myIdentityHex={myIdentityHex} onUpgraded={() => setShowUpgrade(false)} />
        </div>
      )}
    </PageContainer>
  );
}

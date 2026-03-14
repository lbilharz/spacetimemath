import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Classroom, ClassroomMember } from '../module_bindings/types.js';

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
  const joinClassroom   = useSTDBReducer(reducers.joinClassroom);

  const [panel, setPanel]       = useState<Panel>('none');
  const [className, setClassName] = useState('');
  const [joinCode, setJoinCode]   = useState('');
  const [classError, setClassError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const myMemberships = myIdentityHex
    ? (classroomMembers as unknown as ClassroomMember[]).filter(m => m.playerIdentity.toHexString() === myIdentityHex)
    : [];
  const myClassrooms = myMemberships
    .map(m => (classrooms as unknown as Classroom[]).find(c => c.id === m.classroomId))
    .filter((c): c is Classroom => c !== undefined);

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
      setClassError((err as Error)?.message ?? 'Failed to create classroom');
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
      setClassError((err as Error)?.message ?? 'Classroom not found');
      setSubmitting(false);
    }
  };

  return (
    <div className="page">

      {/* Classroom list */}
      {myClassrooms.length > 0 ? (
        <div className="col gap-10">
          {myClassrooms.map(c => {
            const isTeacher  = c.teacher?.toHexString() === myIdentityHex;
            const memberCount = (classroomMembers as unknown as ClassroomMember[]).filter(m => m.classroomId === c.id).length;
            return (
              <div
                key={String(c.id)}
                className="card row-between gap-12"
                style={{ flexWrap: 'wrap', padding: '14px 18px' }}
              >
                <div>
                  <div className="fw-bold text-accent" style={{ fontSize: 16 }}>{c.name}</div>
                  <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                    {isTeacher ? t('common.teacher') : t('common.student')}
                    {' · '}
                    {t('classroom.members', { count: memberCount })}
                    {' · '}
                    {t('common.code')} <code style={{ color: 'var(--text)', letterSpacing: 2 }}>{c.code}</code>
                  </div>
                </div>
                <button className="btn btn-primary text-sm" onClick={() => onEnterClassroom(c.id)}>
                  {t('lobby.viewClass')}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        panel === 'none' && (
          <div className="text-center text-muted" style={{ padding: '48px 16px' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🏫</div>
            <div className="fw-semibold" style={{ fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
              {t('classes.empty')}
            </div>
            <div className="text-base">{t('classes.emptyHint')}</div>
          </div>
        )
      )}

      {/* Action buttons */}
      {panel === 'none' && (
        <div className="row gap-8">
          <button className="btn btn-secondary text-sm" onClick={() => openPanel('create')}>
            {t('lobby.createClass')}
          </button>
          <button className="btn btn-secondary text-sm" onClick={() => openPanel('join')}>
            {t('lobby.joinClass')}
          </button>
        </div>
      )}

      {/* Create form */}
      {panel === 'create' && (
        <div className="card">
          <h2 className="mb-3" style={{ fontSize: 16 }}>{t('lobby.createClassHeading')}</h2>
          <form onSubmit={handleCreate} className="row-wrap gap-8">
            <input
              className="field flex-1"
              type="text"
              placeholder={t('lobby.classNamePlaceholder')}
              value={className}
              onChange={e => setClassName(e.target.value)}
              maxLength={40}
              autoFocus
              disabled={submitting}
              style={{ minWidth: 180 }}
            />
            <button className="btn btn-primary" type="submit" disabled={submitting || !className.trim()}>
              {submitting ? t('lobby.creating') : t('lobby.create')}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => openPanel('none')} disabled={submitting}>
              {t('common.cancel')}
            </button>
          </form>
          {classError && <p className="text-error text-sm mt-2">⚠ {classError}</p>}
        </div>
      )}

      {/* Join form */}
      {panel === 'join' && (
        <div className="card">
          <h2 className="mb-3" style={{ fontSize: 16 }}>{t('lobby.joinClassHeading')}</h2>
          <form onSubmit={handleJoin} className="row-wrap gap-8">
            <input
              className="field"
              type="text"
              placeholder={t('lobby.joinCodePlaceholder')}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoFocus
              disabled={submitting}
              style={{ width: 140, textAlign: 'center', fontSize: 20, letterSpacing: 4, fontWeight: 700 }}
            />
            <button className="btn btn-primary" type="submit" disabled={submitting || joinCode.trim().length !== 6}>
              {submitting ? t('lobby.joining') : t('lobby.join')}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => openPanel('none')} disabled={submitting}>
              {t('common.cancel')}
            </button>
          </form>
          {classError && <p className="text-error text-sm mt-2">⚠ {classError}</p>}
        </div>
      )}

    </div>
  );
}

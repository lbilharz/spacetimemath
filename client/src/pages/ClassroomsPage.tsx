import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';

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
    ? (classroomMembers as any[]).filter(m => m.playerIdentity.toHexString() === myIdentityHex)
    : [];
  const myClassrooms = myMemberships
    .map((m: any) => (classrooms as any[]).find(c => c.id === m.classroomId))
    .filter(Boolean);

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
      const created = (classrooms as any[])
        .filter((c: any) => c.teacher?.toHexString() === myIdentityHex)
        .sort((a: any, b: any) => Number(b.id - a.id))[0];
      if (created) onEnterClassroom(created.id);
      else { setPanel('none'); setClassName(''); }
    } catch (err: any) {
      setClassError(err?.message ?? 'Failed to create classroom');
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
      const classroom = (classrooms as any[]).find(c => c.code === code);
      if (classroom) onEnterClassroom(classroom.id);
      else { setPanel('none'); setJoinCode(''); }
    } catch (err: any) {
      setClassError(err?.message ?? 'Classroom not found');
      setSubmitting(false);
    }
  };

  return (
    <div className="page">

      {/* Classroom list */}
      {myClassrooms.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {myClassrooms.map((c: any) => {
            const isTeacher  = c.teacher?.toHexString() === myIdentityHex;
            const memberCount = (classroomMembers as any[]).filter(m => m.classroomId === c.id).length;
            return (
              <div
                key={String(c.id)}
                className="card"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px 18px' }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                    {isTeacher ? t('common.teacher') : t('common.student')}
                    {' · '}
                    {t('classroom.members', { count: memberCount })}
                    {' · '}
                    {t('common.code')} <code style={{ color: 'var(--text)', letterSpacing: 2 }}>{c.code}</code>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => onEnterClassroom(c.id)} style={{ fontSize: 13 }}>
                  {t('lobby.viewClass')}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        panel === 'none' && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🏫</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              {t('classes.empty')}
            </div>
            <div style={{ fontSize: 14 }}>{t('classes.emptyHint')}</div>
          </div>
        )
      )}

      {/* Action buttons */}
      {panel === 'none' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => openPanel('create')} style={{ fontSize: 13 }}>
            {t('lobby.createClass')}
          </button>
          <button className="btn btn-secondary" onClick={() => openPanel('join')} style={{ fontSize: 13 }}>
            {t('lobby.joinClass')}
          </button>
        </div>
      )}

      {/* Create form */}
      {panel === 'create' && (
        <div className="card">
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>{t('lobby.createClassHeading')}</h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className="field"
              type="text"
              placeholder={t('lobby.classNamePlaceholder')}
              value={className}
              onChange={e => setClassName(e.target.value)}
              maxLength={40}
              autoFocus
              disabled={submitting}
              style={{ flex: 1, minWidth: 180 }}
            />
            <button className="btn btn-primary" type="submit" disabled={submitting || !className.trim()}>
              {submitting ? t('lobby.creating') : t('lobby.create')}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => openPanel('none')} disabled={submitting}>
              {t('common.cancel')}
            </button>
          </form>
          {classError && <p style={{ color: 'var(--wrong)', fontSize: 13, marginTop: 8 }}>⚠ {classError}</p>}
        </div>
      )}

      {/* Join form */}
      {panel === 'join' && (
        <div className="card">
          <h2 style={{ marginBottom: 12, fontSize: 16 }}>{t('lobby.joinClassHeading')}</h2>
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
          {classError && <p style={{ color: 'var(--wrong)', fontSize: 13, marginTop: 8 }}>⚠ {classError}</p>}
        </div>
      )}

    </div>
  );
}

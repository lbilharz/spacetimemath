import { useTranslation } from 'react-i18next';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings/index.js';
import MasteryGrid from '../components/MasteryGrid.js';

interface Props {
  classSprintId: bigint;
  myIdentityHex: string;
  onBack: () => void;
}

export default function ClassSprintResultsPage({ classSprintId, myIdentityHex, onBack }: Props) {
  const { t } = useTranslation();
  const [sessions]      = useTable(tables.sessions);
  const [answers]       = useTable(tables.answers);
  const [classSprints]  = useTable(tables.class_sprints);
  const [classrooms]    = useTable(tables.classrooms);
  const [players]       = useTable(tables.players);
  const [problemStats]  = useTable(tables.problem_stats);

  // Meta
  const classSprint = (classSprints as any[]).find(s => s.id === classSprintId);
  const classroom   = classSprint
    ? (classrooms as any[]).find(c => c.id === classSprint.classroomId)
    : null;

  // Sessions that belong to this class sprint
  const sprintSessions = (sessions as any[]).filter(
    s => s.classSprintId === classSprintId
  );
  const sessionIds = new Set<bigint>(sprintSessions.map((s: any) => s.id as bigint));

  // Answers for those sessions
  const sprintAnswers = (answers as any[]).filter(a => sessionIds.has(a.sessionId));

  // Ranking — completed sessions sorted by weighted score
  const ranking = sprintSessions
    .filter((s: any) => s.isComplete)
    .map((s: any) => {
      const identityHex = s.playerIdentity.toHexString();
      const player = (players as any[]).find(p => p.identity.toHexString() === identityHex);
      const sa = sprintAnswers.filter((a: any) => a.sessionId === s.id);
      return {
        identityHex,
        username: player?.username ?? s.username,
        score: s.weightedScore as number,
        correct: sa.filter((a: any) => a.isCorrect).length,
        total: sa.length,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Incomplete-session players still running
  const running = sprintSessions.filter((s: any) => !s.isComplete).length;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 22 }}>{t('classSprint.resultsTitle')}</h1>
        {classroom && (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>📚 {classroom.name}</p>
        )}
        {running > 0 && (
          <p style={{ color: 'var(--accent)', fontSize: 13, marginTop: 4 }}>
            ⏱ {running} still running…
          </p>
        )}
      </div>

      {/* Class ranking */}
      <div className="card">
        <h2 style={{ marginBottom: 12, fontSize: 16 }}>{t('classSprint.rankingTitle')}</h2>
        {ranking.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>{t('classSprint.noResults')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={th}>#</th>
                <th style={{ ...th, textAlign: 'left' }}>{t('classroom.colPlayer')}</th>
                <th style={th}>{t('classSprint.colScore')}</th>
                <th style={th}>{t('classSprint.colCorrect')}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => {
                const isMe = r.identityHex === myIdentityHex;
                return (
                  <tr
                    key={r.identityHex}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isMe ? 'rgba(0,212,170,0.05)' : 'transparent',
                    }}
                  >
                    <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: i < 3 ? 'var(--warn)' : 'var(--muted)' }}>
                      {i < 3 ? medals[i] : i + 1}
                    </td>
                    <td style={{ ...td, fontWeight: isMe ? 700 : 400 }}>
                      {r.username}
                      {isMe && (
                        <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 12 }}>
                          {t('common.you')}
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--warn)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {r.score.toFixed(1)}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {r.correct}/{r.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Combined mastery grid for this sprint */}
      {sprintAnswers.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: 4, fontSize: 16 }}>{t('classSprint.grid')}</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {t('classSprint.gridDesc')}
          </p>
          <MasteryGrid answers={sprintAnswers} problemStats={problemStats as any[]} />
        </div>
      )}

      <button className="btn btn-secondary" onClick={onBack} style={{ fontSize: 14 }}>
        {t('classSprint.backToClass')}
      </button>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '8px 4px', fontSize: 12, fontWeight: 600, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right',
};
const td: React.CSSProperties = { padding: '10px 4px', fontSize: 15 };

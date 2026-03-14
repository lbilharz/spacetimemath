import { useTranslation } from 'react-i18next';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings/index.js';
import type { Answer, ClassSprint, Classroom, Player, ProblemStat, Session } from '../module_bindings/types.js';
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
  const classSprint = (classSprints as unknown as ClassSprint[]).find(s => s.id === classSprintId);
  const classroom   = classSprint
    ? (classrooms as unknown as Classroom[]).find(c => c.id === classSprint.classroomId)
    : null;

  // Sessions that belong to this class sprint (compare as strings to avoid bigint/number coercion issues)
  const classSprintIdStr = String(classSprintId);
  const sprintSessions = (sessions as unknown as Session[]).filter(
    s => String(s.classSprintId) === classSprintIdStr
  );
  const sessionIdStrs = new Set<string>(sprintSessions.map(s => String(s.id)));

  // Answers for those sessions
  const sprintAnswers = (answers as unknown as Answer[]).filter(a => sessionIdStrs.has(String(a.sessionId)));

  // Ranking — all sessions, completed ones use weightedScore, running ones use live answer scores
  const ranking = sprintSessions
    .map(s => {
      const identityHex = s.playerIdentity.toHexString();
      const player = (players as unknown as Player[]).find(p => p.identity.toHexString() === identityHex);
      const sa = sprintAnswers.filter(a => String(a.sessionId) === String(s.id));
      const correct = sa.filter(a => a.isCorrect).length;
      const total = sa.length;
      const isComplete = s.isComplete;
      // Completed sessions have final weightedScore; running ones: compute live from answers
      const score = isComplete
        ? s.weightedScore
        : sa.filter(a => a.isCorrect).reduce((sum, a) => {
            const key = a.a * 100 + a.b;
            const stat = (problemStats as unknown as ProblemStat[]).find(ps => ps.problemKey === key);
            return sum + (stat?.difficultyWeight ?? 1.0);
          }, 0);
      return { identityHex, username: player?.username ?? s.username, score, correct, total, isComplete };
    })
    .sort((a, b) => b.score - a.score);

  // Incomplete-session players still running
  const running = sprintSessions.filter(s => !s.isComplete).length;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="page">
      {/* Header */}
      <div className="mb-2">
        <h1 style={{ fontSize: 22 }}>{t('classSprint.resultsTitle')}</h1>
        {classroom && (
          <p className="text-muted text-base">📚 {classroom.name}</p>
        )}
        {running > 0 && (
          <p className="text-accent text-sm mt-1">
            ⏱ {running} still running…
          </p>
        )}
      </div>

      {/* Class ranking */}
      <div className="card">
        <h2 className="mb-3" style={{ fontSize: 16 }}>{t('classSprint.rankingTitle')}</h2>
        {ranking.length === 0 ? (
          <p className="text-muted text-base">{t('classSprint.noResults')}</p>
        ) : (
          <table className="table-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="tbl-th">#</th>
                <th className="tbl-th tbl-th--left">{t('classroom.colPlayer')}</th>
                <th className="tbl-th">{t('classSprint.colScore')}</th>
                <th className="tbl-th">{t('classSprint.colCorrect')}</th>
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
                      background: isMe ? 'rgba(251,186,0,0.08)' : 'transparent',
                      opacity: r.isComplete ? 1 : 0.65,
                    }}
                  >
                    <td className="tbl-td text-center fw-bold" style={{ color: i < 3 ? 'var(--warn)' : 'var(--muted)' }}>
                      {i < 3 ? medals[i] : i + 1}
                    </td>
                    <td className="tbl-td" style={{ fontWeight: isMe ? 700 : 400 }}>
                      {r.username}
                      {isMe && (
                        <span className="text-accent" style={{ marginLeft: 6, fontSize: 12 }}>
                          {t('common.you')}
                        </span>
                      )}
                      {!r.isComplete && (
                        <span className="text-accent" style={{ marginLeft: 6, fontSize: 11 }}>⏱</span>
                      )}
                    </td>
                    <td className="tbl-td tbl-td--right text-warn fw-bold tabular-nums">
                      {r.score.toFixed(1)}
                    </td>
                    <td className="tbl-td tbl-td--right text-muted tabular-nums">
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
          <h2 className="mb-1" style={{ fontSize: 16 }}>{t('classSprint.grid')}</h2>
          <p className="text-sm text-muted mb-4">
            {t('classSprint.gridDesc')}
          </p>
          <MasteryGrid answers={sprintAnswers} problemStats={problemStats as unknown as ProblemStat[]} />
        </div>
      )}

      <button className="btn btn-secondary text-base" onClick={onBack}>
        {t('classSprint.backToClass')}
      </button>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings/index.js';
import MasteryGrid from '../components/MasteryGrid.js';
import SprintHistory from '../components/SprintHistory.js';

interface Props {
  myIdentityHex: string;
  playerLearningTier?: number;
}

export default function ProgressPage({ myIdentityHex, playerLearningTier = 0 }: Props) {
  const { t } = useTranslation();
  const [sessions]     = useTable(tables.sessions);
  const [answers]      = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);
  const [unlockLogs]   = useTable(tables.unlock_logs);

  const myAnswers = (answers as any[]).filter(
    a => a.playerIdentity.toHexString() === myIdentityHex
  );
  const tier1Unlocked = (unlockLogs as any[]).some(
    u => u.playerIdentity.toHexString() === myIdentityHex && u.tier === 1
  );

  return (
    <div className="page">
      {tier1Unlocked && (
        <div className="card" style={{
          border: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
        }}>
          <span style={{ fontSize: 24 }}>🔓</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--accent)' }}>
              {t('unlock.tier1Title' as any)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {t('unlock.tier1Desc' as any)}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: 4 }}>{t('lobby.masteryTitle')}</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          {t('lobby.masteryDesc')}
        </p>
        <MasteryGrid
          answers={myAnswers}
          problemStats={problemStats as any[]}
          tier1Unlocked={tier1Unlocked}
          playerLearningTier={playerLearningTier}
        />
      </div>

      <SprintHistory
        sessions={sessions as any[]}
        answers={answers as any[]}
        myIdentityHex={myIdentityHex}
      />
    </div>
  );
}

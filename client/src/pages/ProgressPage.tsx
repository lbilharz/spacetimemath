import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings/index.js';
import type { Answer, ProblemStat, Session } from '../module_bindings/types.js';
import MasteryGrid from '../components/MasteryGrid.js';
import SprintHistory from '../components/SprintHistory.js';
import ScoringGuide from '../components/ScoringGuide.js';

interface Props {
  myIdentityHex: string;
  playerLearningTier?: number;
}

const TIER_EMOJI = ['🌱', '🔨', '⚡', '🏆'];

export default function ProgressPage({ myIdentityHex, playerLearningTier = 0 }: Props) {
  const { t } = useTranslation();
  const [sessions]     = useTable(tables.sessions);
  const [answers]      = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);

  const myAnswers = (answers as unknown as Answer[]).filter(
    a => a.playerIdentity.toHexString() === myIdentityHex
  );

  const isMaxTier = playerLearningTier >= 3;

  return (
    <div className="page">
      {/* Tier status card */}
      <div id="tier-status" className="card" style={{
        border: `1px solid ${isMaxTier ? 'var(--accent)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
      }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{TIER_EMOJI[Math.min(playerLearningTier, 3)]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, fontSize: 15,
            color: isMaxTier ? 'var(--accent)' : 'var(--text)',
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            {t(`tiers.tier${playerLearningTier}Name` as ParseKeys)}
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--muted)',
              background: 'var(--card2)', padding: '2px 8px',
              borderRadius: 6, border: '1px solid var(--border)',
            }}>
              {t('tiers.statusLevel', { tier: playerLearningTier })}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
            {isMaxTier
              ? t('tiers.allUnlocked')
              : t(`tiers.nextUnlock${playerLearningTier}` as ParseKeys)}
          </div>
        </div>
      </div>

      <div id="mastery" className="card">
        <h2 style={{ marginBottom: 4 }}>{t('lobby.masteryTitle')}</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          {t('lobby.masteryDesc')}
        </p>
        <MasteryGrid
          answers={myAnswers}
          problemStats={problemStats as unknown as ProblemStat[]}
          tier1Unlocked={playerLearningTier >= 3}
          playerLearningTier={playerLearningTier}
        />
      </div>

      <ScoringGuide
        problemStats={problemStats as unknown as ProblemStat[]}
        playerLearningTier={playerLearningTier}
      />

      <div id="history">
        <SprintHistory
          sessions={sessions as unknown as Session[]}
          answers={answers as unknown as Answer[]}
          myIdentityHex={myIdentityHex}
        />
      </div>
    </div>
  );
}

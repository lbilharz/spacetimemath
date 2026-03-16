import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Answer, ProblemStat, Session } from '../module_bindings/types.js';
import MasteryGrid from '../components/MasteryGrid.js';
import SprintHistory from '../components/SprintHistory.js';
import ScoringGuide from '../components/ScoringGuide.js';
import TierLadder from '../components/TierLadder.js';

interface Props {
  myIdentityHex: string;
  playerLearningTier?: number;
  extendedMode?: boolean;
}

const TIER_EMOJI = ['🌱', '🔨', '⚡', '🎯', '🔥', '💫', '🌟', '🏆'] as const;

export default function ProgressPage({ myIdentityHex, playerLearningTier = 0, extendedMode = false }: Props) {
  const { t } = useTranslation();
  const [sessions]     = useTable(tables.sessions);
  const [answers]      = useTable(tables.answers);
  const [problemStats] = useTable(tables.problem_stats);
  const setLearningTier   = useSTDBReducer(reducers.setLearningTier);
  const setExtendedMode   = useSTDBReducer(reducers.setExtendedMode);

  const [adjusting, setAdjusting]         = useState(false);
  const [pendingTier, setPendingTier]     = useState(playerLearningTier);
  const [saving, setSaving]               = useState(false);
  const [extendedSaving, setExtendedSaving] = useState(false);

  const handleToggleExtended = async (enabled: boolean) => {
    setExtendedSaving(true);
    await setExtendedMode({ enabled });
    setExtendedSaving(false);
  };

  const myAnswers = (answers as unknown as Answer[]).filter(
    a => a.playerIdentity.toHexString() === myIdentityHex
  );

  const isMaxTier = playerLearningTier >= 7;

  const handleSetTier = async () => {
    if (saving || pendingTier === playerLearningTier) { setAdjusting(false); return; }
    setSaving(true);
    await setLearningTier({ tier: pendingTier });
    setSaving(false);
    setAdjusting(false);
  };

  return (
    <div className="page">
      {/* Tier status card */}
      <div
        id="tier-status"
        className="card row gap-12"
        style={{
          border: `1px solid ${isMaxTier ? 'var(--accent)' : 'var(--border)'}`,
          padding: '14px 20px',
        }}
      >
        <span className="text-28 lh-1">
          {TIER_EMOJI[Math.min(playerLearningTier, 7)]}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="row-wrap fw-bold gap-8"
            style={{
              fontSize: 15,
              color: isMaxTier ? 'var(--accent)' : 'var(--text)',
            }}
          >
            {t(`tiers.tier${playerLearningTier}Name` as ParseKeys)}
            <span className="text-xs fw-bold text-muted" style={{
              background: 'var(--card2)', padding: '2px 8px',
              borderRadius: 6, border: '1px solid var(--border)',
            }}>
              {t('tiers.statusLevel', { tier: playerLearningTier })}
            </span>
          </div>
          <div className="text-sm text-muted mt-1">
            {isMaxTier
              ? t('tiers.allUnlocked')
              : t(`tiers.nextUnlock${playerLearningTier}` as ParseKeys)}
          </div>
        </div>
      </div>

      {/* Tier ladder */}
      <div className="card col gap-12">
        <div className="row-between">
          <h2>{t('tierPicker.adjustTitle')}</h2>
          {!adjusting && (
            <button
              onClick={() => { setPendingTier(playerLearningTier); setAdjusting(true); }}
              className="btn btn-secondary btn-sm"
            >
              ✏️ {t('tierPicker.adjustTitle')}
            </button>
          )}
        </div>

        {adjusting ? (
          <>
            <p className="text-sm text-muted">
              {t('tierPicker.adjustBody')}
            </p>
            <TierLadder
              currentTier={playerLearningTier}
              selectedTier={pendingTier}
              onSelect={setPendingTier}
            />
            <div className="row gap-8">
              <button
                onClick={() => setAdjusting(false)}
                className="btn btn-secondary btn-sm flex-1"
              >
                {t('onboarding.back')}
              </button>
              <button
                onClick={handleSetTier}
                disabled={saving}
                className="btn btn-primary btn-sm flex-1"
                style={{ opacity: saving ? 0.7 : 1 }}
              >
                {saving ? '…' : t('tierPicker.setLevel')}
              </button>
            </div>
          </>
        ) : (
          <TierLadder currentTier={playerLearningTier} />
        )}
      </div>

      <div id="mastery" className="card">
        <h2 className="mb-1">{t('lobby.masteryTitle')}</h2>
        <p className="text-sm text-muted mb-4">
          {t('lobby.masteryDesc')}
        </p>
        {isMaxTier && (
          <div className="row-between mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
            <span className="fw-semibold text-sm">{t('extendedTables.toggle')}</span>
            <button
              className={`btn btn-sm ${extendedMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleToggleExtended(!extendedMode)}
              disabled={extendedSaving}
            >
              {extendedMode ? t('extendedTables.on') : t('extendedTables.off')}
            </button>
          </div>
        )}
        <MasteryGrid
          answers={myAnswers}
          problemStats={problemStats as unknown as ProblemStat[]}
          tier1Unlocked={playerLearningTier >= 7}
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

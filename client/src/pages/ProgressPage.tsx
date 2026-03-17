import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useTable, useReducer as useSTDBReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings/index.js';
import type { Answer, ProblemStat, Session } from '../module_bindings/types.js';
import MasteryGrid from '../components/MasteryGrid.js';
import SprintHistory from '../components/SprintHistory.js';
import TierLadder from '../components/TierLadder.js';

interface Props {
  myIdentityHex: string;
  playerLearningTier?: number;
  extendedMode?: boolean;
  extendedLevel?: number;
}

const TIER_EMOJI = ['🌱', '🔨', '⚡', '🎯', '🔥', '💫', '🌟', '🏆'] as const;

export default function ProgressPage({ myIdentityHex, playerLearningTier = 0, extendedMode = false, extendedLevel = 0 }: Props) {
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
      {/* My Level card — unified summary + edit */}
      <div
        id="my-level"
        className="card col gap-12"
        style={{
          border: `1px solid ${isMaxTier ? 'var(--accent)' : 'var(--border)'}`,
        }}
      >
        {/* Header row: summary info */}
        <div className="row gap-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="text-28 lh-1">
            {TIER_EMOJI[Math.min(playerLearningTier, 7)]}
          </span>
          <div className="col" style={{ gap: 2 }}>
            <div
              className="row-wrap fw-bold gap-8"
              style={{ fontSize: 15, color: isMaxTier ? 'var(--accent)' : 'var(--text)' }}
            >
              <span>{t(`tiers.tier${playerLearningTier}Name` as ParseKeys)}</span>
              {extendedMode && extendedLevel > 0 && (
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                  +{extendedLevel}
                </span>
              )}
              <span className="text-xs fw-bold text-muted" style={{
                background: 'var(--card2)', padding: '2px 8px',
                borderRadius: 6, border: '1px solid var(--border)',
              }}>
                {t('tiers.statusLevel', { tier: playerLearningTier })}
              </span>
            </div>
            <div className="text-sm text-muted">
              {isMaxTier
                ? t('tiers.allUnlocked')
                : t(`tiers.nextUnlock${playerLearningTier}` as ParseKeys)}
            </div>
          </div>
        </div>

        {/* Tier ladder — always visible */}
        {adjusting ? (
          <>
            <TierLadder
              currentTier={playerLearningTier}
              selectedTier={pendingTier}
              onSelect={setPendingTier}
            />
            <p className="text-sm text-muted">
              {t('tierPicker.adjustBody')}
            </p>
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
          <>
            <TierLadder currentTier={playerLearningTier} />
            <button
              onClick={() => { setPendingTier(playerLearningTier); setAdjusting(true); }}
              className="btn btn-secondary btn-sm"
            >
              ✏️ {t('tierPicker.changeLevel')}
            </button>
          </>
        )}

        {/* Extended-mode toggle — only when isMaxTier */}
        {isMaxTier && (
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <label
              htmlFor="extended-toggle"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: extendedSaving ? 'not-allowed' : 'pointer',
                opacity: extendedSaving ? 0.6 : 1,
                flex: 1,
                minWidth: 0,
                flexWrap: 'wrap',
              }}
            >
              <span className="fw-semibold text-sm" style={{ whiteSpace: 'nowrap' }}>
                {t('extendedTables.toggle')}
              </span>
              <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(n => (
                  <span
                    key={n}
                    className="text-xs"
                    style={{
                      background: 'var(--card2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      borderRadius: 12,
                      padding: '2px 8px',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    ×{n}
                  </span>
                ))}
              </span>
            </label>

            {/* Pill switch */}
            <label
              htmlFor="extended-toggle"
              style={{
                position: 'relative',
                display: 'inline-block',
                width: 44,
                height: 24,
                flexShrink: 0,
                cursor: extendedSaving ? 'not-allowed' : 'pointer',
                opacity: extendedSaving ? 0.6 : 1,
              }}
            >
              <input
                id="extended-toggle"
                type="checkbox"
                checked={extendedMode}
                disabled={extendedSaving}
                onChange={e => handleToggleExtended(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
              />
              {/* Track */}
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 24,
                  background: extendedMode ? 'var(--accent)' : 'var(--card2)',
                  border: `1px solid ${extendedMode ? 'var(--accent)' : 'var(--border)'}`,
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              />
              {/* Thumb */}
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: extendedMode ? 23 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: extendedMode ? '#fff' : 'var(--muted)',
                  transition: 'left 0.2s, background 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </label>
          </div>
        )}
      </div>

      <div id="mastery" className="card">
        <h2 className="mb-1">{t('lobby.masteryTitle')}</h2>
        <p className="text-sm text-muted mb-4">
          {t('lobby.masteryDesc')}
        </p>
        <MasteryGrid
          answers={myAnswers}
          problemStats={problemStats as unknown as ProblemStat[]}
          tier1Unlocked={playerLearningTier >= 7}
          playerLearningTier={playerLearningTier}
        />
      </div>

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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';

type BestScore = {
  playerIdentity: { toHexString(): string };
  username: string;
  bestWeightedScore: number;
  bestAccuracyPct: number;
  bestTotalAnswered: number;
  learningTier: number;
};

const TIER_EMOJI = ['🌱', '🔨', '⚡', '🎯', '🔥', '💫', '🌟', '🏆'];

interface Props {
  bestScores: BestScore[];
  myIdentityHex: string | undefined;
  myLearningTier?: number;
}

export default function Leaderboard({ bestScores, myIdentityHex, myLearningTier: _myLearningTier = 0 }: Props) {
  const { t } = useTranslation();
  // -1 means "All tiers"
  const [tierFilter, setTierFilter] = useState<number>(-1);

  const filtered = tierFilter === -1
    ? bestScores
    : bestScores.filter(s => s.learningTier === tierFilter);

  const sorted = [...filtered].sort((a, b) => b.bestWeightedScore - a.bestWeightedScore);
  const rows = sorted.slice(0, 10);

  // Find the current player's rank in the full sorted list
  const myRankIndex = sorted.findIndex(s => s.playerIdentity.toHexString() === myIdentityHex);
  const myRow = myRankIndex >= 10 ? sorted[myRankIndex] : null; // null if already in top 10

  const medals = ['🥇', '🥈', '🥉'];

  // Gather which tiers actually exist in the data (for showing tabs)
  const tiersPresent = Array.from(new Set(bestScores.map(s => s.learningTier))).sort();

  return (
    <div className="card">
      <h2 className="mb-3">{t('leaderboard.title')}</h2>

      {/* Tier filter tabs */}
      {tiersPresent.length > 1 && (
        <div className="row-wrap gap-6 mb-4">
          <button
            onClick={() => setTierFilter(-1)}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: tierFilter === -1 ? 'var(--accent)' : 'var(--card2)',
              color: tierFilter === -1 ? '#000' : 'var(--muted)',
            }}
          >
            {t('leaderboard.tierAll')}
          </button>
          {tiersPresent.map(tier => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: tierFilter === tier ? 'var(--accent)' : 'var(--card2)',
                color: tierFilter === tier ? '#000' : 'var(--muted)',
              }}
            >
              {TIER_EMOJI[Math.min(tier, 7)]} {t(`tiers.tier${tier}Name` as ParseKeys)}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-muted text-sm">
          {t('leaderboard.empty')}
        </p>
      ) : (
        <table className="table-full">
          <thead>
            <tr className="divider-bottom">
              <th className="tbl-th">{t('leaderboard.colHash')}</th>
              <th className="tbl-th tbl-th--left">{t('leaderboard.colPlayer')}</th>
              <th className="tbl-th">{t('leaderboard.colScore')}</th>
              <th className="tbl-th">{t('leaderboard.colAccuracy')}</th>
              <th className="tbl-th">{t('leaderboard.colAnswers')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const isMe = s.playerIdentity.toHexString() === myIdentityHex;
              return (
                <tr
                  key={s.playerIdentity.toHexString()}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: isMe ? 'rgba(251,186,0,0.08)' : 'transparent',
                  }}
                >
                  <td className="tbl-td fw-bold text-center tabular-nums" style={{ color: i < 3 ? 'var(--warn)' : 'var(--muted)' }}>
                    {i < 3 ? medals[i] : i + 1}
                  </td>
                  <td className={`tbl-td${isMe ? ' fw-bold' : ''}`}>
                    <span>{s.username}</span>
                    {tierFilter === -1 && (
                      <span className="text-xs" style={{ marginLeft: 6 }} title={t(`tiers.tier${s.learningTier}Name` as ParseKeys)}>
                        {TIER_EMOJI[Math.min(s.learningTier, 3)]}
                      </span>
                    )}
                    {isMe && <span className="text-accent text-xs" style={{ marginLeft: 6 }}>{t('leaderboard.you')}</span>}
                  </td>
                  <td className="tbl-td tbl-td--right fw-bold text-warn tabular-nums">
                    {s.bestWeightedScore.toFixed(1)}
                  </td>
                  <td className="tbl-td tbl-td--right text-muted tabular-nums">
                    {s.bestAccuracyPct}%
                  </td>
                  <td className="tbl-td tbl-td--right text-muted tabular-nums">
                    {s.bestTotalAnswered}
                  </td>
                </tr>
              );
            })}
            {/* "You" row when player is outside the top 10 */}
            {myRow && (
              <>
                <tr>
                  <td colSpan={5} className="text-center text-muted text-sm" style={{ padding: '4px 0', letterSpacing: 2 }}>
                    ···
                  </td>
                </tr>
                <tr style={{ background: 'rgba(251,186,0,0.08)', borderTop: '1px solid var(--border)' }}>
                  <td className="tbl-td fw-bold text-muted text-center">
                    {myRankIndex + 1}
                  </td>
                  <td className="tbl-td fw-bold">
                    <span>{myRow.username}</span>
                    {tierFilter === -1 && (
                      <span className="text-xs" style={{ marginLeft: 6 }}>{TIER_EMOJI[Math.min(myRow.learningTier, 3)]}</span>
                    )}
                    <span className="text-accent text-xs" style={{ marginLeft: 6 }}>{t('leaderboard.you')}</span>
                  </td>
                  <td className="tbl-td tbl-td--right fw-bold text-warn tabular-nums">
                    {myRow.bestWeightedScore.toFixed(1)}
                  </td>
                  <td className="tbl-td tbl-td--right text-muted tabular-nums">
                    {myRow.bestAccuracyPct}%
                  </td>
                  <td className="tbl-td tbl-td--right text-muted tabular-nums">
                    {myRow.bestTotalAnswered}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      )}
      <p className="text-xs text-muted mt-2">
        {t('leaderboard.footer')}
      </p>
    </div>
  );
}

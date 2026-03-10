import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type BestScore = {
  playerIdentity: { toHexString(): string };
  username: string;
  bestWeightedScore: number;
  bestAccuracyPct: number;
  bestTotalAnswered: number;
  learningTier: number;
};

const TIER_EMOJI = ['🌱', '🔨', '⚡', '🏆'];

interface Props {
  bestScores: BestScore[];
  myIdentityHex: string | undefined;
  myLearningTier?: number;
}

export default function Leaderboard({ bestScores, myIdentityHex, myLearningTier = 0 }: Props) {
  const { t } = useTranslation();
  // -1 means "All tiers"
  const [tierFilter, setTierFilter] = useState<number>(-1);

  const filtered = tierFilter === -1
    ? bestScores
    : bestScores.filter(s => s.learningTier === tierFilter);

  const rows = [...filtered]
    .sort((a, b) => b.bestWeightedScore - a.bestWeightedScore)
    .slice(0, 10);

  const medals = ['🥇', '🥈', '🥉'];

  // Gather which tiers actually exist in the data (for showing tabs)
  const tiersPresent = Array.from(new Set(bestScores.map(s => s.learningTier))).sort();

  return (
    <div className="card">
      <h2 style={{ marginBottom: 12 }}>{t('leaderboard.title')}</h2>

      {/* Tier filter tabs */}
      {tiersPresent.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
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
              {TIER_EMOJI[Math.min(tier, 3)]} {t(`leaderboard.tier${tier}` as any)}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          {t('leaderboard.empty')}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={th}>{t('leaderboard.colHash')}</th>
              <th style={{ ...th, textAlign: 'left' }}>{t('leaderboard.colPlayer')}</th>
              <th style={th}>{t('leaderboard.colScore')}</th>
              <th style={th}>{t('leaderboard.colAccuracy')}</th>
              <th style={th}>{t('leaderboard.colAnswers')}</th>
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
                  <td style={{ ...td, fontWeight: 700, color: i < 3 ? 'var(--warn)' : 'var(--muted)', textAlign: 'center' }}>
                    {i < 3 ? medals[i] : i + 1}
                  </td>
                  <td style={{ ...td, fontWeight: isMe ? 700 : 400 }}>
                    <span>{s.username}</span>
                    {tierFilter === -1 && (
                      <span style={{ marginLeft: 6, fontSize: 11 }} title={t(`tiers.tier${s.learningTier}Name` as any)}>
                        {TIER_EMOJI[Math.min(s.learningTier, 3)]}
                      </span>
                    )}
                    {isMe && <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 12 }}>{t('leaderboard.you')}</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--warn)', fontVariantNumeric: 'tabular-nums' }}>
                    {s.bestWeightedScore.toFixed(1)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {s.bestAccuracyPct}%
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {s.bestTotalAnswered}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
        {t('leaderboard.footer')}
      </p>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 4px', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' };
const td: React.CSSProperties = { padding: '10px 4px', fontSize: 15 };

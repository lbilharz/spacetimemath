import { useTranslation } from 'react-i18next';

type Session = {
  id: bigint;
  playerIdentity: { toHexString(): string };
  username: string;
  weightedScore: number;
  rawScore: number;
  accuracyPct: number;
  totalAnswered: number;
  isComplete: boolean;
};

interface Props {
  sessions: Session[];
  myIdentityHex: string | undefined;
}

export default function Leaderboard({ sessions, myIdentityHex }: Props) {
  const { t } = useTranslation();
  const completed = sessions
    .filter(s => s.isComplete && s.totalAnswered > 0)
    .sort((a, b) => b.weightedScore - a.weightedScore);

  // Best session per player
  const best = new Map<string, Session>();
  for (const s of completed) {
    const hex = s.playerIdentity.toHexString();
    const existing = best.get(hex);
    if (!existing || s.weightedScore > existing.weightedScore) {
      best.set(hex, s);
    }
  }
  const rows = [...best.values()].sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 10);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>{t('leaderboard.title')}</h2>
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
                  key={String(s.id)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: isMe ? 'rgba(0,212,170,0.05)' : 'transparent',
                  }}
                >
                  <td style={{ ...td, fontWeight: 700, color: i < 3 ? 'var(--warn)' : 'var(--muted)', textAlign: 'center' }}>
                    {i < 3 ? medals[i] : i + 1}
                  </td>
                  <td style={{ ...td, fontWeight: isMe ? 700 : 400 }}>
                    {s.username}
                    {isMe && <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 12 }}>{t('leaderboard.you')}</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--warn)', fontVariantNumeric: 'tabular-nums' }}>
                    {s.weightedScore.toFixed(1)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {s.accuracyPct}%
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {s.totalAnswered}
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

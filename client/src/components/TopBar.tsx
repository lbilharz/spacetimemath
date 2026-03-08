import { useTranslation } from 'react-i18next';

interface Props {
  myPlayer: { username: string };
  onAccount: () => void;
  onBack?: () => void;
  backLabel?: string;
}

export default function TopBar({ myPlayer, onAccount, onBack, backLabel }: Props) {
  const { t, i18n } = useTranslation();
  const otherLang = i18n.language.startsWith('de') ? 'en' : 'de';

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: 14, padding: '4px 0',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            ← {backLabel ?? t('common.back')}
          </button>
        )}
        {onBack && <span style={{ color: 'var(--border)', fontSize: 16 }}>|</span>}
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.2px' }}>
          {t('app.brand')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => i18n.changeLanguage(otherLang)}
          style={{
            fontSize: 11, fontWeight: 700, background: 'var(--card2)',
            border: '1px solid var(--border)', borderRadius: 4,
            padding: '2px 7px', color: 'var(--muted)', cursor: 'pointer',
            letterSpacing: '0.5px',
          }}
        >
          {otherLang.toUpperCase()}
        </button>

        <button
          onClick={onAccount}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'var(--muted)', fontSize: 14, padding: '4px 0',
          }}
        >
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{myPlayer.username}</span>
          <span style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--card2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: 'var(--muted)',
          }}>⚙</span>
        </button>
      </div>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import type { Page } from '../App.js';

type NavTab = 'lobby' | 'classrooms' | 'progress' | 'account';

const TABS: { id: NavTab; icon: string; labelKey: string }[] = [
  { id: 'lobby',      icon: '⚡', labelKey: 'nav.home'     },
  { id: 'classrooms', icon: '🏫', labelKey: 'nav.classes'  },
  { id: 'progress',   icon: '📊', labelKey: 'nav.progress' },
  { id: 'account',    icon: '⚙',  labelKey: 'nav.account'  },
];

interface Props {
  myPlayer?: { username: string };
  active: Page;
  onNavigate: (tab: NavTab) => void;
}

export default function TopBar({ myPlayer, active, onNavigate }: Props) {
  const { t, i18n } = useTranslation();
  const otherLang = i18n.language.startsWith('de') ? 'en' : 'de';

  return (
    <div className="topbar">
      {/* Brand */}
      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.2px', flexShrink: 0 }}>
        {t('app.brand')}
      </span>

      {/* Tab links — only when a player is registered */}
      {myPlayer && (
        <div style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }}>
          {TABS.map(tab => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
                  cursor: 'pointer',
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'color 0.15s',
                }}
              >
                <span style={{ fontSize: 15 }}>{tab.icon}</span>
                {t(tab.labelKey as any)}
              </button>
            );
          })}
        </div>
      )}

      {/* Language toggle */}
      <button
        onClick={() => i18n.changeLanguage(otherLang)}
        style={{
          fontSize: 11, fontWeight: 700,
          background: 'var(--card2)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '2px 7px',
          color: 'var(--muted)',
          cursor: 'pointer',
          letterSpacing: '0.5px',
          flexShrink: 0,
        }}
      >
        {otherLang.toUpperCase()}
      </button>
    </div>
  );
}

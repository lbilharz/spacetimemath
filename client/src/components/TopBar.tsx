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
                  borderBottom: (isActive && tab.id !== 'lobby') ? '2px solid var(--accent)' : '2px solid transparent',
                  color: isActive ? 'var(--text)' : 'var(--muted)',
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
                {tab.id === 'lobby' ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <rect width="100" height="100" rx="14" fill="#2C3E50"/>
                      <rect x="6"  y="6"  width="26" height="26" rx="5" fill="#5DD23C"/>
                      <rect x="37" y="6"  width="26" height="26" rx="5" fill="#5DD23C"/>
                      <rect x="68" y="6"  width="26" height="26" rx="5" fill="#FBBA00"/>
                      <rect x="6"  y="37" width="26" height="26" rx="5" fill="#5DD23C"/>
                      <rect x="37" y="37" width="26" height="26" rx="5" fill="#FBBA00"/>
                      <rect x="68" y="37" width="26" height="26" rx="5" fill="#4FA7FF"/>
                      <rect x="6"  y="68" width="26" height="26" rx="5" fill="#4FA7FF"/>
                      <rect x="37" y="68" width="26" height="26" rx="5" fill="#E8391D"/>
                      <rect x="68" y="68" width="26" height="26" rx="5" fill="rgba(255,255,255,0.2)"/>
                    </svg>
                    <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px' }}>1UP</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 15 }}>{tab.icon}</span>
                    {t(tab.labelKey as any)}
                  </>
                )}
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

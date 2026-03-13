import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import type { Page } from '../App.js';

export type NavTab = 'lobby' | 'classrooms' | 'progress' | 'account';

interface Props {
  active: Page;
  onNavigate: (tab: NavTab) => void;
}

const tabs: { id: NavTab; emoji: string | null; labelKey: ParseKeys }[] = [
  { id: 'lobby',      emoji: null, labelKey: 'nav.home'     },
  { id: 'classrooms', emoji: '🏫', labelKey: 'nav.classes'  },
  { id: 'progress',   emoji: '📊', labelKey: 'nav.progress' },
  { id: 'account',    emoji: '⚙',  labelKey: 'nav.account'  },
];

export default function BottomNav({ active, onNavigate }: Props) {
  const { t } = useTranslation();

  return (
    <nav className="bottomnav">
      {tabs.map(tab => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 4px',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              transition: 'color 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {tab.id === 'lobby' ? (
              <>
                <svg width="22" height="22" viewBox="0 0 100 100" aria-hidden="true">
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
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '-0.2px' }}>1UP</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 22 }}>{tab.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  {t(tab.labelKey)}
                </span>
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}

import { useTranslation } from 'react-i18next';
import type { Page } from '../App.js';

export type NavTab = 'lobby' | 'progress' | 'account';

interface Props {
  active: Page;
  onNavigate: (tab: NavTab) => void;
}

const TABS: { id: NavTab; icon: string; labelKey: string }[] = [
  { id: 'lobby',    icon: '⚡', labelKey: 'nav.home'     },
  { id: 'progress', icon: '📊', labelKey: 'nav.progress' },
  { id: 'account',  icon: '⚙',  labelKey: 'nav.account'  },
];

export default function BottomNav({ active, onNavigate }: Props) {
  const { t } = useTranslation();

  return (
    <nav className="bottomnav">
      {TABS.map(tab => {
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
            <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
            }}>
              {t(tab.labelKey as any)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import type { Page } from '../navigation.js';

type NavTab = 'lobby' | 'classrooms' | 'progress' | 'account';

const TABS: { id: NavTab; icon: string; labelKey: ParseKeys }[] = [
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
        <div className="row-center gap-4 flex-1">
          {TABS.map(tab => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className={`topbar-tab row gap-6${isActive ? ' topbar-tab--active' : ''}`}
              >
                {tab.id === 'lobby' ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
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
                    <span className="fw-extrabold" style={{ fontSize: 15, letterSpacing: '-0.3px' }}>1UP</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 15 }}>{tab.icon}</span>
                    {t(tab.labelKey)}
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
        className="lang-btn shrink-0 fw-bold label-caps"
      >
        {otherLang.toUpperCase()}
      </button>
    </div>
  );
}

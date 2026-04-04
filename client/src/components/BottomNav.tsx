import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import type { Page } from '../navigation.js';
import { LobbyIcon, ClassesIcon, ProgressIcon, AccountIcon, FriendsIcon } from './Icons.js';

export type NavTab = 'lobby' | 'classrooms' | 'friends' | 'progress' | 'account';

interface Props {
  active: Page;
}

const tabs: { id: NavTab; labelKey: ParseKeys | string }[] = [
  { id: 'lobby',      labelKey: 'nav.home'     },
  { id: 'classrooms', labelKey: 'nav.classes'  },
  { id: 'friends',    labelKey: 'nav.friends'  },
  { id: 'progress',   labelKey: 'nav.progress' },
  { id: 'account',    labelKey: 'nav.account'  },
];

const renderIcon = (tabId: NavTab, isActive: boolean) => {
  const baseClasses = "transition-all duration-300 ease-out";
  const activeClasses = "scale-[1.15] drop-shadow-md opacity-100";
  const inactiveClasses = "scale-[0.95] opacity-50 grayscale hover:grayscale-[0.5] hover:opacity-80";
  const svgClass = `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`;
  
  switch (tabId) {
    case 'lobby':
      return <LobbyIcon className={svgClass} customBackground={<rect width="100" height="100" rx="18" className="fill-slate-800 dark:fill-white/10 transition-colors duration-200"/>} />;
    case 'classrooms':
      return <ClassesIcon className={svgClass} />;
    case 'friends':
      return <FriendsIcon className={svgClass} />;
    case 'progress':
      return <ProgressIcon className={svgClass} />;
    case 'account':
      return <AccountIcon className={svgClass} />;
  }
};

export default function BottomNav({ active }: Props) {
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:w-[500px] sm:rounded-[28px] z-50 flex flex-row items-stretch justify-center border-t sm:border border-slate-200/80 bg-white/85 pb-[env(safe-area-inset-bottom)] sm:pb-0 backdrop-blur-xl transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-900/85 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] sm:shadow-2xl">
      <div className="flex w-full max-w-xl items-stretch px-2 sm:px-6">
        {tabs.map(tab => {
          const isActive = active === tab.id;
          return (
            <a
              key={tab.id}
              href={tab.id === 'lobby' ? '/' : `/${tab.id}`}
              className={`group relative flex flex-1 flex-col items-center justify-end sm:justify-center gap-1.5 p-2 pt-3.5 sm:pt-2.5 sm:pb-2.5 transition-all duration-300 ease-out ${
                isActive 
                  ? 'cursor-default text-slate-900 dark:text-white font-bold translate-y-[-2px]' 
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 active:scale-95'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-brand-yellow shadow-[0_2px_8px_rgba(250,204,21,0.6)]" />
              )}
            
            <div className="mb-0.5 relative flex items-center justify-center">
              {renderIcon(tab.id, isActive)}
            </div>
            
              <span className="font-semibold text-[10px] tracking-tight uppercase">
                {tab.id === 'lobby' ? '1UP' : tab.labelKey.includes('nav.') ? t(tab.labelKey as ParseKeys) : tab.labelKey}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

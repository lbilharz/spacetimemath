import { useTranslation } from 'react-i18next';
import { ProgressIcon, FriendsIcon, ClassesIcon, Swosh, TestLevelIcon, LobbyIcon, AccountIcon } from '../components/Icons.js';
import marketingDict from './marketingDict.json';

const getMarketingInfo = (lang: string) => {
  const code = lang.split('-')[0] || 'en';
  return (marketingDict as any)[code] || (marketingDict as any)['en'];
};

const BottomNavMock = ({ active }: { active: string }) => {
  const { t } = useTranslation();
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-50 flex flex-row items-stretch justify-center border-t border-slate-800/80 bg-slate-900/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] md:rounded-b-[40px] md:border-b">
      <div className="flex w-full max-w-[600px] items-stretch px-2 pb-0">
        {[
          { id: 'lobby', icon: LobbyIcon, label: '1UP' },
          { id: 'progress', icon: ProgressIcon, label: t('nav.progress', 'PROGRESS') },
          { id: 'friends', icon: FriendsIcon, label: t('nav.friends', 'FRIENDS') },
          { id: 'classrooms', icon: ClassesIcon, label: t('nav.classes', 'CLASSES') },
          { id: 'account', icon: AccountIcon, label: t('nav.account', 'ACCOUNT') }
        ].map(tab => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <div key={tab.id} className={`group relative flex flex-1 flex-col items-center justify-end gap-1.5 p-2 pt-3.5 pb-2 transition-all duration-300 ease-out ${isActive ? 'text-white font-bold translate-y-[-2px]' : 'text-slate-500'}`}>
              {isActive && <div className="absolute top-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-brand-yellow shadow-[0_2px_8px_rgba(250,204,21,0.6)]" />}
              <div className="mb-0.5 relative flex items-center justify-center">
                <Icon className={`transition-all duration-300 ${isActive ? 'scale-[1.15] drop-shadow-[0_2px_10px_rgba(250,204,21,0.2)] opacity-100' : 'scale-[0.95] opacity-50 grayscale hover:opacity-80'}`} customBackground={<rect width="100" height="100" rx="18" className="fill-slate-800" />} />
              </div>
              <span className="font-semibold text-[10px] tracking-tight uppercase leading-none">{tab.label}</span>
            </div>
          );
        })}
      </div>
    </nav>
  );
};

const MarketingSidePanel = ({ title, desc, badge, lang }: { title: string, desc: string, badge?: string, lang: string }) => {
   const isRtl = lang.startsWith('ar');
   return (
     <div className="flex md:hidden lg:hidden flex-col justify-center items-center w-full px-6 pt-10 pb-6 z-10 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
       {badge && (
         <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-full px-3 py-1 mb-4">
            <div className="w-2 h-2 rounded-full bg-brand-yellow drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]"></div>
            <span className="text-[11px] font-bold text-slate-300 tracking-widest uppercase">{badge}</span>
         </div>
       )}
       <h1 className="text-[28px] xs:text-[34px] font-black text-white leading-[1.1] tracking-tight mb-3" dangerouslySetInnerHTML={{ __html: title.replace('<sw>', '<span class="text-brand-yellow relative inline-block">').replace('</sw>', '<svg class="absolute w-full h-4 -bottom-1 left-0 text-brand-yellow/40 z-[-1]" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 15 100 5" stroke="currentColor" stroke-width="8" fill="transparent"/></svg></span>') }} />
       <p className="text-[15px] sm:text-[17px] text-slate-300 font-medium leading-snug max-w-[340px]">
         {desc}
       </p>
     </div>
   );
};

const MarketingSidePanelDesktop = ({ title, desc, badge, lang }: { title: string, desc: string, badge?: string, lang: string }) => {
   const isRtl = lang.startsWith('ar');
   return (
     <div className="hidden md:flex flex-col justify-center w-1/2 px-12 lg:px-20 z-10" dir={isRtl ? 'rtl' : 'ltr'}>
       <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-full px-4 py-1.5 mb-8 w-max">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-yellow drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]"></div>
          <span className="text-[13px] font-bold text-slate-300 tracking-widest uppercase">{badge || 'Spacetime Math'}</span>
       </div>
       <h1 className="text-[48px] lg:text-[56px] font-bold text-white leading-[1.05] tracking-tight mb-6" dangerouslySetInnerHTML={{ __html: title.replace('<sw>', '<span class="text-brand-yellow relative inline-block">').replace('</sw>', '<svg class="absolute w-full h-4 -bottom-1 left-0 text-brand-yellow/40 z-[-1]" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 15 100 5" stroke="currentColor" stroke-width="8" fill="transparent"/></svg></span>') }} />
       <p className="text-[20px] lg:text-[22px] text-slate-300 font-medium leading-relaxed max-w-xl">
         {desc}
       </p>
     </div>
   );
};

const MockAppWrapper = ({ children, activeTab, mTitle, mDesc, mBadge, lang, noNav = false }: { children: React.ReactNode, activeTab: string, mTitle: string, mDesc: string, mBadge?: string, lang: string, noNav?: boolean }) => {
  return (
    <div className="dark w-full h-[100dvh] bg-[#0A0F1C] text-slate-200 font-[var(--font)] flex flex-col md:flex-row relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[100%] md:w-[50%] h-[50%] bg-brand-yellow/5 md:bg-brand-yellow/5 rounded-full blur-[90px] md:blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[100%] md:w-[40%] h-[40%] bg-brand-blue/5 md:bg-brand-blue/10 rounded-full blur-[90px] md:blur-[120px] pointer-events-none"></div>

      {MarketingSidePanel({ title: mTitle, desc: mDesc, badge: mBadge, lang })}
      {MarketingSidePanelDesktop({ title: mTitle, desc: mDesc, badge: mBadge, lang })}

      <div className="flex-1 w-full md:w-1/2 flex items-stretch md:items-center justify-center relative z-10 md:py-16 md:pr-16 lg:pr-24">
        {/* Added distinct App boundaries for Mobile with border-slate-700/40 and drop shadow so it detaches from the marketing header */}
        <div className="w-full h-full md:w-full md:h-full mx-3 mt-4 md:mx-0 md:mt-0 flex-1 md:max-w-[440px] md:shadow-[0_20px_60px_rgba(0,0,0,0.5)] md:rounded-[40px] md:border-[8px] bg-[#0A0F1C] md:bg-[#0f172a] flex flex-col relative overflow-hidden md:max-h-[850px] lg:max-h-[920px] rounded-t-[44px] md:rounded-t-[40px] border-[5px] border-b-0 border-slate-800 shadow-[0_-20px_40px_rgba(0,0,0,0.4)] md:shadow-none">
          <div className="flex-1 overflow-y-auto pb-[90px] w-full" dir={lang.startsWith('ar') ? 'rtl' : 'ltr'}>
            {children}
          </div>
          {!noNav && <BottomNavMock active={activeTab} />}
        </div>
      </div>
    </div>
  );
};

// 1) Lobby
export function LobbyScreen({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const texts = getMarketingInfo(lang);
  return (
    <MockAppWrapper activeTab="lobby" mTitle={texts.s_title} mDesc={texts.s_desc} mBadge={texts.badge} lang={lang}>
      <div className="pt-12 px-4 max-w-lg mx-auto w-full flex flex-col items-center">
        <div className="flex flex-row items-center gap-3 mb-8 w-full">
          <div className="shrink-0"><LobbyIcon customBackground={<rect width="100" height="100" rx="18" className="fill-slate-700"/>} className="scale-[1.3]" /></div>
          <div className="flex flex-col">
            <h1 className="text-[26px] font-black text-white leading-[1.1] tracking-tight">{t('lobby.welcomeBack', 'Welcome back,')}</h1>
            <div className="relative inline-block w-max mt-0">
               <span className="text-[28px] font-black text-brand-yellow tracking-tight">Joanna</span>
               <span className="text-[28px] font-black text-white ml-0.5">! 👋</span>
               <div className="absolute -bottom-1 -left-1 -right-2 text-brand-yellow opacity-80"><Swosh /></div>
            </div>
          </div>
        </div>

        <div className="w-full bg-slate-800/80 rounded-[28px] p-6 mb-6 shadow-md border border-slate-700/50">
          <div className="flex items-center gap-3 mb-2">
             <div className="text-3xl">🏆</div>
             <div>
                <div className="text-[12px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">{t('tiers.tier16Name')} <span className="w-1 h-1 bg-slate-500 rounded-full"></span> {t('tiers.statusLevel', { tier: 17 })}</div>
                <div className="text-white font-bold text-[18px]">{t('lobby.focusNew', { kc: t('dkt.name9') })}</div>
             </div>
          </div>
          
          <button className="w-full bg-brand-yellow text-slate-900 text-[18px] font-black py-4 rounded-2xl mt-5 mb-4 shadow-[0_5px_15px_rgba(250,204,21,0.2)] flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
            <span className="text-xl">▶</span> {t('lobby.startSprint')}
          </button>
          
          <button className="w-full bg-[#1e293b] border border-slate-700/80 hover:bg-slate-700 text-white text-[16px] font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors">
            <TestLevelIcon className="scale-90" /> {t('tierPicker.testMyLevel')}
          </button>
        </div>

        <div className="w-full flex justify-between items-center bg-slate-800/50 hover:bg-slate-800 rounded-[24px] p-5 mb-4 border border-slate-700/40">
           <div className="flex items-center gap-4">
              <div className="bg-slate-900 p-2.5 rounded-2xl"><ProgressIcon className="scale-110" /></div>
              <div>
                 <div className="text-white font-bold text-[16px]">{t('nav.progress')}</div>
                 <div className="text-slate-400 text-sm mt-0.5">{texts.mockups?.matrix_desc || t('lobby.progressProfileDesc')}</div>
              </div>
           </div>
        </div>

        <div className="w-full flex justify-between items-center bg-slate-800/50 hover:bg-slate-800 rounded-[24px] p-5 mb-4 border border-slate-700/40">
           <div className="flex items-center gap-4">
              <div className="bg-slate-900 p-2.5 rounded-2xl"><FriendsIcon className="scale-110" /></div>
              <div>
                 <div className="text-white font-bold text-[16px]">{t('lobby.friendsTitle')}</div>
                 <div className="text-slate-400 text-sm mt-0.5">{t('lobby.friendsDesc')}</div>
              </div>
           </div>
        </div>

      </div>
    </MockAppWrapper>
  );
}

// 2) Sprint
export function SprintScreen({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const texts = getMarketingInfo(lang);
  return (
    <MockAppWrapper activeTab="lobby" mTitle={texts.sprint_title} mDesc={texts.sprint_desc} lang={lang} noNav>
      <div className="dark w-full h-full flex-1 bg-[#0A0F1C] text-white font-[var(--font)] flex flex-col relative overflow-hidden">
        <div className="flex justify-between items-center px-4 py-6 border-b border-white/5">
           <div className="flex items-center gap-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              <div>
                 <div className="font-bold text-[16px] leading-tight flex items-center">1UP</div>
                 <div className="text-slate-400 text-[12px] flex items-center">✓ 14/15 <span className="mx-1">·</span> 18.2 {texts.mockups?.sprint_score || 'pts'}</div>
              </div>
           </div>
           <div className="w-12 h-12 rounded-full border-[3px] border-brand-yellow flex items-center justify-center font-bold text-[18px]">
              54
           </div>
        </div>
        <div className="flex-1 flex flex-col px-6 pt-8 pb-10">
           <div className="flex justify-between items-start w-full mb-12">
              <div>
                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">{t('history.streak')}</div>
                 <div className="grid grid-cols-2 gap-1 opacity-80">
                    <div className="flex gap-1">
                       <div className="w-1.5 h-1.5 bg-brand-yellow rounded-sm" />
                       <div className="w-1.5 h-1.5 bg-brand-yellow rounded-sm" />
                       <div className="w-1.5 h-1.5 bg-brand-yellow rounded-sm" />
                       <div className="w-1.5 h-1.5 bg-brand-yellow rounded-sm" />
                       <div className="w-1.5 h-1.5 bg-brand-yellow rounded-sm" />
                    </div>
                    <div className="flex gap-1" />
                 </div>
              </div>
              <div className="flex items-center gap-1.5 bg-brand-red/10 border border-brand-red/20 px-2 py-1 rounded text-brand-red font-medium text-[13px]">
                 {t('sprint.tagHard')}
              </div>
           </div>
           <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-slate-400 text-[12px] font-black uppercase tracking-[0.2em] mb-4">{texts.mockups?.sprint_was_ist || t('sprint.whatIs', 'WHAT IS')}</div>
              <div className="text-white text-[100px] font-black leading-none mb-12 flex gap-4">
                 <span>7</span><span className="opacity-90">×</span><span>8</span>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full" dir="ltr">
                 {['56', '66', '63', '46'].map((num, i) => (
                   <button key={num} className={`rounded-[28px] border-b-4 aspect-[4/3] flex items-center justify-center text-[44px] font-black shadow-sm transition-all ${i === 0 ? 'bg-brand-yellow border-[#dca80f] text-slate-900 scale-105' : 'bg-slate-800/80 border-[#1e293b] text-white hover:bg-slate-700'}`}>{num}</button>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </MockAppWrapper>
  );
}

// 3) Progress
export function ProgressScreen({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const texts = getMarketingInfo(lang);
  return (
    <MockAppWrapper activeTab="progress" mTitle={texts.prog_title} mDesc={texts.prog_desc} lang={lang}>
      <div className="pt-12 px-4 max-w-lg mx-auto w-full flex flex-col items-center">
        <div className="flex flex-row items-center gap-3 mb-8 w-full">
          <div className="shrink-0"><ProgressIcon className="scale-[1.3] drop-shadow-md" /></div>
          <div className="relative inline-block w-max">
             <h1 className="text-[34px] font-black text-white leading-tight tracking-tight">{t('nav.progress')}</h1>
             <div className="absolute -bottom-2 -left-1 -right-2 text-brand-yellow opacity-80"><Swosh /></div>
          </div>
        </div>

        <div className="w-full bg-slate-800/80 rounded-[28px] p-6 mb-6 shadow-md border border-slate-700/50">
          <div className="flex justify-between items-start mb-4">
             <div className="text-4xl drop-shadow-[0_2px_10px_rgba(250,204,21,0.6)]">🏆</div>
             <button className="text-slate-400 p-1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>
          </div>
          
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[28px] font-black text-brand-yellow">{t('tiers.tier16Name')}</span>
            <span className="bg-slate-900 border border-slate-700 text-slate-300 font-bold uppercase tracking-widest text-[12px] px-3 py-1.5 rounded-full">{t('tiers.statusLevel', { tier: 17 })}</span>
          </div>

          <div className="w-full bg-[#311f26]/80 border border-brand-red/30 rounded-2xl p-5 mb-4 relative overflow-hidden">
             <div className="text-[11px] font-black text-brand-red uppercase tracking-widest mb-2 relative z-10">{t('dkt.weakest')}</div>
             <div className="text-white font-bold max-w-[85%] relative z-10 leading-snug">{t('dkt.insight.untouched', { kc: t('dkt.name9') })}</div>
          </div>

          <div className="w-full bg-[#1b2b2b]/80 border border-brand-green/30 rounded-2xl p-5 mb-6 relative overflow-hidden">
             <div className="text-[11px] font-black text-brand-green uppercase tracking-widest mb-2 relative z-10">{t('dkt.strongest')}</div>
             <div className="text-white font-bold relative z-10 leading-snug">{t('dkt.insight.fluent', { kc: t('dkt.name8') })}</div>
          </div>

          <button className="w-full bg-brand-yellow text-slate-900 text-[18px] font-black py-4 rounded-2xl shadow-[0_5px_15px_rgba(250,204,21,0.2)] flex items-center justify-center gap-2 mb-3">
            <span className="text-xl">▶</span> {t('lobby.startSprint')}
          </button>
        </div>

        <div className="w-full bg-slate-800/80 rounded-[28px] p-6 shadow-md border border-slate-700/50">
           <h2 className="text-[22px] font-black text-white mb-2">{t('lobby.masteryTitle')}</h2>
           <p className="text-slate-400 text-sm leading-relaxed">{texts.mockups?.matrix_desc || t('lobby.masteryDesc')}</p>
        </div>
      </div>
    </MockAppWrapper>
  );
}

// 4) Friends
export function FriendsScreen({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const texts = getMarketingInfo(lang);
  return (
    <MockAppWrapper activeTab="friends" mTitle={texts.friend_title} mDesc={texts.friend_desc} lang={lang}>
      <div className="pt-12 px-4 max-w-lg mx-auto w-full">
        <div className="flex flex-row items-center gap-3 mb-8 w-full pl-2">
          <div className="shrink-0"><FriendsIcon className="scale-[1.3] drop-shadow-md" /></div>
          <div className="relative inline-block w-max">
            <h1 className="text-[34px] font-black text-white leading-tight tracking-tight">{t('nav.friends')}</h1>
            <div className="absolute -bottom-2 -left-1 -right-2 text-brand-yellow opacity-80"><Swosh /></div>
          </div>
        </div>

        <div className="bg-slate-800/80 rounded-[28px] border border-slate-700/50 shadow-md mb-6 relative overflow-hidden">
           <div className="h-2 w-full bg-brand-yellow"></div>
           <div className="p-8 pb-10 flex flex-col items-center">
              <h2 className="text-[24px] font-black text-white mb-4 text-center">{t('friends.levelUp')}</h2>
              <p className="text-slate-300 text-[15px] leading-relaxed text-center mb-8 px-2">
                 {t('friends.levelUpDesc')}
              </p>
              <div className="text-slate-500 font-black text-[11px] uppercase tracking-widest text-center">— {t('friends.empty').toUpperCase()} —</div>
           </div>
        </div>

        <button className="w-full bg-[#1e293b] border border-slate-700 text-white text-[16px] font-bold py-5 rounded-[24px] flex items-center justify-center gap-3 mb-4 shadow hover:bg-slate-700/80 transition-colors">
          <LobbyIcon customBackground={<rect width="100" height="100" rx="18" className="fill-slate-700" />} className="scale-[1.1]" /> {t('friends.haveCode')}
        </button>
        <button className="w-full bg-[#1e293b] border border-slate-700 text-white text-[16px] font-bold py-5 rounded-[24px] flex items-center justify-center gap-3 shadow hover:bg-slate-700/80 transition-colors">
          <LobbyIcon customBackground={<rect width="100" height="100" rx="18" className="fill-slate-700" />} className="scale-[1.1]" /> {t('friends.createInvite')}
        </button>
      </div>
    </MockAppWrapper>
  );
}

// 5) Classrooms
export function ClassroomsScreen({ lang }: { lang: string }) {
  const { t } = useTranslation();
  const texts = getMarketingInfo(lang);
  return (
    <MockAppWrapper activeTab="classrooms" mTitle={texts.class_title} mDesc={texts.class_desc} lang={lang}>
      <div className="pt-12 px-4 max-w-lg mx-auto w-full">
        <div className="flex flex-row items-center gap-3 mb-8 w-full pl-2">
          <div className="shrink-0"><ClassesIcon className="scale-[1.3]" /></div>
          <div className="relative inline-block w-max">
            <h1 className="text-[34px] font-black text-white leading-[1.1] tracking-tight">{t('nav.classes')}</h1>
            <div className="absolute -bottom-2 -left-1 -right-2 text-brand-yellow opacity-80"><Swosh /></div>
          </div>
        </div>

        <div className="bg-slate-800/80 rounded-[28px] border border-slate-700/50 shadow-md mb-6 relative overflow-hidden">
          <div className="w-full h-2 bg-gradient-to-r from-brand-yellow/80 to-brand-yellow"></div>
          <div className="p-8 pb-10 flex flex-col items-center text-center">
            <h2 className="text-[24px] font-black text-white mb-4">{t('classes.emptyHeading')}</h2>
            <p className="text-slate-300 text-[15px] leading-relaxed mx-auto mb-8 font-medium">
              {t('classes.emptyDesc')}
            </p>
            <div className="text-slate-500 font-bold text-[11px] uppercase tracking-widest">— {t('classes.empty').toUpperCase()} —</div>
          </div>
        </div>
        
        <button className="w-full bg-[#1e293b] border border-slate-700 text-white text-[16px] font-bold py-5 rounded-[24px] flex items-center justify-center gap-3 mb-10 shadow hover:bg-slate-700/80 transition-colors">
          <LobbyIcon customBackground={<rect width="100" height="100" rx="18" className="fill-[#334155]" />} className="scale-[1.1]" /> <span className="font-mono mt-0.5 ml-1">→</span> {t('classes.joinButton')}
        </button>

        <div className="flex flex-col items-center justify-center mb-8 gap-1 opacity-80">
           <div className="text-slate-400 font-medium text-[15px]">{t('classes.areYouTeacher')}</div>
           <div className="text-brand-yellow font-bold text-[15px] pb-0.5 cursor-pointer underline underline-offset-4 decoration-brand-yellow/40">{t('classes.upgradePrompt')}</div>
        </div>
      </div>
    </MockAppWrapper>
  );
}

export const SCREENS_MAP: Record<string, any> = {
  LobbyScreen,
  SprintScreen,
  ProgressScreen,
  FriendsScreen,
  ClassroomsScreen
};

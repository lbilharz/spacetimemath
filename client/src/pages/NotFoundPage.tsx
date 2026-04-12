import { useTranslation } from 'react-i18next';
import PageContainer from '../components/PageContainer.js';
import SplashGrid from '../components/SplashGrid.js';
import type { Page } from '../navigation.js';

interface Props {
  navigate: (page: Page) => void;
}

export default function NotFoundPage({ navigate }: Props) {
  const { t } = useTranslation();

  return (
    <PageContainer className="flex flex-col items-center justify-center min-h-[70vh] pb-[100px] text-center">
      
      {/* Friendly, playful grid bouncing */}
      <div className="relative mb-14 mt-12 animate-in zoom-in slide-in-from-bottom-10 duration-700 ease-out hover:-translate-y-2 hover:rotate-3 transition-transform cursor-pointer drop-shadow-xl scale-[1.6]">
        <SplashGrid brokenMode={true} />
      </div>

      <h1 className="text-[100px] font-black text-slate-900 dark:text-white leading-none tracking-tighter drop-shadow-sm mb-4 select-none">
        404
      </h1>

      <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 z-10 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75 px-4">
        {t('app.404Title', { defaultValue: 'Huch! Wo sind wir denn hier?' })}
      </h2>
      
      <p className="text-slate-500 font-medium max-w-[320px] mx-auto mt-4 z-10 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 leading-relaxed px-4">
        {t('app.404Desc', { defaultValue: 'Diese Seite ist scheinbar im Spacetime-Nirwana verschwunden. Lass uns schnell umdrehen!' })}
      </p>

      <button
        onClick={() => {
           window.history.pushState(null, '', '/');
           navigate('lobby');
        }}
        className="group mt-12 flex items-center justify-center gap-3 rounded-[20px] bg-brand-yellow px-8 py-4 text-[16px] font-black tracking-wide text-slate-900 shadow-sm hover:bg-brand-yellow-hover hover:shadow-[0_8px_30px_rgba(250,204,21,0.4)] transition-all hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] z-10 animate-in fade-in zoom-in-95 duration-500 delay-300"
      >
        <span className="text-xl rotate-180 block transition-transform group-hover:-translate-x-1 font-mono">➔</span>
        {t('common.backToLobby', { defaultValue: 'Zurück zur Lobby' })}
      </button>

    </PageContainer>
  );
}

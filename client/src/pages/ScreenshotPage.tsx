import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SCREENS, LOCALES } from '../screenshots/config';
import { SCREENS_MAP } from '../screenshots/screens';

export default function ScreenshotPage() {
  const { i18n } = useTranslation();
  const [ready, setReady] = useState(false);
  
  // Parse URL params
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const screenId = parseInt(params.get('screen') || '1', 10);
  const lang = params.get('lang') || 'en';
  
  const screenConfig = SCREENS.find(s => s.id === screenId);
  const Component = screenConfig ? SCREENS_MAP[screenConfig.component] : null;

  const localeConfig = LOCALES.find(l => l.lang === lang) || { lang: 'en', dir: 'ltr' };
  const isRtl = localeConfig.dir === 'rtl';

  useEffect(() => {
    let timeoutId: any;
    
    // Change i18next language
    i18n.changeLanguage(lang).then(() => {
      // 300ms delay to ensure all assets and fonts settle
      timeoutId = setTimeout(() => {
        setReady(true);
        if (!document.querySelector('.screenshot-ready')) {
          const readyDiv = document.createElement('div');
          readyDiv.className = 'screenshot-ready';
          document.body.appendChild(readyDiv);
          document.body.classList.add('screenshot-ready');
        }
      }, 300);
    });

    return () => clearTimeout(timeoutId);
  }, [lang, i18n]);

  if (!Component) return <div className="p-10 font-sans text-white">Screen not found</div>;
  if (!ready) return <div className="p-10 font-sans text-white">Loading i18n data...</div>;

  return (
    <div 
      dir={isRtl ? 'rtl' : 'ltr'} 
      className="w-full h-screen overflow-hidden m-0 p-0"
      style={{
        // Brand tokens
        '--color-green': '#5DD23C',
        '--color-yellow': '#facc15',
        '--color-blue': '#4FA7FF',
        '--color-red': '#E8391D',
        '--color-gray': '#E9E9E9',
        '--color-dark': '#1c1c1e',
        '--color-darkest': '#0a0a0f',
        '--font': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      } as React.CSSProperties}
    >
      <Component lang={lang} dir={isRtl ? 'rtl' : 'ltr'} />
    </div>
  );
}

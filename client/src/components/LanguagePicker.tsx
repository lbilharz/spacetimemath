import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const GlobeIcon = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    <path d="M2 12h20"/>
  </svg>
);

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

export default function LanguagePicker() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find(l => l.code === i18n.language.split('-')[0]) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative z-[100]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 font-bold text-slate-700 shadow-sm backdrop-blur-md transition-all hover:border-brand-yellow hover:bg-white active:scale-95 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-brand-yellow dark:hover:bg-slate-900 uppercase tracking-wider text-sm"
      >
        <GlobeIcon size={16} className="opacity-80" />
        <span>{currentLang.code.substring(0, 2)}</span>
      </button>

      {isOpen && (
        <div className="absolute end-0 mt-3 w-48 transform overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
            {LANGUAGES.map((lang, idx) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                style={{ animationDelay: `${idx * 20}ms` }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-bold transition-all animate-in slide-in-from-top-2 fill-mode-both hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  i18n.language.startsWith(lang.code)
                    ? 'bg-brand-yellow/10 text-brand-yellow dark:bg-brand-yellow/20'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <span className="text-xl leading-none">{lang.flag}</span>
                <span className="text-sm tracking-wide">{lang.label}</span>
                {i18n.language.startsWith(lang.code) && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-yellow" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

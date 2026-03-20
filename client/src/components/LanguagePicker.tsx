import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'ar', label: 'العربية', flag: '🇸🇾' },
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
        className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 font-bold text-slate-700 shadow-sm backdrop-blur-md transition-all hover:border-brand-yellow hover:bg-white active:scale-95 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-brand-yellow dark:hover:bg-slate-900"
      >
        <span className="text-xl">{currentLang.flag}</span>
        <span className="hidden sm:inline">{currentLang.label}</span>
      </button>

      {isOpen && (
        <div className="absolute end-0 mt-3 w-56 transform overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-1">
            {LANGUAGES.map((lang, idx) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                style={{ animationDelay: `${idx * 40}ms` }}
                className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left font-bold transition-all animate-in slide-in-from-top-2 fill-mode-both hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  i18n.language.startsWith(lang.code)
                    ? 'bg-brand-yellow/10 text-brand-yellow dark:bg-brand-yellow/20'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <div className="flex flex-col text-sm">
                  <span>{lang.label}</span>
                </div>
                {i18n.language.startsWith(lang.code) && (
                  <div className="ml-auto h-2 w-2 rounded-full bg-brand-yellow" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

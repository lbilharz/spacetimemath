import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onDone: () => void;
}

export default function MigrationOverlay({ onDone }: Props) {
  const { t } = useTranslation();
  const [finishing, setFinishing] = useState(false);

  const handleDone = () => {
    setFinishing(true);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative flex w-full max-w-sm max-h-[90vh] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 pt-10 pb-6">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="text-7xl leading-none drop-shadow-sm animate-bounce duration-[2000ms]">🚀</div>
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                {t('migration.title')}
              </h2>
              <p className="text-[15px] font-medium leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                {t('migration.body')}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/50">
          <button
            onClick={handleDone}
            disabled={finishing}
            className="group relative flex h-12 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl px-4 transition-all active:scale-[0.98] disabled:opacity-50 bg-brand-yellow text-slate-900 shadow-md"
          >
            <span className="text-[13px] font-black uppercase tracking-wider">
              {t('onboarding.okay')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

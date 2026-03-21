import React from 'react';
import { useTranslation } from 'react-i18next';
import { TargetIcon, LightningIcon } from '../Icons.js';

interface Props {
  onClose: () => void;
  onSelectType: (isDiagnostic: boolean) => void;
}

export default function ClassroomStartSprintModal({ onClose, onSelectType }: Props) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[32px] bg-white p-6 sm:p-8 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
        <h3 className="mb-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{t('classSprint.modalTitle')}</h3>
        <p className="mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
          {t('classSprint.modalDesc')}
        </p>
        
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => onSelectType(true)}
            className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 transition-transform group-hover:scale-110">
                <TargetIcon className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{t('classSprint.diagnosticTitle')}</span>
            </div>
            <span className="text-sm text-slate-500 leading-snug">
              {t('classSprint.diagnosticDesc')}
            </span>
          </button>

          <button 
            onClick={() => onSelectType(false)}
            className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-brand-yellow/50 bg-amber-50 dark:bg-amber-500/10 p-5 text-left transition-all hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:border-brand-yellow shadow-sm active:scale-[0.98]"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow text-slate-900 shadow-sm transition-transform group-hover:scale-110">
                  <LightningIcon className="w-5 h-5" />
                </div>
                <span className="text-lg font-black text-amber-900 dark:text-brand-yellow">{t('classSprint.trainingTitle')}</span>
              </div>
            </div>
            <span className="text-sm font-medium text-amber-800/80 dark:text-amber-200/60 leading-snug">
              {t('classSprint.trainingDesc')}
            </span>
          </button>
        </div>

        <button 
          onClick={onClose}
          className="mt-8 w-full rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300 active:scale-95 transition-transform"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

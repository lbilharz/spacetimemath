import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducer as useSTDBReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings/index.js';
import TierLadder from './TierLadder.js';

const INFO_CARDS = [
  { emoji: '⏱️', titleKey: 'onboarding.card1Title', bodyKey: 'onboarding.card1Body' },
  { emoji: '🎯', titleKey: 'onboarding.card2Title', bodyKey: 'onboarding.card2Body' },
  { emoji: '⚡', titleKey: 'onboarding.card3Title', bodyKey: 'onboarding.card3Body' },
] as const;

const TOTAL_STEPS = INFO_CARDS.length + 1; // 3 info + 1 tier picker

interface Props {
  onDone: () => void;
  /** Called when the overlay closes without starting a sprint (the "Okay" path). */
  onClose?: () => void;
  /** When true (e.g. joining via classroom link), hide "Start Sprint" and
   *  promote "Okay" as the sole primary CTA on the last card. */
  noSprint?: boolean;
}

export default function OnboardingOverlay({ onDone, onClose, noSprint = false }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [selectedTier, setSelectedTier] = useState(0);
  const completeOnboarding = useSTDBReducer(reducers.completeOnboarding);
  const setLearningTier    = useSTDBReducer(reducers.setLearningTier);

  const isTierStep = step === TOTAL_STEPS - 1;
  const isLast     = isTierStep; // tier step is always last
  const card       = !isTierStep ? INFO_CARDS[step] : null;

  const handleDone = async () => {
    if (finishing) return;
    setFinishing(true);
    if (selectedTier > 0) await setLearningTier({ tier: selectedTier });
    await completeOnboarding();
    onDone();
  };

  // "Okay" — mark onboarding complete but stay in the lobby (no sprint started).
  // The overlay auto-disappears once onboardingDone flips to true in the subscription.
  const handleOkay = async () => {
    if (finishing) return;
    setFinishing(true);
    if (selectedTier > 0) await setLearningTier({ tier: selectedTier });
    await completeOnboarding();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative flex w-full max-w-md max-h-[90vh] flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 pt-10 pb-6">
          <div className="flex flex-col items-center gap-6 text-center">
            {isTierStep ? (
              /* Tier picker card */
              <>
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                    {t('tierPicker.cardTitle')}
                  </h2>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {t('tierPicker.cardBody')}
                  </p>
                </div>
                <div className="w-full">
                  <TierLadder
                    currentTier={0}
                    selectedTier={selectedTier}
                    onSelect={setSelectedTier}
                  />
                </div>
              </>
            ) : (
              /* Info cards */
              <>
                <div className="text-7xl leading-none drop-shadow-sm animate-bounce duration-[2000ms]">{card!.emoji}</div>
                <div className="flex flex-col gap-3">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                    {t(card!.titleKey)}
                  </h2>
                  <p className="text-[17px] font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                    {t(card!.bodyKey)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer with Controls */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex flex-col gap-3">
            
            {/* Step dots */}
            <div className="flex justify-center gap-1.5">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? 'w-5 bg-brand-yellow' : 'w-1 bg-slate-200 dark:bg-slate-700'}`} />
              ))}
            </div>

            {/* Primary Actions */}
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="group flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <span className="transition-transform ltr:group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 rtl:rotate-180">←</span>
                  {t('onboarding.back')}
                </button>
              )}
              
              <button
                onClick={isLast ? (noSprint ? handleOkay : handleDone) : () => setStep(s => s + 1)}
                disabled={finishing}
                className={`group relative flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl px-4 transition-all active:scale-[0.98] disabled:opacity-50 ${
                  isLast
                    ? 'bg-brand-yellow text-slate-900 shadow-md'
                    : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                }`}
              >
                <span className="text-[13px] font-black uppercase tracking-wider">
                  {isLast ? (noSprint ? t('onboarding.okay') : t('onboarding.startSprint')) : t('onboarding.next')}
                </span>
                <span className="text-base transition-transform ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180">→</span>
              </button>
            </div>

            {/* Optional Skip/Okay Link */}
            {isLast && !noSprint && (
              <button
                onClick={handleOkay}
                disabled={finishing}
                className="text-center text-[11px] font-bold text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200 underline underline-offset-4"
              >
                {t('onboarding.okay')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="modal-backdrop">
      <div className="modal-card">

        {isTierStep ? (
          /* Tier picker card */
          <>
            <div className="fw-extrabold text-18 leading-tight text-center">
              {t('tierPicker.cardTitle')}
            </div>
            <div className="text-muted text-sm text-center">
              {t('tierPicker.cardBody')}
            </div>
            <div style={{ width: '100%', maxHeight: 320, overflowY: 'auto' }}>
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
            <div className="lh-1" style={{ fontSize: 56 }}>{card!.emoji}</div>
            <div className="fw-extrabold text-20 leading-tight">
              {t(card!.titleKey)}
            </div>
            <div className="text-muted text-15">
              {t(card!.bodyKey)}
            </div>
          </>
        )}

        {/* Step dots */}
        <div className="row gap-8 mt-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8,
              borderRadius: '50%',
              background: i === step ? 'var(--accent)' : 'var(--border)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        {/* Buttons */}
        <div className="col gap-8 w-full mt-1">
          <div className="row gap-10 w-full">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  flex: 1, padding: '10px 0',
                  background: 'var(--card2)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--muted)', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('onboarding.back')}
              </button>
            )}
            {isLast && noSprint ? (
              <button onClick={handleOkay} disabled={finishing}
                style={{
                  flex: 2, padding: '16px 0', background: 'var(--accent)',
                  border: 'none', borderRadius: 10, color: '#2C3E50',
                  fontSize: 18, fontWeight: 900,
                  cursor: finishing ? 'default' : 'pointer', opacity: finishing ? 0.7 : 1,
                  boxShadow: '0 4px 20px rgba(251,186,0,0.4)', letterSpacing: '-0.3px',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {t('onboarding.okay')}
              </button>
            ) : (
              <button
                onClick={isLast ? handleDone : () => setStep(s => s + 1)}
                disabled={finishing}
                style={{
                  flex: 2, padding: isLast ? '16px 0' : '11px 0',
                  background: 'var(--accent)', border: 'none', borderRadius: 10,
                  color: '#2C3E50', fontSize: isLast ? 18 : 15, fontWeight: 900,
                  cursor: finishing ? 'default' : 'pointer', opacity: finishing ? 0.7 : 1,
                  boxShadow: isLast ? '0 4px 20px rgba(251,186,0,0.4)' : 'none',
                  letterSpacing: isLast ? '-0.3px' : 'normal',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {isLast ? t('onboarding.startSprint') : t('onboarding.next')}
              </button>
            )}
          </div>

          {isLast && !noSprint && (
            <button onClick={handleOkay} disabled={finishing} className="w-full"
              style={{
                padding: '10px 0', background: 'var(--card2)',
                border: '1px solid var(--border)', borderRadius: 8,
                color: 'var(--muted)', fontSize: 14, fontWeight: 600,
                cursor: finishing ? 'default' : 'pointer', opacity: finishing ? 0.7 : 1,
                WebkitTapHighlightColor: 'transparent',
              }}>
              {t('onboarding.okay')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducer as useSTDBReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings/index.js';

const CARDS = [
  { emoji: '⏱️', titleKey: 'onboarding.card1Title', bodyKey: 'onboarding.card1Body' },
  { emoji: '🎯', titleKey: 'onboarding.card2Title', bodyKey: 'onboarding.card2Body' },
  { emoji: '⚡', titleKey: 'onboarding.card3Title', bodyKey: 'onboarding.card3Body' },
] as const;

interface Props {
  onDone: () => void;
  /** When true (e.g. joining via classroom link), hide "Start Sprint" and
   *  promote "Okay" as the sole primary CTA on the last card. */
  noSprint?: boolean;
}

export default function OnboardingOverlay({ onDone, noSprint = false }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const completeOnboarding = useSTDBReducer(reducers.completeOnboarding);

  const isLast = step === CARDS.length - 1;
  const card = CARDS[step];

  const handleDone = async () => {
    if (finishing) return;
    setFinishing(true);
    await completeOnboarding();
    onDone();
  };

  // "Okay" — mark onboarding complete but stay in the lobby (no sprint started).
  // The overlay auto-disappears once onboardingDone flips to true in the subscription.
  const handleOkay = async () => {
    if (finishing) return;
    setFinishing(true);
    await completeOnboarding();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        maxWidth: 380,
        width: '100%',
        padding: '40px 32px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        textAlign: 'center',
      }}>
        {/* Emoji */}
        <div style={{ fontSize: 56, lineHeight: 1 }}>{card.emoji}</div>

        {/* Title */}
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
          {t(card.titleKey)}
        </div>

        {/* Body */}
        <div style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
          {t(card.bodyKey)}
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {CARDS.map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8,
              borderRadius: '50%',
              background: i === step ? 'var(--accent)' : 'var(--border)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 4 }}>
          {/* Main row: Back (if applicable) + Next / primary CTA */}
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: 'var(--card2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--muted)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('onboarding.back')}
              </button>
            )}
            {/* On the last card: "Start Sprint" normally, "Okay" (styled primary) when noSprint */}
            {isLast && noSprint ? (
              <button
                onClick={handleOkay}
                disabled={finishing}
                style={{
                  flex: 2,
                  padding: '16px 0',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 10,
                  color: '#2C3E50',
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: finishing ? 'default' : 'pointer',
                  opacity: finishing ? 0.7 : 1,
                  boxShadow: '0 4px 20px rgba(251,186,0,0.4)',
                  letterSpacing: '-0.3px',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {t('onboarding.okay')}
              </button>
            ) : (
              <button
                onClick={isLast ? handleDone : () => setStep(s => s + 1)}
                disabled={finishing}
                style={{
                  flex: 2,
                  padding: isLast ? '16px 0' : '11px 0',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 10,
                  color: '#2C3E50',
                  fontSize: isLast ? 18 : 15,
                  fontWeight: 900,
                  cursor: finishing ? 'default' : 'pointer',
                  opacity: finishing ? 0.7 : 1,
                  boxShadow: isLast ? '0 4px 20px rgba(251,186,0,0.4)' : 'none',
                  letterSpacing: isLast ? '-0.3px' : 'normal',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {isLast ? t('onboarding.startSprint') : t('onboarding.next')}
              </button>
            )}
          </div>

          {/* Secondary "Okay" — only on the last card, only when Start Sprint is shown */}
          {isLast && !noSprint && (
            <button
              onClick={handleOkay}
              disabled={finishing}
              style={{
                width: '100%',
                padding: '10px 0',
                background: 'var(--card2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--muted)',
                fontSize: 14,
                fontWeight: 600,
                cursor: finishing ? 'default' : 'pointer',
                opacity: finishing ? 0.7 : 1,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {t('onboarding.okay')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

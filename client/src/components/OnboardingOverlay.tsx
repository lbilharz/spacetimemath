import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducer as useSTDBReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings/index.js';

const CARDS = [
  { emoji: '⏱️', titleKey: 'onboarding.card1Title', bodyKey: 'onboarding.card1Body' },
  { emoji: '🎯', titleKey: 'onboarding.card2Title', bodyKey: 'onboarding.card2Body' },
  { emoji: '🏆', titleKey: 'onboarding.card3Title', bodyKey: 'onboarding.card3Body' },
] as const;

export default function OnboardingOverlay() {
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
    // Overlay disappears reactively when myPlayer.onboardingDone flips to true
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
        <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 4 }}>
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
          <button
            onClick={isLast ? handleDone : () => setStep(s => s + 1)}
            disabled={finishing}
            style={{
              flex: 2,
              padding: '11px 0',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: finishing ? 'default' : 'pointer',
              opacity: finishing ? 0.7 : 1,
            }}
          >
            {isLast ? t('onboarding.letsGo') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

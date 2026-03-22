import React from 'react';

interface Props {
  options: number[];
  onAnswer: (ans: number) => void;
  disabled: boolean;
  penaltyActive?: boolean;
}

export default function TapLayout({ options, onAnswer, disabled, penaltyActive }: Props) {
  return (
    <div 
      className={`w-full max-w-[360px] grid grid-cols-2 gap-4 ${penaltyActive ? 'animate-shake' : ''}`}
      style={{
        opacity: disabled && !penaltyActive ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {options.map((opt, i) => (
        <button
          key={i}
          disabled={disabled}
          onClick={() => onAnswer(opt)}
          className="pressable bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
          style={{
            padding: '24px 12px',
            fontSize: 32,
            fontWeight: 800,
            borderRadius: 16,
            border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            WebkitTapHighlightColor: 'transparent',
            boxShadow: '0 4px 0 rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

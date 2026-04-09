import React from 'react';

// === Core System Icons ===

export const PlayIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const StopIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const Swosh = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 10" preserveAspectRatio="none">
    <path d="M0 5 Q 50 15 100 5" stroke="currentColor" strokeWidth="8" fill="transparent" />
  </svg>
);

export const BackIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="58" y="16" width="20" height="20" rx="6" fill="var(--icon-blue)" />
    <rect x="42" y="40" width="20" height="20" rx="6" fill="var(--icon-yellow)" />
    <rect x="26" y="64" width="20" height="20" rx="6" fill="var(--icon-red)" />
    <rect x="42" y="64" width="36" height="20" rx="6" fill="var(--icon-red)" opacity="0.5" />
  </svg>
);

export const TargetIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="16" y="16" width="20" height="20" rx="6" fill="var(--icon-blue)" />
    <rect x="64" y="16" width="20" height="20" rx="6" fill="var(--icon-blue)" />
    <rect x="16" y="64" width="20" height="20" rx="6" fill="var(--icon-blue)" />
    <rect x="64" y="64" width="20" height="20" rx="6" fill="var(--icon-blue)" />
    <rect x="40" y="40" width="20" height="20" rx="6" fill="var(--icon-red)" />
  </svg>
);

export const LightningIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="16" y="58" width="20" height="26" rx="6" fill="var(--icon-blue)" />
    <rect x="40" y="38" width="20" height="46" rx="6" fill="var(--icon-yellow)" />
    <rect x="64" y="18" width="20" height="66" rx="6" fill="var(--icon-green)" />
  </svg>
);

export const KeyIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <circle cx="35" cy="50" r="18" fill="none" stroke="currentColor" strokeWidth="12" />
    <rect x="52" y="44" width="40" height="12" rx="4" fill="currentColor" />
    <rect x="75" y="56" width="12" height="16" rx="4" fill="currentColor" />
  </svg>
);

// === Navigation & Component Icons ===

export const LobbyIcon = ({ className, customBackground }: { className?: string, customBackground?: React.ReactNode }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    {customBackground || <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />}
    <rect x="6"  y="6"  width="26" height="26" rx="6" fill="var(--icon-green)"/>
    <rect x="37" y="6"  width="26" height="26" rx="6" fill="var(--icon-green)"/>
    <rect x="68" y="6"  width="26" height="26" rx="6" fill="var(--icon-yellow)"/>
    <rect x="6"  y="37" width="26" height="26" rx="6" fill="var(--icon-green)"/>
    <rect x="37" y="37" width="26" height="26" rx="6" fill="var(--icon-yellow)"/>
    <rect x="68" y="37" width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="6"  y="68" width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="37" y="68" width="26" height="26" rx="6" fill="var(--icon-red)"/>
    <rect x="68" y="68" width="26" height="26" rx="6" fill="currentColor" opacity="0.2"/>
  </svg>
);

export const ClassesIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="6"  y="6"  width="57" height="57" rx="9" fill="var(--icon-blue)" />
    <rect x="68" y="6"  width="26" height="26" rx="6" fill="var(--icon-green)" />
    <rect x="68" y="37" width="26" height="26" rx="6" fill="var(--icon-yellow)" />
    <rect x="68" y="68" width="26" height="26" rx="6" fill="var(--icon-red)" />
    <rect x="37" y="68" width="26" height="26" rx="6" fill="var(--icon-blue)" opacity="0.6" />
    <rect x="6"  y="68" width="26" height="26" rx="6" fill="var(--icon-yellow)" opacity="0.6" />
  </svg>
);

export const ProgressIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="6"  y="68" width="26" height="26" rx="6" fill="var(--icon-red)" />
    <rect x="37" y="37" width="26" height="57" rx="6" fill="var(--icon-yellow)" />
    <rect x="68" y="6"  width="26" height="88" rx="6" fill="var(--icon-green)" />
  </svg>
);

export const AccountIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="6" y="14" width="88" height="10" rx="5" fill="currentColor" opacity="0.25" />
    <rect x="58" y="6" width="26" height="26" rx="8" fill="var(--icon-blue)" />
    <rect x="6" y="45" width="88" height="10" rx="5" fill="currentColor" opacity="0.25" />
    <rect x="26" y="37" width="26" height="26" rx="8" fill="var(--icon-green)" />
    <rect x="6" y="76" width="88" height="10" rx="5" fill="currentColor" opacity="0.25" />
    <rect x="42" y="68" width="26" height="26" rx="8" fill="var(--icon-red)" />
  </svg>
);

// Backward compat
export const SettingsIcon = AccountIcon;

// === Supplemental Icons ===

export const AddIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="37" y="37" width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="37" y="6"  width="26" height="26" rx="6" fill="var(--icon-red)"/>
    <rect x="37" y="68" width="26" height="26" rx="6" fill="var(--icon-green)"/>
    <rect x="6"  y="37" width="26" height="26" rx="6" fill="var(--icon-yellow)"/>
    <rect x="68" y="37" width="26" height="26" rx="6" fill="var(--icon-yellow)"/>
  </svg>
);

export const JoinIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="68" y="6"  width="26" height="88" rx="6" fill="var(--icon-blue)"/>
    <rect x="37" y="6"  width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="37" y="68" width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="37" y="37" width="26" height="26" rx="6" fill="var(--icon-yellow)"/>
    <rect x="6"  y="37" width="26" height="26" rx="6" fill="var(--icon-red)"/>
  </svg>
);

export const ViewArrowIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="6"  y="37" width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="37" y="37" width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="37" y="6"  width="26" height="26" rx="6" fill="var(--icon-red)"/>
    <rect x="68" y="37" width="26" height="26" rx="6" fill="var(--icon-yellow)"/>
    <rect x="37" y="68" width="26" height="26" rx="6" fill="var(--icon-green)"/>
  </svg>
);

export const EmptyClassroomIcon = ({ className }: { className?: string }) => (
  <svg width="64" height="64" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="6"  y="6"  width="57" height="57" rx="9" fill="currentColor" opacity="0.2"/>
    <rect x="68" y="6"  width="26" height="26" rx="6" fill="currentColor" opacity="0.3"/>
    <rect x="68" y="37" width="26" height="26" rx="6" fill="currentColor" opacity="0.2"/>
    <rect x="68" y="68" width="26" height="26" rx="6" fill="currentColor" opacity="0.1"/>
    <rect x="37" y="68" width="26" height="26" rx="6" fill="currentColor" opacity="0.3"/>
    <rect x="6"  y="68" width="26" height="26" rx="6" fill="currentColor" opacity="0.2"/>
  </svg>
);

export const ResultsIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <circle cx="50" cy="50" r="30" fill="none" stroke="var(--icon-blue)" strokeWidth="8" />
    <circle cx="50" cy="50" r="15" fill="var(--icon-red)" />
    <path d="M70 30L85 15" stroke="var(--icon-yellow)" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

export const InviteLinkIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    {/* Left ring */}
    <rect x="6"  y="6"  width="26" height="26" rx="6" fill="var(--icon-blue)" opacity="0.5"/>
    <rect x="6"  y="37" width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="6"  y="68" width="26" height="26" rx="6" fill="var(--icon-blue)" opacity="0.5"/>
    {/* Chain bridge */}
    <rect x="37" y="37" width="26" height="26" rx="6" fill="var(--icon-yellow)"/>
    {/* Right ring */}
    <rect x="68" y="6"  width="26" height="26" rx="6" fill="var(--icon-green)" opacity="0.5"/>
    <rect x="68" y="37" width="26" height="26" rx="6" fill="var(--icon-green)"/>
    <rect x="68" y="68" width="26" height="26" rx="6" fill="var(--icon-green)" opacity="0.5"/>
  </svg>
);

export const CodeIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    {/* 3×2 keypad grid */}
    <rect x="6"  y="20" width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="37" y="20" width="26" height="26" rx="6" fill="var(--icon-red)"/>
    <rect x="68" y="20" width="26" height="26" rx="6" fill="var(--icon-yellow)"/>
    <rect x="6"  y="54" width="26" height="26" rx="6" fill="var(--icon-green)"/>
    <rect x="37" y="54" width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="68" y="54" width="26" height="26" rx="6" fill="var(--icon-red)"/>
  </svg>
);

export const FriendsIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="16" y="16" width="26" height="26" rx="6" fill="var(--icon-blue)" />
    <rect x="16" y="47" width="26" height="37" rx="8" fill="var(--icon-blue)" opacity="0.6" />

    <rect x="58" y="16" width="26" height="26" rx="6" fill="var(--icon-yellow)" />
    <rect x="58" y="47" width="26" height="37" rx="8" fill="var(--icon-yellow)" opacity="0.6" />

    <rect x="37" y="47" width="26" height="26" rx="6" fill="var(--icon-red)" />
  </svg>
);

export const SetLevelIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    {/* Staircase/Sliders hybrid */}
    <rect x="6"  y="68" width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="37" y="37" width="26" height="26" rx="6" fill="var(--icon-yellow)"/>
    <rect x="68" y="6"  width="26" height="26" rx="6" fill="var(--icon-green)"/>
    <rect x="68" y="37" width="26" height="26" rx="6" fill="var(--icon-blue)"/>
    <rect x="37" y="68" width="26" height="26" rx="6" fill="var(--icon-red)"/>
  </svg>
);

export const TestLevelIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    {/* Target reticle / radar pattern */}
    <rect x="37" y="6"  width="26" height="26" rx="6" fill="var(--icon-blue)" />
    <rect x="37" y="68" width="26" height="26" rx="6" fill="var(--icon-blue)" />
    <rect x="6"  y="37" width="26" height="26" rx="6" fill="var(--icon-blue)" />
    <rect x="68" y="37" width="26" height="26" rx="6" fill="var(--icon-blue)" />
    <rect x="37" y="37" width="26" height="26" rx="6" fill="var(--icon-red)" />
  </svg>
);


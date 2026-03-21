import React from 'react';

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

export const BackIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="58" y="16" width="20" height="20" rx="6" fill="#4FA7FF" />
    <rect x="42" y="40" width="20" height="20" rx="6" fill="#FBBA00" />
    <rect x="26" y="64" width="20" height="20" rx="6" fill="#E8391D" />
    <rect x="42" y="64" width="36" height="20" rx="6" fill="#E8391D" opacity="0.5" />
  </svg>
);

export const TargetIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="16" y="16" width="20" height="20" rx="6" fill="#4FA7FF" />
    <rect x="64" y="16" width="20" height="20" rx="6" fill="#4FA7FF" />
    <rect x="16" y="64" width="20" height="20" rx="6" fill="#4FA7FF" />
    <rect x="64" y="64" width="20" height="20" rx="6" fill="#4FA7FF" />
    <rect x="40" y="40" width="20" height="20" rx="6" fill="#E8391D" />
  </svg>
);

export const LightningIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="16" y="58" width="20" height="26" rx="6" fill="#4FA7FF" />
    <rect x="40" y="38" width="20" height="46" rx="6" fill="#FBBA00" />
    <rect x="64" y="18" width="20" height="66" rx="6" fill="#5DD23C" />
  </svg>
);

export const KeyIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <circle cx="35" cy="50" r="18" fill="none" stroke="currentColor" strokeWidth="12" />
    <rect x="52" y="44" width="40" height="12" rx="4" fill="currentColor" />
    <rect x="75" y="56" width="12" height="16" rx="4" fill="currentColor" />
  </svg>
);

export const SettingsIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true" className={className}>
    <rect width="100" height="100" rx="18" fill="currentColor" opacity="0.05" />
    <rect x="6" y="14" width="88" height="10" rx="5" fill="currentColor" opacity="0.25" />
    <rect x="58" y="6" width="26" height="26" rx="8" fill="#4FA7FF" />
    <rect x="6" y="45" width="88" height="10" rx="5" fill="currentColor" opacity="0.25" />
    <rect x="26" y="37" width="26" height="26" rx="8" fill="#5DD23C" />
    <rect x="6" y="76" width="88" height="10" rx="5" fill="currentColor" opacity="0.25" />
    <rect x="42" y="68" width="26" height="26" rx="8" fill="#E8391D" />
  </svg>
);

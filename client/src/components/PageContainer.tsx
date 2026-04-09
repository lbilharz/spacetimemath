import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'max-w-2xl' | 'max-w-3xl' | 'max-w-5xl' | 'max-w-7xl' | 'none';
  className?: string; // For additional padding-bottom or specific page adjustments
}

/**
 * Standard container for all pages to ensure consistent horizontal padding and layout.
 * Horizontal padding is px-2 on mobile and sm:p-6 (24px) on larger screens.
 * This component centralizes the padding logic that was previously duplicated across all pages.
 */
export default function PageContainer({
  children,
  maxWidth = 'max-w-2xl',
  className = ''
}: PageContainerProps) {
  const maxWidthClass = maxWidth === 'none' ? '' : maxWidth;

  return (
    <div className={`mx-auto flex w-full flex-col gap-8 px-2 py-4 sm:p-6 animate-in fade-in slide-in-from-bottom-2 duration-300 ${maxWidthClass} ${className}`}>
      {children}
    </div>
  );
}

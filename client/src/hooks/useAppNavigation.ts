import { useState, useEffect, useRef } from 'react';
import { type Page, PATH_MAP, PAGE_PATH, TABBED_PAGES } from '../navigation.js';

export type { Page };
export { PATH_MAP, PAGE_PATH, TABBED_PAGES };

export function useAppNavigation(initialPage: Page) {
  const [page, setPage] = useState<Page>(initialPage);

  // Ref so event handlers can read the current player without stale closure
  const myPlayerRef = useRef<{ learningTier?: number } | undefined>(undefined);

  const navigate = (newPage: Page, hash?: string) => {
    const path = PAGE_PATH[newPage] ?? '/';
    window.history.pushState(null, '', hash ? `${path}#${hash}` : path);
    setPage(newPage);
  };

  // After each page transition: scroll to hash or reset to top
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const t = setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
      return () => clearTimeout(t);
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [page]);

  // Global SPA link interceptor — <a href="/progress#scoring-guide"> works anywhere
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('/') && !href.startsWith('#')) return;
      e.preventDefault();
      const [rawPath, rawHash] = href.split('#');
      const path = rawPath || window.location.pathname;
      const targetPage = PATH_MAP[path] ?? 'lobby';
      if (!myPlayerRef.current && targetPage !== 'register') return;
      navigate(targetPage, rawHash || undefined);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Browser back / forward
  useEffect(() => {
    const handlePop = () => {
      const path = window.location.pathname;
      const target = PATH_MAP[path] ?? 'lobby';
      const safe: Page = TABBED_PAGES.includes(target) ? target : 'lobby';
      setPage(myPlayerRef.current ? safe : 'register');
      const hash = window.location.hash.slice(1);
      if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  return { page, setPage, navigate, myPlayerRef };
}

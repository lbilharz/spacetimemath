export type Page = 'register' | 'lobby' | 'classrooms' | 'progress' | 'sprint' | 'results' | 'account' | 'classroom' | 'classsprintresults';

export const TABBED_PAGES: Page[] = ['lobby', 'classrooms', 'progress', 'account'];

/** Pathname → Page (only stable, deep-linkable pages) */
export const PATH_MAP: Record<string, Page> = {
  '/':           'lobby',
  '/classrooms': 'classrooms',
  '/progress':   'progress',
  '/account':    'account',
  '/classroom':  'classroom',
};

/** Page → canonical pathname */
export const PAGE_PATH: Partial<Record<Page, string>> = {
  lobby:      '/',
  classrooms: '/classrooms',
  progress:   '/progress',
  account:    '/account',
  classroom:  '/classroom',
  sprint:     '/sprint',
  results:    '/results',
};

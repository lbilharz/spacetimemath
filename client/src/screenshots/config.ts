export interface ScreenConfig {
  id: number              // 1–N, used in filename: iPhone69-1.png
  component: string       // React component name in screens/
  label: string           // human label for logs
  background: 'dark' | 'light' | 'gradient'
}

export const SCREENS: ScreenConfig[] = [
  { id: 1, component: 'SprintScreen',       label: 'JTBD 1: Sprint',      background: 'light' },
  { id: 2, component: 'FriendsLeaderboard', label: 'JTBD 2: Friends',     background: 'light' },
  { id: 3, component: 'AdaptiveTiers',      label: 'JTBD 3: Pacing',      background: 'light' },
  { id: 4, component: 'MasteryGrid',        label: 'JTBD 4: Assessment',  background: 'light' },
  { id: 5, component: 'ClassroomLive',      label: 'JTBD 5: Spot Help',   background: 'light' },
]

export const LOCALES = [
  { lang: 'en', fastlaneDir: 'en-GB',   dir: 'ltr' },
  { lang: 'de', fastlaneDir: 'de-DE',   dir: 'ltr' },
  { lang: 'fr', fastlaneDir: 'fr-FR',   dir: 'ltr' },
  { lang: 'nl', fastlaneDir: 'nl-NL',   dir: 'ltr' },
  { lang: 'tr', fastlaneDir: 'tr',      dir: 'ltr' },
  { lang: 'uk', fastlaneDir: 'uk',      dir: 'ltr' },
  { lang: 'ar', fastlaneDir: 'ar-SA',   dir: 'rtl' },
  { lang: 'zh', fastlaneDir: 'zh-Hans', dir: 'ltr' },
  { lang: 'es', fastlaneDir: 'es-ES',   dir: 'ltr' },
]

export const DEVICES = [
  { name: 'iPhone69', width: 440, height: 956, scale: 3 },  // → 1320×2868
  { name: 'iPhone65', width: 414, height: 896, scale: 3 },  // → 1242×2688
  { name: 'iPadPro129', width: 1024, height: 1366, scale: 2 }, // → 2048x2732 (Portrait, required for 13-inch iPad display)
]

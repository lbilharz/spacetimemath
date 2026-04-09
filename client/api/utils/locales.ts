import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const ar = require('../../src/locales/ar/translation.json');
const de = require('../../src/locales/de/translation.json');
const en = require('../../src/locales/en/translation.json');
const es = require('../../src/locales/es/translation.json');
const fr = require('../../src/locales/fr/translation.json');
const nl = require('../../src/locales/nl/translation.json');
const tr = require('../../src/locales/tr/translation.json');
const uk = require('../../src/locales/uk/translation.json');
const zh = require('../../src/locales/zh/translation.json');

const translations: Record<string, typeof en> = {
  ar, de, en, es, fr, nl, tr, uk, zh
};

export function getTranslation(locale: string = 'en') {
  // Try exact match, then language prefix, then fallback to english
  const exact = translations[locale];
  if (exact) return exact;
  const prefix = locale.split('-')[0];
  const langMatch = translations[prefix];
  if (langMatch) return langMatch;
  return en;
}

import ar from '../../src/locales/ar/translation.json';
import de from '../../src/locales/de/translation.json';
import en from '../../src/locales/en/translation.json';
import es from '../../src/locales/es/translation.json';
import fr from '../../src/locales/fr/translation.json';
import nl from '../../src/locales/nl/translation.json';
import tr from '../../src/locales/tr/translation.json';
import uk from '../../src/locales/uk/translation.json';
import zh from '../../src/locales/zh/translation.json';

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

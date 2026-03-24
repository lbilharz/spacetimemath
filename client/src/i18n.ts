import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en/translation.json';
import de from './locales/de/translation.json';
import fr from './locales/fr/translation.json';
import nl from './locales/nl/translation.json';
import tr from './locales/tr/translation.json';
import uk from './locales/uk/translation.json';
import ar from './locales/ar/translation.json';
import zh from './locales/zh/translation.json';
import es from './locales/es/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
      nl: { translation: nl },
      tr: { translation: tr },
      uk: { translation: uk },
      ar: { translation: ar },
      zh: { translation: zh },
      es: { translation: es },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'de', 'fr', 'nl', 'tr', 'uk', 'ar', 'zh', 'es'],
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;

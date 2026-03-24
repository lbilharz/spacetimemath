import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.resolve(__dirname, '../src/locales');
const BASE_LOCALE = 'en';

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function checkTranslations() {
  const baseFilePath = path.join(LOCALES_DIR, BASE_LOCALE, 'translation.json');
  if (!fs.existsSync(baseFilePath)) {
    console.error(`Base locale file not found: ${baseFilePath}`);
    process.exit(1);
  }

  const baseContent = JSON.parse(fs.readFileSync(baseFilePath, 'utf8'));
  const baseKeys = getKeys(baseContent);
  console.log(`Base locale (${BASE_LOCALE}) loaded with ${baseKeys.length} keys.\n`);

  const locales = fs.readdirSync(LOCALES_DIR).filter(f => {
    const stat = fs.statSync(path.join(LOCALES_DIR, f));
    return stat.isDirectory() && f !== BASE_LOCALE;
  });

  let totalWarnings = 0;

  locales.forEach(locale => {
    const filePath = path.join(LOCALES_DIR, locale, 'translation.json');
    if (!fs.existsSync(filePath)) {
      console.warn(`[${locale}] translation.json missing!`);
      return;
    }

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = new Set(getKeys(content));
    
    const missing = baseKeys.filter(k => !keys.has(k));
    
    if (missing.length > 0) {
      console.warn(`\x1b[33m[${locale}] Missing ${missing.length} translations:\x1b[0m`);
      missing.forEach(k => console.log(`  - ${k}`));
      console.log('');
      totalWarnings += missing.length;
    } else {
      console.log(`\x1b[32m[${locale}] All translations present! (✓)\x1b[0m`);
    }
  });

  if (totalWarnings > 0) {
    console.log(`\n\x1b[31mDone. Found ${totalWarnings} missing translations across ${locales.length} languages.\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\n\x1b[32mDone. All languages are fully translated.\x1b[0m`);
  }
}

checkTranslations();

const fs = require('fs');
const path = require('path');

const localesPath = path.join(__dirname, 'client', 'src', 'locales');
const enPath = path.join(localesPath, 'en', 'translation.json');

let enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Added the missing 'lobby.sessions'
if (!enData.lobby) enData.lobby = {};
enData.lobby.sessions = 'Sessions';

fs.writeFileSync(enPath, JSON.stringify(enData, null, 2) + '\n');
console.log('Fixed EN translations.');

const isObject = (item) => item && typeof item === 'object' && !Array.isArray(item);

const mergeDeep = (target, source) => {
  for (const key in source) {
    if (isObject(source[key])) {
      if (!target[key]) Object.assign(target, { [key]: {} });
      mergeDeep(target[key], source[key]);
    } else {
      if (target[key] === undefined) {
        target[key] = source[key];
      }
    }
  }
};

const langs = ['ar', 'de', 'es', 'fr', 'nl', 'tr', 'uk', 'zh'];

for (const lang of langs) {
  const p = path.join(localesPath, lang, 'translation.json');
  if (fs.existsSync(p)) {
    let data = JSON.parse(fs.readFileSync(p, 'utf8'));
    mergeDeep(data, enData); // Fill any missing keys using English fallbacks
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  }
}
console.log('Synchronized all languages with EN base.');

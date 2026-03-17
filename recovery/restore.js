#!/usr/bin/env node
// Restore players + recovery keys from CSV exports after the --delete-data incident.
//
// Usage: node recovery/restore.js [--dry-run]
//
// Reads:
//   recovery/export-sessions-*.csv        → per-player aggregates (best_score, totals, username)
//   recovery/export-recovery_keys-*.csv   → identity → { code, token }
//
// Calls (as each player's own identity via their token):
//   restore_player_full(username, best_score, total_sessions, total_correct, total_answered, learning_tier)
//   restore_recovery_key(code, token)

const { readFileSync } = require('fs');
const { resolve } = require('path');

const __dir = __dirname;
const DRY_RUN = process.argv.includes('--dry-run');
const DB = 'spacetimemath';
const SERVER = 'https://maincloud.spacetimedb.com';

// ---------- CSV parsing ----------

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').filter(l => l.trim());
  const headers = parseCsvRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCsvRow(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] ?? '');
    return obj;
  });
}

function parseCsvRow(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function parseIdentity(raw) {
  // {"__identity__":"0xc200..."} → "0xc200..."
  try {
    return JSON.parse(raw).__identity__;
  } catch {
    return raw;
  }
}

// ---------- Load CSVs ----------

const recDir = __dir;
const sessionsPath  = resolve(recDir, 'export-sessions-2026-03-17-07-36-41.csv');
const keysPath      = resolve(recDir, 'export-recovery_keys-2026-03-17-07-36-53.csv');

const sessions  = parseCsv(readFileSync(sessionsPath, 'utf8'));
const keyRows   = parseCsv(readFileSync(keysPath, 'utf8'));

// ---------- Aggregate per-player stats from sessions ----------

const players = new Map(); // identity → aggregated stats

for (const s of sessions) {
  const id = parseIdentity(s.player_identity);
  const score = parseFloat(s.weighted_score) || 0;
  const answered = parseInt(s.total_answered) || 0;
  const complete = s.is_complete === 'TRUE';

  if (!players.has(id)) {
    players.set(id, {
      identity: id,
      username: s.username,
      best_score: 0,
      total_sessions: 0,
      total_correct: 0,
      total_answered: 0,
    });
  }
  const p = players.get(id);
  // Use the most recent username (last row in CSV for this identity)
  p.username = s.username;
  p.total_sessions += 1;
  p.total_answered += answered;
  if (score > p.best_score) p.best_score = score;
  // Approximate total_correct from accuracy_pct × total_answered
  const acc = parseFloat(s.accuracy_pct) || 0;
  p.total_correct += Math.round(answered * acc / 100);
}

// ---------- Build identity → { code, token } from recovery_keys ----------

const keyMap = new Map(); // identity → { code, token }
for (const r of keyRows) {
  const id = parseIdentity(r.owner);
  keyMap.set(id, { code: r.code, token: r.token });
}

// ---------- Stats ----------

console.log(`Players from sessions:       ${players.size}`);
console.log(`Players with recovery keys:  ${keyMap.size}`);
const noKey = [...players.keys()].filter(id => !keyMap.has(id));
console.log(`Players WITHOUT recovery key (cannot restore automatically): ${noKey.length}`);
if (noKey.length) {
  for (const id of noKey) {
    const p = players.get(id);
    console.log(`  - ${p.username} (${id})`);
  }
}
console.log('');

// ---------- HTTP call helper ----------

async function callReducer(reducer, args, token) {
  const url = `${SERVER}/v1/database/${DB}/call/${reducer}`;
  if (DRY_RUN) {
    console.log(`[DRY] POST ${reducer}`, JSON.stringify(args).slice(0, 80));
    return;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${reducer} → ${res.status}: ${body}`);
  }
}

// ---------- Restore ----------

async function main() {
  let restored = 0, failed = 0;

  const toRestore = [...players.values()].filter(p => keyMap.has(p.identity));
  console.log(`Restoring ${toRestore.length} players...\n`);

  for (const p of toRestore) {
    const { code, token } = keyMap.get(p.identity);
    try {
      await callReducer('restore_player_full', [
        p.username,
        p.best_score,
        p.total_sessions,
        p.total_correct,
        p.total_answered,
        0,  // learning_tier — reset to 0; players can re-set via Progress page
      ], token);

      await callReducer('restore_recovery_key', [code, token], token);

      console.log(`  ✓ ${p.username.padEnd(24)} sessions=${p.total_sessions} best=${p.best_score.toFixed(1)}`);
      restored++;
    } catch (err) {
      console.error(`  ✗ ${p.username}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. restored=${restored} failed=${failed} skipped(no key)=${noKey.length}`);
  if (noKey.length) {
    console.log('\nSkipped players must re-register. Their localStorage token is still valid');
    console.log('so they can connect, but stats/username will be reset.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });

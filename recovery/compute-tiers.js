#!/usr/bin/env node
// Recompute learning tiers for all restored players from answers CSV.
// Replicates check_and_unlock logic from server/src/lib.rs.
//
// Usage: node recovery/compute-tiers.js [--dry-run]

const { readFileSync } = require('fs');
const { resolve } = require('path');

const __dir = __dirname;
const DRY_RUN = process.argv.includes('--dry-run');
const DB = 'spacetimemath';
const SERVER = 'https://maincloud.spacetimedb.com';

// ---------- Tier logic (mirrors server/src/lib.rs) ----------

const FACTOR_TIER = { 1: 0, 2: 0, 10: 0, 3: 1, 5: 2, 4: 3, 6: 4, 7: 5, 8: 6, 9: 7 };
const MAX_TIER = 7;

function factorTier(x) {
  return FACTOR_TIER[x] ?? null;
}

function pairTier(a, b) {
  const ta = factorTier(a), tb = factorTier(b);
  if (ta === null || tb === null) return null;
  return Math.min(ta, tb);
}

// All canonical (a,b) pairs for a given tier: 1≤a,b≤10, pairTier(a,b) === t
// This matches what problem_stats contains for core pairs.
function tierPairs(t) {
  const pairs = [];
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      if (pairTier(a, b) === t) pairs.push([a, b]);
    }
  }
  return pairs;
}

// Pre-compute pair sets for all tiers
const TIER_PAIRS = Array.from({ length: MAX_TIER }, (_, t) => tierPairs(t));

function computeTier(answersForPlayer) {
  // Group by (a,b) key
  const byPair = new Map();
  for (const ans of answersForPlayer) {
    const key = `${ans.a},${ans.b}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(ans);
  }
  // Sort each pair's answers by id (ascending)
  for (const list of byPair.values()) {
    list.sort((x, y) => x.id - y.id);
  }

  let earnedTier = 0;

  for (let targetTier = 1; targetTier <= MAX_TIER; targetTier++) {
    const checkTier = targetTier - 1;
    const pairs = TIER_PAIRS[checkTier];
    if (pairs.length === 0) continue;

    let mastered = 0;
    for (const [a, b] of pairs) {
      const list = byPair.get(`${a},${b}`) ?? [];
      if (list.length === 0) continue;
      const recent = list.slice(-10);
      const acc = recent.filter(ans => ans.is_correct).length / recent.length;
      if (acc >= 0.8) mastered++;
    }

    const threshold = 0.8; // conservative: no speed bonus (no session context)
    if (mastered / pairs.length >= threshold) {
      earnedTier = targetTier;
    } else {
      break;
    }
  }

  return earnedTier;
}

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
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else cur += c;
  }
  result.push(cur);
  return result;
}

function parseIdentity(raw) {
  try { return JSON.parse(raw).__identity__; } catch { return raw; }
}

// ---------- Load ----------

const answersPath = resolve(__dir, 'export-answers-2026-03-17-07-37-08.csv');
const keysPath    = resolve(__dir, 'export-recovery_keys-2026-03-17-07-36-53.csv');

const rawAnswers = parseCsv(readFileSync(answersPath, 'utf8'));
const keyRows    = parseCsv(readFileSync(keysPath, 'utf8'));

// Parse answers
const answers = rawAnswers.map(r => ({
  id:         parseInt(r.id),
  identity:   parseIdentity(r.player_identity),
  a:          parseInt(r.a),
  b:          parseInt(r.b),
  is_correct: r.is_correct === 'TRUE',
  response_ms: parseInt(r.response_ms),
}));

// Group answers by player identity
const byPlayer = new Map();
for (const ans of answers) {
  if (!byPlayer.has(ans.identity)) byPlayer.set(ans.identity, []);
  byPlayer.get(ans.identity).push(ans);
}

// Build token map
const keyMap = new Map();
for (const r of keyRows) {
  keyMap.set(parseIdentity(r.owner), { token: r.token });
}

// ---------- HTTP helper ----------

async function callReducer(reducer, args, token) {
  const url = `${SERVER}/v1/database/${DB}/call/${reducer}`;
  if (DRY_RUN) {
    console.log(`[DRY] ${reducer}(${JSON.stringify(args)})`);
    return;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
}

// ---------- Main ----------

async function main() {
  let updated = 0, skipped = 0, failed = 0;

  const identities = [...new Set([...byPlayer.keys(), ...keyMap.keys()])];
  console.log(`Computing tiers for ${identities.length} identities with answers...\n`);

  for (const id of identities) {
    const key = keyMap.get(id);
    if (!key) { skipped++; continue; } // no token, can't update

    const playerAnswers = byPlayer.get(id) ?? [];
    const tier = computeTier(playerAnswers);
    if (tier === 0) { skipped++; continue; } // tier 0 = default, no update needed

    try {
      await callReducer('set_learning_tier', [tier], key.token);
      const pairCounts = TIER_PAIRS.slice(0, tier).map((pairs, t) => {
        const mastered = pairs.filter(([a, b]) => {
          const list = (byPlayer.get(id) ?? []).filter(ans => ans.a === a && ans.b === b);
          if (!list.length) return false;
          const recent = list.slice(-10);
          return recent.filter(ans => ans.is_correct).length / recent.length >= 0.8;
        }).length;
        return `T${t}:${mastered}/${pairs.length}`;
      }).join(' ');
      console.log(`  ✓ tier=${tier}  ${pairCounts}  (${id.slice(0, 20)}...)`);
      updated++;
    } catch (err) {
      console.error(`  ✗ ${id.slice(0, 20)}...: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped} failed=${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });

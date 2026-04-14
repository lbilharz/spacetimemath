#!/usr/bin/env node
// Restore all tables from a pipe-delimited backup directory (spacetime sql output).
//
// Usage:
//   node recovery/restore-from-backup.js [--dry-run] [--backup <dir>]
//
// Default backup dir: recovery/backups/<most recent>
// Phases (in order):
//   1. players          → restore_player_full        (as each player, via their token)
//   2. recovery_keys    → restore_recovery_key        (as each player, via their token)
//   3. best_scores      → restore_best_score          (as each player, via their token)
//   4. classrooms       → restore_classroom           (as each teacher, via their token)
//   5. sessions         → restore_session             (as each player, via their token)
//   6. answers          → restore_answer              (as each player, via their token)
//
// Note: classroom_members require admin — run manually after bootstrapping admin.

const { readFileSync, readdirSync } = require('fs');
const { resolve } = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const DB = 'spacetimemath';
const SERVER = 'https://maincloud.spacetimedb.com';
const CONCURRENCY = 8;

// ---------- CLI: backup dir ----------

let backupDir;
const bdIdx = process.argv.indexOf('--backup');
if (bdIdx !== -1 && process.argv[bdIdx + 1]) {
  backupDir = resolve(process.argv[bdIdx + 1]);
} else {
  const backupsRoot = resolve(__dirname, 'backups');
  const dirs = readdirSync(backupsRoot).sort();
  if (!dirs.length) { console.error('No backup dirs found in', backupsRoot); process.exit(1); }
  backupDir = resolve(backupsRoot, dirs[dirs.length - 1]);
}
console.log(`Using backup: ${backupDir}\n`);

// ---------- Pipe-delimited parser ----------

function parsePipeFile(path) {
  const text = readFileSync(path, 'utf8');
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  // Line 0: headers,  Line 1: dashes separator,  Lines 2+: data
  const headers = lines[0].split('|').map(h => h.trim());
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^[-+]+$/.test(line.trim())) continue;
    const parts = line.split('|').map(s => s.trim());
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = parts[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}

// Parse quoted strings, numbers, booleans, enums, options
function parseField(raw) {
  if (!raw) return raw;
  const v = raw.trim();
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === '(none = ())') return null;
  // (some = (value))
  const someMatch = v.match(/^\(some = \((.+)\)\)$/);
  if (someMatch) return parseField(someMatch[1]);
  // enum like (solo = ()) → "solo"
  const enumMatch = v.match(/^\((\w+) = \(\)\)$/);
  if (enumMatch) return enumMatch[1];
  // number
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function parseRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = parseField(v);
  return out;
}

// ISO timestamp → BigInt micros since epoch
function isoToMicros(isoStr) {
  const str = isoStr.trim();
  // "2026-03-23T19:43:14.420671+00:00" or "2026-03-23T19:43:14+00:00"
  const m = str.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?([+-]\d{2}:\d{2}|Z)?$/);
  if (!m) throw new Error(`Cannot parse timestamp: ${str}`);
  const [, base, frac = ''] = m;
  const fracPadded = (frac + '000000').slice(0, 6);
  const fracMicros = BigInt(fracPadded);
  // Parse the base as UTC (strip offset, we already verified +00:00 / Z)
  const epochMs = BigInt(new Date(base + 'Z').getTime());
  return epochMs * 1000n + fracMicros;
}

// ---------- HTTP helper ----------

async function callReducer(reducer, args, token) {
  const url = `${SERVER}/v1/database/${DB}/call/${reducer}`;
  if (DRY_RUN) {
    const preview = JSON.stringify(args);
    console.log(`  [DRY] ${reducer}(${preview.slice(0, 100)}${preview.length > 100 ? '…' : ''})`);
    return;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
}

// Process an array of tasks with bounded concurrency
async function runConcurrent(tasks, label) {
  let done = 0, failed = 0;
  const total = tasks.length;
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, async () => {
    while (queue.length) {
      const t = queue.shift();
      try {
        await t();
        done++;
        if (done % 50 === 0 || done === total) process.stdout.write(`\r  ${label}: ${done}/${total} done, ${failed} failed   `);
      } catch (err) {
        failed++;
        console.error(`\n  ✗ ${label} error: ${err.message}`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`\r  ${label}: ${done}/${total} done, ${failed} failed   `);
  return { done, failed };
}

// ---------- Load files ----------

const playersRaw    = parsePipeFile(resolve(backupDir, 'players.txt')).map(parseRow);
const keysRaw       = parsePipeFile(resolve(backupDir, 'recovery_keys.txt')).map(parseRow);
const bestRaw       = parsePipeFile(resolve(backupDir, 'best_scores.txt')).map(parseRow);
const classroomsRaw = parsePipeFile(resolve(backupDir, 'classrooms.txt')).map(parseRow);
const sessionsRaw   = parsePipeFile(resolve(backupDir, 'sessions.txt')).map(parseRow);
const answersRaw    = parsePipeFile(resolve(backupDir, 'answers.txt')).map(parseRow);

// Build identity → token map from recovery_keys
const tokenMap = new Map(); // identity (0x...) → JWT token string
for (const k of keysRaw) {
  const identity = k.owner.trim();
  const token = typeof k.token === 'string' ? k.token : String(k.token);
  if (!tokenMap.has(identity)) tokenMap.set(identity, { token, code: k.code });
}

console.log(`Players:           ${playersRaw.length}`);
console.log(`Recovery keys:     ${keysRaw.length} (${tokenMap.size} unique identities)`);
console.log(`Best scores:       ${bestRaw.length}`);
console.log(`Classrooms:        ${classroomsRaw.length}`);
console.log(`Sessions:          ${sessionsRaw.length}`);
console.log(`Answers:           ${answersRaw.length}`);
const noToken = playersRaw.filter(p => !tokenMap.has(p.identity.trim()));
console.log(`Players w/o token: ${noToken.length}${noToken.length ? ' (cannot auto-restore)' : ''}`);
if (noToken.length) noToken.forEach(p => console.log(`  - ${p.username} (${p.identity})`));
console.log('');

// ---------- Main ----------

async function main() {

  // Phase 1: Players
  console.log('Phase 1: restore_player_full');
  await runConcurrent(
    playersRaw
      .filter(p => tokenMap.has(p.identity.trim()))
      .map(p => async () => {
        const { token } = tokenMap.get(p.identity.trim());
        await callReducer('restore_player_full', [
          p.username,
          p.best_score,
          p.total_sessions,
          p.total_correct,
          p.total_answered,
          p.learning_tier,
        ], token);
      }),
    'players'
  );

  // Phase 2: Recovery keys
  console.log('\nPhase 2: restore_recovery_key');
  await runConcurrent(
    keysRaw.map(k => async () => {
      const identity = k.owner.trim();
      const token = typeof k.token === 'string' ? k.token : String(k.token);
      const code = typeof k.code === 'string' ? k.code : String(k.code);
      await callReducer('restore_recovery_key', [code, token], token);
    }),
    'keys'
  );

  // Phase 3: Best scores
  console.log('\nPhase 3: restore_best_score');
  await runConcurrent(
    bestRaw
      .filter(b => tokenMap.has(b.player_identity.trim()))
      .map(b => async () => {
        const { token } = tokenMap.get(b.player_identity.trim());
        await callReducer('restore_best_score', [
          b.username,
          b.best_weighted_score,
          b.best_accuracy_pct,
          b.best_total_answered,
          b.learning_tier,
        ], token);
      }),
    'best_scores'
  );

  // Phase 4: Classrooms (as teacher)
  console.log('\nPhase 4: restore_classroom');
  await runConcurrent(
    classroomsRaw
      .filter(c => tokenMap.has(c.teacher.trim()))
      .map(c => async () => {
        const { token } = tokenMap.get(c.teacher.trim());
        await callReducer('restore_classroom', [c.id, c.code, c.name], token);
      }),
    'classrooms'
  );

  // Phase 5: Sessions
  console.log('\nPhase 5: restore_session');
  await runConcurrent(
    sessionsRaw
      .filter(s => tokenMap.has(s.player_identity.trim()))
      .map(s => async () => {
        const { token } = tokenMap.get(s.player_identity.trim());
        const micros = isoToMicros(s.started_at);
        await callReducer('restore_session', [
          s.id,
          s.username,
          s.weighted_score,
          s.raw_score,
          s.accuracy_pct,
          s.total_answered,
          s.is_complete,
          Number(micros),
        ], token);
      }),
    'sessions'
  );

  // Phase 6: Answers (largest table — concurrency helps here)
  console.log('\nPhase 6: restore_answer');
  await runConcurrent(
    answersRaw
      .filter(a => tokenMap.has(a.player_identity.trim()))
      .map(a => async () => {
        const { token } = tokenMap.get(a.player_identity.trim());
        const micros = isoToMicros(a.answered_at);
        await callReducer('restore_answer', [
          a.id,
          a.session_id,
          a.a,
          a.b,
          a.user_answer,
          a.is_correct,
          a.response_ms,
          Number(micros),
        ], token);
      }),
    'answers'
  );

  console.log('\nRestore complete.');
  if (noToken.length) {
    console.log(`\n${noToken.length} player(s) without recovery keys were skipped.`);
    console.log('Their localStorage tokens still work — they will re-appear when they next connect.');
  }
  console.log('\nNOTE: classroom_members (student-class links) not restored automatically.');
  console.log('Students must rejoin their class, or run restore_classroom_member as admin.');
}

main().catch(err => { console.error('\nFATAL:', err); process.exit(1); });

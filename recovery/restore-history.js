#!/usr/bin/env node
// Restore sessions, answers, and best_scores from CSV exports.
// Requires players to already be restored (run restore.js first).
//
// Usage: node recovery/restore-history.js [--dry-run]
//
// Calls (as each player's own identity via their token):
//   restore_session(id, username, weighted_score, raw_score, accuracy_pct, total_answered, is_complete, started_at_micros)
//   restore_answer(id, session_id, a, b, user_answer, is_correct, response_ms, answered_at_micros)
//   restore_best_score(username, best_weighted_score, best_accuracy_pct, best_total_answered, learning_tier)

const { readFileSync } = require('fs');
const { resolve } = require('path');

const __dir = __dirname;
const DRY_RUN = process.argv.includes('--dry-run');
const DB = 'spacetimemath';
const SERVER = 'https://maincloud.spacetimedb.com';
const CONCURRENCY = 20; // parallel HTTP calls

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

function parseTimestamp(raw) {
  try { return JSON.parse(raw).__timestamp_micros_since_unix_epoch__; } catch { return 0; }
}

// ---------- Load CSVs ----------

const sessionsRaw = parseCsv(readFileSync(resolve(__dir, 'export-sessions-2026-03-17-07-36-41.csv'), 'utf8'));
const answersRaw  = parseCsv(readFileSync(resolve(__dir, 'export-answers-2026-03-17-07-37-08.csv'), 'utf8'));
const keyRows     = parseCsv(readFileSync(resolve(__dir, 'export-recovery_keys-2026-03-17-07-36-53.csv'), 'utf8'));

const keyMap = new Map(); // identity → token
for (const r of keyRows) keyMap.set(parseIdentity(r.owner), r.token);

// Filter to players we have tokens for
const sessions = sessionsRaw
  .filter(r => keyMap.has(parseIdentity(r.player_identity)))
  .map(r => ({
    id:             parseInt(r.id),
    identity:       parseIdentity(r.player_identity),
    username:       r.username,
    weighted_score: parseFloat(r.weighted_score),
    raw_score:      parseInt(r.raw_score),
    accuracy_pct:   parseInt(r.accuracy_pct),
    total_answered: parseInt(r.total_answered),
    is_complete:    r.is_complete === 'TRUE',
    started_at:     parseTimestamp(r.started_at),
  }));

const answers = answersRaw
  .filter(r => keyMap.has(parseIdentity(r.player_identity)))
  .map(r => ({
    id:           parseInt(r.id),
    identity:     parseIdentity(r.player_identity),
    session_id:   parseInt(r.session_id),
    a:            parseInt(r.a),
    b:            parseInt(r.b),
    user_answer:  parseInt(r.user_answer),
    is_correct:   r.is_correct === 'TRUE',
    response_ms:  parseInt(r.response_ms),
    answered_at:  parseTimestamp(r.answered_at),
  }));

// Compute best_score per player for restore_best_score
const bestByPlayer = new Map();
for (const s of sessions) {
  if (!s.is_complete) continue;
  const cur = bestByPlayer.get(s.identity);
  if (!cur || s.weighted_score > cur.weighted_score) {
    bestByPlayer.set(s.identity, {
      identity: s.identity,
      username: s.username,
      weighted_score: s.weighted_score,
      accuracy_pct: s.accuracy_pct,
      total_answered: s.total_answered,
    });
  }
}

console.log(`Sessions to restore: ${sessions.length} (skipping ${sessionsRaw.length - sessions.length} without token)`);
console.log(`Answers to restore:  ${answers.length} (skipping ${answersRaw.length - answers.length} without token)`);
console.log(`Best scores:         ${bestByPlayer.size}`);
console.log('');

// ---------- HTTP helper ----------

async function callReducer(reducer, args, token) {
  if (DRY_RUN) return;
  const res = await fetch(`${SERVER}/v1/database/${DB}/call/${reducer}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
}

// Run tasks in batches of CONCURRENCY
async function runBatched(tasks) {
  let done = 0, failed = 0;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(t => t()));
    for (const r of results) {
      if (r.status === 'fulfilled') done++;
      else { failed++; console.error('  ✗', r.reason?.message ?? r.reason); }
    }
    // progress
    process.stdout.write(`\r  ${done + failed}/${tasks.length} (${failed} failed)`);
  }
  process.stdout.write('\n');
  return { done, failed };
}

// ---------- Main ----------

async function main() {
  // 1. Sessions
  console.log(`Restoring ${sessions.length} sessions...`);
  const sessionTasks = sessions.map(s => () => {
    const token = keyMap.get(s.identity);
    return callReducer('restore_session', [
      s.id, s.username, s.weighted_score, s.raw_score,
      s.accuracy_pct, s.total_answered, s.is_complete, s.started_at,
    ], token);
  });
  const sr = await runBatched(sessionTasks);
  console.log(`  sessions: ${sr.done} ok, ${sr.failed} failed\n`);

  // 2. Answers
  console.log(`Restoring ${answers.length} answers...`);
  const answerTasks = answers.map(a => () => {
    const token = keyMap.get(a.identity);
    return callReducer('restore_answer', [
      a.id, a.session_id, a.a, a.b,
      a.user_answer, a.is_correct, a.response_ms, a.answered_at,
    ], token);
  });
  const ar = await runBatched(answerTasks);
  console.log(`  answers: ${ar.done} ok, ${ar.failed} failed\n`);

  // 3. Best scores
  console.log(`Restoring ${bestByPlayer.size} best_score rows...`);
  const bsTasks = [...bestByPlayer.values()].map(b => async () => {
    const token = keyMap.get(b.identity);
    // learning_tier already set by compute-tiers.js; use 0 as placeholder
    // (restore_best_score will be overwritten by live play anyway)
    await callReducer('restore_best_score', [
      b.username, b.weighted_score, b.accuracy_pct, b.total_answered, 0,
    ], token);
  });
  const bsr = await runBatched(bsTasks);
  console.log(`  best_scores: ${bsr.done} ok, ${bsr.failed} failed\n`);

  const total = sr.done + ar.done + bsr.done;
  const totalFailed = sr.failed + ar.failed + bsr.failed;
  console.log(`Done. ${total} rows restored, ${totalFailed} failed.`);
}

main().catch(err => { console.error(err); process.exit(1); });

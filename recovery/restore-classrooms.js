#!/usr/bin/env node
// Restore classrooms + classroom members from CSV exports.
//
// Usage: node recovery/restore-classrooms.js [--dry-run]
//
// Reads:
//   recovery/export-classrooms-*.csv        → id, code, name, teacher (Identity)
//   recovery/export-classroom_members-*.csv → id, classroom_id, player_identity, hidden
//   recovery/export-recovery_keys-*.csv     → identity → token (to authenticate each caller)
//
// How it works:
//   1. For each classroom: the teacher calls restore_classroom(id, code, name)
//      using the teacher's recovery token.
//   2. For each member: the member calls restore_classroom_member(classroom_id, hidden)
//      using the member's recovery token.
//
// Both reducers are idempotent — safe to re-run.
//
// Getting CSV exports (SpacetimeDB web console):
//   https://maincloud.spacetimedb.com → spacetimemath → Tables
//   Export: classrooms, classroom_members, recovery_keys

const { readFileSync, readdirSync } = require('fs');
const { resolve, join } = require('path');

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

// ---------- Find CSV files ----------

function findLatestCsv(prefix) {
  const files = readdirSync(__dir).filter(f => f.startsWith(prefix) && f.endsWith('.csv'));
  if (files.length === 0) return null;
  files.sort();
  return resolve(__dir, files[files.length - 1]);
}

const classroomsPath = findLatestCsv('export-classrooms-');
const membersPath    = findLatestCsv('export-classroom_members-');
const keysPath       = findLatestCsv('export-recovery_keys-');

if (!classroomsPath || !membersPath || !keysPath) {
  console.error('\nMissing CSV exports. Export these tables from the SpacetimeDB web console:');
  if (!classroomsPath)  console.error('  ✗ classrooms          → save as export-classrooms-YYYY-MM-DD-HH-MM-SS.csv');
  if (!membersPath)     console.error('  ✗ classroom_members   → save as export-classroom_members-YYYY-MM-DD-HH-MM-SS.csv');
  if (!keysPath)        console.error('  ✗ recovery_keys       → save as export-recovery_keys-YYYY-MM-DD-HH-MM-SS.csv');
  console.error('\nPlace exports in: recovery/');
  process.exit(1);
}

console.log(`classrooms:        ${classroomsPath.split('/').pop()}`);
console.log(`classroom_members: ${membersPath.split('/').pop()}`);
console.log(`recovery_keys:     ${keysPath.split('/').pop()}`);

const classrooms = parseCsv(readFileSync(classroomsPath, 'utf8'));
const members    = parseCsv(readFileSync(membersPath,    'utf8'));
const keyRows    = parseCsv(readFileSync(keysPath,       'utf8'));

// Build token map: identity → token
const tokenMap = new Map();
for (const row of keyRows) {
  const identity = parseIdentity(row.identity);
  if (identity && row.token) tokenMap.set(identity, row.token);
}

console.log(`\nClassrooms:  ${classrooms.length}`);
console.log(`Members:     ${members.length}`);
console.log(`Tokens:      ${tokenMap.size}`);

// ---------- HTTP call helper ----------

async function callReducer(reducer, args, token) {
  const url = `${SERVER}/v1/database/${DB}/call/${reducer}`;
  if (DRY_RUN) {
    console.log(`[DRY] POST ${reducer}`, JSON.stringify(args).slice(0, 100));
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
  let classroomsRestored = 0, classroomsFailed = 0;
  let membersRestored = 0, membersFailed = 0;
  const noToken = [];

  // Step 1: Restore classroom rows (teacher calls restore_classroom)
  console.log('\n--- Classrooms ---');
  for (const c of classrooms) {
    const id   = parseInt(c.id);
    const code = c.code?.trim().toUpperCase();
    const name = c.name?.trim();
    const teacherIdentity = parseIdentity(c.teacher);

    if (!id || !code || !name || !teacherIdentity) {
      console.error(`  ✗ Skipping malformed row: ${JSON.stringify(c)}`);
      classroomsFailed++;
      continue;
    }

    const token = tokenMap.get(teacherIdentity);
    if (!token) {
      console.warn(`  ⚠ No token for teacher ${teacherIdentity.slice(0, 12)}… (classroom "${name}")`);
      noToken.push({ type: 'classroom', id, name, teacherIdentity });
      classroomsFailed++;
      continue;
    }

    try {
      await callReducer('restore_classroom', [id, code, name], token);
      console.log(`  ✓ "${name}" (id=${id}, code=${code})`);
      classroomsRestored++;
    } catch (err) {
      console.error(`  ✗ "${name}" (id=${id}): ${err.message}`);
      classroomsFailed++;
    }
  }

  // Step 2: Restore classroom_member rows (each member calls restore_classroom_member)
  console.log('\n--- Members ---');
  for (const m of members) {
    const classroomId     = parseInt(m.classroom_id);
    const playerIdentity  = parseIdentity(m.player_identity);
    const hidden          = m.hidden === 'TRUE' || m.hidden === 'true' || m.hidden === '1';

    if (!classroomId || !playerIdentity) {
      console.error(`  ✗ Skipping malformed row: ${JSON.stringify(m)}`);
      membersFailed++;
      continue;
    }

    const token = tokenMap.get(playerIdentity);
    if (!token) {
      console.warn(`  ⚠ No token for member ${playerIdentity.slice(0, 12)}… (classroom id=${classroomId})`);
      noToken.push({ type: 'member', classroomId, playerIdentity });
      membersFailed++;
      continue;
    }

    try {
      await callReducer('restore_classroom_member', [classroomId, hidden], token);
      console.log(`  ✓ member ${playerIdentity.slice(0, 12)}… → classroom ${classroomId}${hidden ? ' [hidden]' : ''}`);
      membersRestored++;
    } catch (err) {
      console.error(`  ✗ member ${playerIdentity.slice(0, 12)}…: ${err.message}`);
      membersFailed++;
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Classrooms:  restored=${classroomsRestored}  failed=${classroomsFailed}`);
  console.log(`Members:     restored=${membersRestored}  failed=${membersFailed}`);

  if (noToken.length > 0) {
    console.log(`\n⚠ ${noToken.length} row(s) skipped due to missing recovery tokens.`);
    console.log('  These identities have no recovery_keys row — they must re-join via the UI.');
    for (const n of noToken) {
      if (n.type === 'classroom') {
        console.log(`  Teacher ${n.teacherIdentity.slice(0, 16)}… → classroom "${n.name}" (id=${n.id})`);
      } else {
        console.log(`  Member  ${n.playerIdentity.slice(0, 16)}… → classroom id=${n.classroomId}`);
      }
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });

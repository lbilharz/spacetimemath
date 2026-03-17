#!/usr/bin/env node
// Restore classroom membership by calling join_classroom for each student.
//
// Usage:
//   1. Teacher creates each classroom via the app UI (creates new classroom codes).
//   2. Fill in the CLASSROOMS config below with the new codes and member usernames.
//   3. node recovery/rejoin-classrooms.js [--dry-run]
//
// This script queries tokens live from the DB — no CSV files needed.

// ============================================================
// EDIT THIS CONFIG — classroom code → list of member usernames
// ============================================================

const CLASSROOMS = [
  // {
  //   code: 'ABCD12',           // ← paste the classroom code from the app
  //   members: ['Lars', 'Erla', 'Jan'],  // ← usernames exactly as shown in the app
  // },
];

// ============================================================
// CONFIG END — nothing below needs editing
// ============================================================

const DB     = 'spacetimemath';
const SERVER = 'https://maincloud.spacetimedb.com';
const DRY    = process.argv.includes('--dry-run');
const SPACETIME = '/Users/lbi/.local/bin/spacetime';

const { execSync } = require('child_process');

if (CLASSROOMS.length === 0) {
  console.error('\nNo classrooms configured.');
  console.error('Edit the CLASSROOMS array at the top of this file and re-run.\n');
  process.exit(1);
}

// ---------- Query live DB ----------

function sql(query) {
  const out = execSync(
    `"${SPACETIME}" sql "${DB}" "${query}" --server maincloud 2>/dev/null`,
    { encoding: 'utf8' }
  );
  // Parse pipe-delimited output: skip header, separator lines, and empty rows
  const lines = out.split('\n').filter(l => l.includes('|') && !l.match(/^[-\s|]+$/));
  return lines.slice(1).map(line => {
    return line.split('|').map(cell => cell.trim().replace(/^"|"$/g, ''));
  });
}

console.log('Querying players and tokens from DB…');
const playerRows = sql('SELECT * FROM players');
const keyRows    = sql('SELECT * FROM recovery_keys');

// Build maps: username → identity, owner → token
const usernameToIdentity = new Map();
for (const row of playerRows) {
  // columns: identity | username | best_score | ...
  const [identity, username] = row;
  if (identity && username) usernameToIdentity.set(username, identity);
}

const identityToToken = new Map();
for (const row of keyRows) {
  // columns: code | owner | token
  const [, owner, token] = row;
  if (owner && token) identityToToken.set(owner, token);
}

console.log(`  players loaded: ${usernameToIdentity.size}`);
console.log(`  tokens loaded:  ${identityToToken.size}`);

// ---------- HTTP call helper ----------

async function callReducer(reducer, args, token) {
  const url = `${SERVER}/v1/database/${DB}/call/${reducer}`;
  if (DRY) {
    console.log(`  [DRY] ${reducer}(${JSON.stringify(args)})`);
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
    throw new Error(`${res.status}: ${body}`);
  }
}

// ---------- Main ----------

async function main() {
  let joined = 0, failed = 0;
  const notFound = [];

  for (const classroom of CLASSROOMS) {
    const { code, members } = classroom;
    console.log(`\n── Classroom code: ${code} (${members.length} members)`);

    for (const username of members) {
      const identity = usernameToIdentity.get(username);
      if (!identity) {
        console.warn(`  ⚠ Player not found: "${username}"`);
        notFound.push(username);
        failed++;
        continue;
      }

      const token = identityToToken.get(identity);
      if (!token) {
        console.warn(`  ⚠ No recovery token for "${username}" (${identity.slice(0, 14)}…)`);
        notFound.push(username);
        failed++;
        continue;
      }

      try {
        await callReducer('join_classroom', [code], token);
        console.log(`  ✓ ${username}`);
        joined++;
      } catch (err) {
        console.error(`  ✗ ${username}: ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n=== Done: joined=${joined}  failed=${failed} ===`);

  if (notFound.length > 0) {
    console.log('\nNot found / no token:');
    notFound.forEach(u => console.log(`  ${u}`));
    console.log('These students must re-join manually using the classroom code in the app.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });

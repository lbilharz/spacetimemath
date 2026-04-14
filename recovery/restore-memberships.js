#!/usr/bin/env node
// Restore classroom_members from backup using admin_restore_membership_for.
// Must be run after bootstrapping server admin (Lars = 0xc20084a5...).
// Usage: node recovery/restore-memberships.js [--dry-run] [--backup <dir>]

const { readFileSync, readdirSync } = require('fs');
const { resolve } = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const DB = 'spacetimemath';
const SERVER = 'https://maincloud.spacetimedb.com';

// Lars's token (admin identity)
const LARS_TOKEN = readFileSync(resolve(__dirname, 'backups/2026-04-14_08-04-11/recovery_keys.txt'), 'utf8')
  .split('\n')
  .find(l => l.includes('0xc20084a59f18c9e3041c9fa7c9daf02eab677b5e1caf885926fec0b7418ea5d4'))
  ?.split('|')[2]?.trim().replace(/^"|"$/g, '');

if (!LARS_TOKEN) { console.error('Could not find Lars token'); process.exit(1); }

// Convert hex identity string to JSON for the HTTP API.
// SpaceTimeDB Identity is a 1-element product type wrapping a 256-bit hex integer.
function identityToJson(hex) {
  const normalized = hex.startsWith('0x') ? hex : `0x${hex}`;
  return [normalized]; // 1-element tuple containing the hex string
}

async function callReducer(reducer, args, token) {
  const url = `${SERVER}/v1/database/${DB}/call/${reducer}`;
  if (DRY_RUN) {
    console.log(`  [DRY] ${reducer}(${JSON.stringify(args).slice(0, 100)})`);
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

let backupDir;
const bdIdx = process.argv.indexOf('--backup');
if (bdIdx !== -1 && process.argv[bdIdx + 1]) {
  backupDir = resolve(process.argv[bdIdx + 1]);
} else {
  const backupsRoot = resolve(__dirname, 'backups');
  const dirs = readdirSync(backupsRoot).sort();
  backupDir = resolve(backupsRoot, dirs[dirs.length - 1]);
}
console.log(`Using backup: ${backupDir}\n`);

const text = readFileSync(resolve(backupDir, 'classroom_members.txt'), 'utf8');
const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
const rows = lines.slice(2).filter(l => l.trim() && !/^[-+]+$/.test(l.trim())).map(line => {
  const parts = line.split('|').map(s => s.trim());
  return {
    classroom_id: parseInt(parts[1], 10),
    identity: parts[2],
    hidden: parts[3] === 'true',
  };
});

console.log(`Restoring ${rows.length} classroom memberships...\n`);

async function main() {
  let ok = 0, fail = 0;
  for (const row of rows) {
    try {
      await callReducer('admin_restore_membership_for', [
        identityToJson(row.identity),
        row.classroom_id,
        row.hidden,
      ], LARS_TOKEN);
      ok++;
      process.stdout.write(`\r  ${ok}/${rows.length} ok, ${fail} failed`);
    } catch (e) {
      console.error(`\n  FAIL classroom=${row.classroom_id} identity=${row.identity}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

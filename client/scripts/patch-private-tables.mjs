#!/usr/bin/env node
/**
 * Patches client/src/module_bindings/index.ts after `spacetime generate`.
 *
 * Patch 1 – accessor fix:
 *   SpaceTimeDB CLI generates btree index entries without the `accessor` field
 *   that the runtime SDK requires. This adds `accessor: <firstColumn>` to every
 *   index definition that is missing it.
 *
 * Patch 2 – private tables (stub):
 *   As of ACCT-03/ACCT-04: both restore_results and class_recovery_results were
 *   made public (SpacetimeDB 2.0.3 limitation). Codegen handles them now.
 *   Kept as a stub so the Makefile doesn't need updating.
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(__dirname, '../src/module_bindings/index.ts');

let src = readFileSync(INDEX, 'utf8');

// Patch 1: add `accessor` to every btree index that is missing it.
// Generated pattern (multi-line):
//   { name: 'foo', algorithm: 'btree', columns: [
//     'barBaz',
//   ] }
// Required: add  accessor: 'barBaz',  as first field.
let patchCount = 0;
src = src.replace(
  /\{ name: '([^']+)', algorithm: 'btree', columns: \[\s*\n\s*'([^']+)',?\s*\n\s*\] \}/g,
  (_match, name, col) => {
    patchCount++;
    return `{ accessor: '${col}', name: '${name}', algorithm: 'btree', columns: [\n        '${col}',\n      ] }`;
  }
);

writeFileSync(INDEX, src, 'utf8');
console.log(`✓ patch-accessor: added 'accessor' field to ${patchCount} btree index definitions`);
console.log('✓ patch-private-tables: no private table patches needed (all result tables are public)');

#!/usr/bin/env node
/**
 * Patches client/src/module_bindings/index.ts after `spacetime generate`
 * to re-add hand-written private table registrations that codegen removes.
 *
 * As of ACCT-03/ACCT-04 fixes: both restore_results and class_recovery_results
 * were made public (SpacetimeDB 2.0.3 limitation: private tables cannot push
 * rows to subscribers). Codegen now handles both automatically.
 *
 * This script is kept as a no-op stub so the Makefile doesn't need updating.
 * If new private tables are added in the future, add their patches here.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(__dirname, '../src/module_bindings/index.ts');

// Verify index.ts exists and is readable
readFileSync(INDEX, 'utf8');

console.log('✓ patch-private-tables: no private table patches needed (all result tables are public)');

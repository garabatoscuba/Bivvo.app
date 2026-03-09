/* Patch Dexie types for TypeScript compatibility.
   Dexie currently ships `export declare module Dexie { ... }` which newer TS versions
   treat as an error (TS1540). This script replaces it with `export declare namespace Dexie { ... }`.
*/

const fs = require('node:fs');
const path = require('node:path');

const dexieDtsPath = path.join(process.cwd(), 'node_modules', 'dexie', 'dist', 'dexie.d.ts');

function patch() {
  if (!fs.existsSync(dexieDtsPath)) {
    console.warn('[patch-dexie-types] dexie.d.ts not found:', dexieDtsPath);
    return;
  }

  const original = fs.readFileSync(dexieDtsPath, 'utf8');
  const patched = original.replace(
    /export\s+declare\s+module\s+Dexie\s*\{/g,
    'export declare namespace Dexie {'
  );

  if (patched === original) {
    console.log('[patch-dexie-types] no changes needed');
    return;
  }

  fs.writeFileSync(dexieDtsPath, patched, 'utf8');
  console.log('[patch-dexie-types] patched dexie.d.ts');
}

patch();

// Bump the repo-root VERSION file (the single source of truth for the app
// version, read by vite.config.ts and sync-version.mjs). Run BEFORE merging to
// a release branch; CI/build only read VERSION.
//
//   node scripts/bump-version.mjs [patch|minor]   (default: patch)
//     patch -> 1.0.3 -> 1.0.4   (build/fix; backward-compatible)
//     minor -> 1.0.3 -> 1.1.0   (breaking / DB-schema change; compat boundary)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const part = process.argv[2] ?? 'patch';
if (part !== 'patch' && part !== 'minor') {
  console.error('usage: node scripts/bump-version.mjs [patch|minor]');
  process.exit(2);
}
const file = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'VERSION');
const [major, minor, patch] = readFileSync(file, 'utf-8').trim().split('.').map(Number);
const next = part === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
writeFileSync(file, next + '\n');
console.log(next);

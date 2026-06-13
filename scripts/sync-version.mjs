// Single-source the desktop app version.
//
// package.json is the ONE source of truth for the version. This script copies
// that value into the two other files that also carry it — src-tauri/tauri.conf.json
// (drives the installer/bundle version) and src-tauri/Cargo.toml (the Rust crate
// version) — so they cannot drift. Cargo.lock is updated automatically by the
// next `cargo build`.
//
// Runs as the first step of `pnpm build`, which is also Tauri's
// `beforeBuildCommand`, so the Rust files are synced before cargo compiles.
// See pragna2-api/docs/architecture/version-compatibility.md (§7).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8')).version;
if (!version) {
  console.error('[sync-version] package.json has no "version"');
  process.exit(1);
}

/** Write only when the content actually changed (keeps git diffs/mtimes clean). */
function writeIfChanged(path, next, prev) {
  if (next !== prev) {
    writeFileSync(path, next);
    console.log(`[sync-version] updated ${path.replace(root + '/', '')}`);
  }
}

// tauri.conf.json — the top-level "version" field (first match).
const confPath = resolve(root, 'src-tauri/tauri.conf.json');
const confPrev = readFileSync(confPath, 'utf-8');
const confNext = confPrev.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`);
writeIfChanged(confPath, confNext, confPrev);

// Cargo.toml — the [package] version line (only line that starts with `version =`).
const cargoPath = resolve(root, 'src-tauri/Cargo.toml');
const cargoPrev = readFileSync(cargoPath, 'utf-8');
const cargoNext = cargoPrev.replace(/^version = "[^"]*"$/m, `version = "${version}"`);
writeIfChanged(cargoPath, cargoNext, cargoPrev);

console.log(`[sync-version] desktop version is ${version}`);

// Single-source the desktop app version.
//
// The repo-root VERSION file is the ONE source of truth (bumped before each
// release). This script copies that value into the files that also carry it —
// src-tauri/tauri.conf.json (drives the installer/bundle version) and
// src-tauri/Cargo.toml (the Rust crate version) — so they cannot drift.
// Cargo.lock is updated automatically by the next `cargo build`.
//
// Runs as the first step of `pnpm build`, which is also Tauri's
// `beforeBuildCommand`, so the Rust files are synced before cargo compiles.
// See nexus-kit-api/docs/architecture/version-compatibility.md.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const version = readFileSync(resolve(root, 'VERSION'), 'utf-8').trim();
if (!version) {
  console.error('[sync-version] VERSION file is empty');
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

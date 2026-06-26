// Manual release bump for the desktop app (it has no CI — releases are built
// locally with `tauri build`). Bumps the PATCH (build) digit in package.json,
// propagates it to the Rust/Tauri version files via sync-version.mjs, then
// commits and tags vX.Y.Z. Cargo.lock is refreshed by the next cargo build.
//
//   pnpm release
//
// (For a MINOR / compatibility bump — a DB or breaking change — edit the version
// by hand instead; see nexus-kit-api/docs/architecture/version-compatibility.md.)

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(root, 'package.json');

const current = JSON.parse(readFileSync(pkgPath, 'utf-8')).version;
const [major, minor, patch] = current.split('.').map((n) => parseInt(n, 10));
if ([major, minor, patch].some(Number.isNaN)) {
  console.error(`[release] package.json version is not X.Y.Z: ${current}`);
  process.exit(1);
}
const next = `${major}.${minor}.${patch + 1}`;

// Bump package.json with a targeted replace so the file's formatting is kept.
writeFileSync(
  pkgPath,
  readFileSync(pkgPath, 'utf-8').replace(/("version":\s*)"[^"]*"/, `$1"${next}"`),
);

const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

// Propagate to src-tauri/tauri.conf.json + Cargo.toml, then commit + tag.
run('node scripts/sync-version.mjs');
run('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml');
run(`git commit -m "chore(release): v${next}"`);
run(`git tag "v${next}"`);

console.log(`[release] desktop bumped ${current} -> ${next} and tagged v${next}`);

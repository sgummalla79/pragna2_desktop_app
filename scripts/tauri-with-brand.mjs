// Cross-platform wrapper: run a Tauri command with the build-time brand overlay.
//
// Usage: `pnpm tauri:brand dev` / `pnpm tauri:brand build` (any tauri args).
//
// It first generates the Tauri brand artifacts (icons + brand config) from the
// git-ignored `branding/` overlay, then spawns `tauri <args>`, appending
// `--config branding/tauri.brand.conf.json` ONLY when that file was produced.
// With no overlay it is exactly `pnpm tauri <args>` — stock Pragna.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { applyBranding } from './apply-branding.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const passthroughArgs = process.argv.slice(2); // e.g. ["build"] or ["dev", "--", ...]

const brandConfPath = applyBranding();
const args = ['exec', 'tauri', ...passthroughArgs];
if (brandConfPath) {
  // Tauri merges this over tauri.conf.json + the platform config.
  args.push('--config', relative(root, brandConfPath));
}

execFileSync('pnpm', args, { cwd: root, stdio: 'inherit' });

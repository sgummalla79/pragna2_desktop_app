import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load `e2e/.env` into `process.env` so the suite is configured by an env file —
 * exactly like the desktop client's `VITE_*` `.env`. Fill `e2e/.env` (from
 * `e2e/.env.example`) once, then `npm test`; no per-run `export`s.
 *
 * Rules:
 * - Already-set (shell-exported) vars WIN — so CI / a one-off `E2E_FOO=… npm test`
 *   override the file without editing it.
 * - `KEY=VALUE`; blank lines and `#` comments ignored; surrounding quotes stripped.
 * - Loaded from `playwright.config.ts` (the earliest module Playwright evaluates,
 *   in both the main process and each worker), so every helper that reads
 *   `process.env.E2E_*` at import time sees the file's values.
 *
 * `e2e/.env` is gitignored (it holds the Auth0 password + LLM key); only the
 * committed `e2e/.env.example` documents the knobs.
 */
export function loadEnvFile(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.join(here, '..', '.env');
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

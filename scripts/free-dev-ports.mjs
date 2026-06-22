// Cross-platform best-effort cleanup of the Tauri dev ports + stray dev app.
//
// Why: the Vite dev server uses strictPort (:1420 — see vite.config.ts), so a
// leftover instance (an e2e FE server, or a previous run whose window was
// force-quit) makes a new `tauri dev` fail with "Port 1420 is already in use".
// This is the shared, cross-platform equivalent of the clean step in
// scripts/dev-clean.sh (macOS/Linux) and scripts/dev-clean.ps1 (Windows), used
// by the brand wrapper (tauri-with-brand.mjs) so `pnpm tauri:brand dev` is
// self-cleaning on every OS a brander builds on.

import { execSync } from 'node:child_process';
import process from 'node:process';

// Dev ports — must mirror vite.config.ts (server.port 1420 strictPort, hmr 1421).
// Tauri requires a fixed dev port, so these are intentional literals, kept in
// lockstep with the Vite config (the single source of truth for the port).
const DEV_PORTS = [1420, 1421];
// The Tauri dev app's process name = the src-tauri Cargo bin name (tauri.conf.json
// productName / Cargo bin). Exact-name matching only, so it never matches this
// repo's directory of the same name.
const APP_BIN = 'pragna2_desktop_app';

/** Run a shell command best-effort; swallow non-zero exit (nothing to kill). */
function runQuiet(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return '';
  }
}

/** Free the dev ports + close any stray dev app on Windows (PowerShell). */
function freeOnWindows() {
  const portList = DEV_PORTS.join(',');
  const ps = [
    `$ErrorActionPreference='SilentlyContinue'`,
    `Get-Process -Name '${APP_BIN}' -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue`,
    `Get-NetTCPConnection -LocalPort ${portList} -State Listen -EA SilentlyContinue |`,
    `  Select-Object -ExpandProperty OwningProcess -Unique |`,
    `  ForEach-Object { if ($_) { Stop-Process -Id $_ -Force -EA SilentlyContinue } }`,
  ].join(' ');
  runQuiet(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps}"`);
}

/** Free the dev ports + close any stray dev app on macOS/Linux (lsof/pkill). */
function freeOnUnix() {
  // Close the Tauri dev app window/process (exact-name match, safe).
  runQuiet(`pkill -x '${APP_BIN}'`);
  // Free each dev port by killing whatever is LISTENing on it.
  for (const port of DEV_PORTS) {
    const pids = runQuiet(`lsof -ti tcp:${port} -sTCP:LISTEN`).trim();
    if (pids) {
      runQuiet(`kill ${pids.split(/\s+/).join(' ')}`);
    }
  }
}

/**
 * Free the Tauri dev ports and close any stray dev app, cross-platform.
 * Best-effort: never throws, so it is safe to call before starting dev.
 */
export function freeDevPorts() {
  if (process.platform === 'win32') {
    freeOnWindows();
  } else {
    freeOnUnix();
  }
}

// Allow running directly: `node scripts/free-dev-ports.mjs`.
if (import.meta.url === `file://${process.argv[1]}`) {
  freeDevPorts();
}

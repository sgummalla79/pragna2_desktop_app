#!/usr/bin/env bash
# Kill any running Pragna dev instance, then start a clean `pnpm tauri dev`.
#
# Why: the Vite dev server uses strictPort (:1420) — a leftover instance (e.g. an
# e2e FE server, or a previous run whose window was force-quit) makes a new
# `tauri dev` fail with "Port 1420 is already in use". This frees the dev ports
# and closes any stray Tauri dev window first.
#
# macOS / Linux. Windows: use scripts/dev-clean.ps1.
# Run via: pnpm dev:clean   (or: bash scripts/dev-clean.sh)
set -uo pipefail

cd "$(dirname "$0")/.."

# Vite dev port + HMR port (see vite.config.ts: server.port 1420 strictPort, hmr 1421).
PORTS=(1420 1421)
# The Tauri dev app's process name = the src-tauri Cargo bin name. `pkill -x`
# matches the EXACT process name (not the cmdline), so it never matches this
# script's own path (the repo dir is also named pragna2_desktop_app).
APP_BIN="pragna2_desktop_app"

free_port() {
  local port="$1" pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "  freeing :$port → $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
}

echo "▶ Cleaning up any running Pragna dev instance…"
# Close the Tauri dev app window/process (exact-name match, safe).
pkill -x "$APP_BIN" 2>/dev/null && echo "  killed app process: $APP_BIN" || true
# Free the dev ports (kills the Vite server holding :1420).
for p in "${PORTS[@]}"; do free_port "$p"; done

# Give them a moment to release the socket, then hard-kill any stragglers.
sleep 1
for p in "${PORTS[@]}"; do
  pids="$(lsof -ti tcp:"$p" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "  force-freeing :$p → $pids"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
done

echo "▶ Starting clean: pnpm tauri dev"
exec pnpm tauri dev

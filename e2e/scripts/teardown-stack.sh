#!/usr/bin/env bash
# Reverse of setup-stack.sh: stop the desktop FE + BE and drop the throwaway
# Postgres container. No working-tree patch to revert (the desktop e2e harness
# applies none), so this is a clean process + container stop.
set -euo pipefail

PG_NAME="${E2E_PG_CONTAINER:-pragna-desktop-e2e}"

step() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }

step "Stopping FE + BE"
pkill -f "vite" 2>/dev/null && echo "  vite stopped" || echo "  (vite not running)"
pkill -f "uvicorn.*src.presentation" 2>/dev/null && echo "  uvicorn stopped" || echo "  (uvicorn not running)"

step "Removing throwaway Postgres container"
docker rm -f "$PG_NAME" >/dev/null 2>&1 && echo "  $PG_NAME removed" || echo "  (no $PG_NAME container)"

printf "\n\033[1;32m✔ Teardown complete.\033[0m\n\n"

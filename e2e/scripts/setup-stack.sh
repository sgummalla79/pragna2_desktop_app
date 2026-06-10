#!/usr/bin/env bash
# Spin up the full desktop-e2e stack: throwaway Postgres, BE (local-auth
# strategy), and the desktop FE dev server in BROWSER-FALLBACK mode (vite on
# :1420). Registers a test user and seeds a flow-eligible model + default agent.
#
# Unlike the web app's setup, NO auth-strategy patch is applied: the desktop
# tests authenticate via a seeded token (see e2e/helpers/tokens.ts), not the
# login form, so the wired Auth0Repository is never exercised for login.
#
# Idempotent on re-run (re-creates the container, restarts processes).
# Companion: scripts/teardown-stack.sh.
set -euo pipefail

cd "$(dirname "$0")/.."
HERE="$PWD"

BE_REPO="${E2E_BE_REPO:-/Users/sgummalla/Desktop/work/repos/pragna2-api}"
FE_REPO="${E2E_FE_REPO:-/Users/sgummalla/Desktop/work/repos/pragna2_desktop_app}"
PG_NAME="${E2E_PG_CONTAINER:-pragna-desktop-e2e}"
DB_NAME="${E2E_PG_DB:-pragna_it}"
PG_PORT="${E2E_PG_PORT:-5433}"
BE_PORT="${E2E_BE_PORT:-8000}"
FE_PORT="${E2E_FE_PORT:-1420}"

# Real provider keys live in ONE file so the same file can be sourced before
# `pnpm test` too (the spec skip-guards just check that a real key is present).
# Which provider gets SEEDED this run is chosen by E2E_PROVIDER (default
# anthropic); the matching key is picked from the file below. Holds all three:
#   E2E_ANTHROPIC_API_KEY=sk-ant-...
#   E2E_OPENAI_API_KEY=sk-...
#   E2E_GOOGLE_API_KEY=AIza...
KEYS_FILE="${E2E_KEYS_FILE:-/tmp/e2e-keys.env}"
if [ -f "$KEYS_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$KEYS_FILE"
  set +a
fi

PROVIDER_API_NAME="${E2E_PROVIDER:-anthropic}"
case "$PROVIDER_API_NAME" in
  anthropic) ACTIVE_KEY="${E2E_ANTHROPIC_API_KEY:-}" ;;
  openai)    ACTIVE_KEY="${E2E_OPENAI_API_KEY:-}" ;;
  google)    ACTIVE_KEY="${E2E_GOOGLE_API_KEY:-}" ;;
  *)         ACTIVE_KEY="" ;;
esac

# Export the DB coordinates so seed-model.sh (a child) targets the same
# container/db without re-deriving the defaults.
export E2E_PG_CONTAINER="$PG_NAME"
export E2E_PG_DB="$DB_NAME"
export E2E_PG_PORT="$PG_PORT"
export E2E_BE_REPO="$BE_REPO"

step() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }
fatal() { printf "\033[1;31m✖ %s\033[0m\n" "$*"; exit 1; }

# ── 1. Fresh isolated Postgres ────────────────────────────────────────
step "1. Fresh isolated Postgres on :$PG_PORT (NOT touching pragna-local-db on :5432)"
docker rm -f "$PG_NAME" >/dev/null 2>&1 || true
# pgvector image (NOT plain postgres): the BE migrations create the `vector`
# extension for embedding columns, which the stock postgres image lacks.
docker run -d --name "$PG_NAME" \
  -p "$PG_PORT:5432" \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB="$DB_NAME" \
  pgvector/pgvector:pg16 >/dev/null
for i in $(seq 1 15); do
  if docker exec "$PG_NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

# ── 2. Migrations ─────────────────────────────────────────────────────
step "2. Applying BE migrations"
(
  cd "$BE_REPO"
  DATABASE_URL="postgresql+asyncpg://postgres:test@localhost:$PG_PORT/$DB_NAME" \
    uv run alembic upgrade head | tail -3
)

# ── 3. Boot BE ────────────────────────────────────────────────────────
step "3. Booting BE (local-auth) on :$BE_PORT"
pkill -f "uvicorn.*src.presentation" 2>/dev/null || true
sleep 1
JWT_SECRET="$(openssl rand -hex 32)"
ENCRYPTION_KEY="$(python3 -c "import secrets; print(secrets.token_hex(32))")"
(
  cd "$BE_REPO"
  DATABASE_URL="postgresql+asyncpg://postgres:test@localhost:$PG_PORT/$DB_NAME" \
    AUTH_STRATEGY=local APP_ENV=dev LOG_LEVEL="${E2E_BE_LOG_LEVEL:-WARNING}" LOKI_URL= LOG_TO_FILE=false \
    JWT_SECRET="$JWT_SECRET" ENCRYPTION_KEY="$ENCRYPTION_KEY" \
    CORS_ORIGINS="http://localhost:$FE_PORT,http://localhost:3000" \
    nohup uv run uvicorn src.presentation.main:app --host 0.0.0.0 --port "$BE_PORT" \
      > /tmp/e2e_desktop_be.log 2>&1 & disown
)
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BE_PORT/api/health" 2>/dev/null || true)
  [ "$code" = "200" ] && break
  sleep 1
done
[ "$code" = "200" ] || fatal "BE didn't come up; see /tmp/e2e_desktop_be.log"

# ── 4. Register the test user ─────────────────────────────────────────
step "4. Registering test user"
USER_RESP=$(curl -s -X POST "http://localhost:$BE_PORT/api/users" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@example.com","name":"Verify","password":"VerifyTest123!"}')
USER_ID=$(printf "%s" "$USER_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
[ -n "$USER_ID" ] || fatal "user registration failed: $USER_RESP"
echo "user_id=$USER_ID"

# ── 5. Seed a flow-eligible model + default agent ─────────────────────
step "5. Seeding a flow-eligible user_model for provider '$PROVIDER_API_NAME'"
if [ -n "$ACTIVE_KEY" ]; then
  ENCRYPTION_KEY="$ENCRYPTION_KEY" \
    bash "$HERE/scripts/seed-model.sh" "$USER_ID" "$ACTIVE_KEY"
else
  bash "$HERE/scripts/seed-model.sh" "$USER_ID"
fi

# ── 6. Boot the desktop FE in browser-fallback mode ───────────────────
step "6. Booting desktop FE (browser mode, vite strictPort) on :$FE_PORT"
pkill -f "vite" 2>/dev/null || true
sleep 1
(
  cd "$FE_REPO"
  VITE_API_BASE_URL="http://localhost:$BE_PORT/api" \
    nohup pnpm dev > /tmp/e2e_desktop_fe.log 2>&1 & disown
)
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FE_PORT/" 2>/dev/null || true)
  [ "$code" = "200" ] && break
  sleep 1
done
[ "$code" = "200" ] || fatal "FE didn't come up; see /tmp/e2e_desktop_fe.log"

printf "\n\033[1;32m✔ Stack up.\033[0m  Run \`npm test\` from this dir to execute the suite.\n"
printf "   When done: \`npm run teardown\` (stops processes, removes container).\n\n"

#!/usr/bin/env bash
# Seed a flow-eligible user_model so the editor's model dropdown isn't
# empty and Save validation passes.
#
# Two modes:
#   (a) dummy-key (default) — `encrypted_api_key = 'dummy'`. Save / Validate
#       reach the editor fine, but any LLM call returns 401. Used by
#       authoring-only tests.
#   (b) real-key (when arg #2 is set) — encrypts the provided API key with
#       the BE's AESCipher using the current $ENCRYPTION_KEY env var, so a
#       runtime LLM call goes through end-to-end. Used by full-stack tests
#       that exercise Act / Assert against a real provider.
#
# Usage:
#   seed-model.sh <user_uuid>              # mode (a)
#   seed-model.sh <user_uuid> <api_key>    # mode (b) — requires ENCRYPTION_KEY
set -euo pipefail

USER_ID="${1:-}"
REAL_API_KEY="${2:-}"
[ -n "$USER_ID" ] || { echo "usage: $0 <user_uuid> [<api_key>]"; exit 2; }

PG_NAME="${E2E_PG_CONTAINER:-pragna-desktop-e2e}"
DB_NAME="${E2E_PG_DB:-pragna_it}"
# Postgres role for psql (throwaway stack: postgres; containerised BE may use its own, e.g. nexus_kit).
PG_USER="${E2E_PG_USER:-postgres}"
PROVIDER_API_NAME="${E2E_PROVIDER:-anthropic}"
# Per-provider default chat model (each is seeded in model_pricing) + the
# human display_name shown in the flow-editor model picker. Override the model
# with E2E_MODEL. Kept here (not the caller) so a bare
# `E2E_PROVIDER=openai npm run setup` picks a sane model + label with no extra
# env. The label is a real human name (NOT the raw api_name slug) so the
# authoring specs that click the picker option by friendly name keep matching.
case "$PROVIDER_API_NAME" in
  openai) DEFAULT_MODEL="gpt-4o";            DEFAULT_LABEL="GPT-4o" ;;
  google) DEFAULT_MODEL="gemini-2.5-flash";  DEFAULT_LABEL="Gemini 2.5 Flash" ;;
  *)      DEFAULT_MODEL="claude-sonnet-4-6"; DEFAULT_LABEL="Claude Sonnet 4.6" ;;
esac
MODEL_API_NAME="${E2E_MODEL:-$DEFAULT_MODEL}"
# The picker label base is shared with the test's E2E_MODEL_LABEL selector so
# the seeded display_name ("<base> (test)") and the option the spec clicks stay
# in lock-step across providers.
MODEL_LABEL="${E2E_MODEL_LABEL:-$DEFAULT_LABEL} (test)"
BE_REPO="${E2E_BE_REPO:-/Users/sgummalla/Desktop/work/repos/pragna2-api}"
# When set, encrypt the real API key INSIDE this BE container with its own
# AESCipher + its own ENCRYPTION_KEY (read from the container's persisted secrets
# file) — so the key never leaves the container and the host needs no BE_REPO/uv
# and no copy of ENCRYPTION_KEY. When unset, fall back to the host BE repo.
BE_CONTAINER="${E2E_BE_CONTAINER:-}"
# Override the in-container secrets file path; default derives from the
# container's $PGDATA (where the BE entrypoint persists the generated key).
BE_SECRETS_FILE="${E2E_BE_SECRETS_FILE:-}"

# ── Compute the value stored in user_providers.encrypted_api_key ────────
# Both modes use the BE's exact AESCipher so the runtime decrypt path resolves.
if [ -n "$REAL_API_KEY" ]; then
  if [ -n "$BE_CONTAINER" ]; then
    # Container-aware: encrypt inside the BE container with ITS key + cipher. The
    # key is read from the container's persisted secrets file; it never reaches
    # the host. Run as root so the secrets file is readable; use the venv python.
    ENCRYPTED_KEY=$(docker exec -u root \
      -e PLAINKEY="$REAL_API_KEY" -e SECRETS_OVERRIDE="$BE_SECRETS_FILE" \
      "$BE_CONTAINER" sh -c '
        SF="${SECRETS_OVERRIDE:-${PGDATA:-/var/lib/postgresql/data/pgdata}/.nexus-kit-secrets.env}"
        KEY=$(grep -hE "^ENCRYPTION_KEY=" "$SF" 2>/dev/null | head -1 | cut -d= -f2-)
        [ -n "$KEY" ] || { echo "seed-model: no ENCRYPTION_KEY in $SF" >&2; exit 1; }
        cd /app && PYTHONPATH=/app ENCKEY="$KEY" /app/.venv/bin/python -c "
import os
from src.infrastructure.crypto.aes_cipher import AESCipher
print(AESCipher(bytes.fromhex(os.environ[\"ENCKEY\"])).encrypt(os.environ[\"PLAINKEY\"]))
"')
  else
    # Host path: encrypt with the BE repo's AESCipher using $ENCRYPTION_KEY (a
    # 64-char hex string → 32 raw bytes).
    [ -n "${ENCRYPTION_KEY:-}" ] || {
      echo "ENCRYPTION_KEY env var is required when a real API key is provided" \
           "(or set E2E_BE_CONTAINER to encrypt in-container)"
      exit 1
    }
    ENCRYPTED_KEY=$(cd "$BE_REPO" && uv run python -c "
import os, sys
from src.infrastructure.crypto.aes_cipher import AESCipher
key_bytes = bytes.fromhex(os.environ['ENCRYPTION_KEY'])
print(AESCipher(key_bytes).encrypt(sys.argv[1]))
" "$REAL_API_KEY")
  fi
  KEY_LABEL="real (encrypted)"
else
  ENCRYPTED_KEY="dummy"
  KEY_LABEL="dummy (LLM calls will 401)"
fi

# ── Resolve provider FK ────────────────────────────────────────────────
PROVIDER_ID="$(docker exec "$PG_NAME" psql -U "$PG_USER" -d "$DB_NAME" -tA -c \
  "SELECT id FROM llm_providers WHERE api_name='$PROVIDER_API_NAME'")"
[ -n "$PROVIDER_ID" ] || { echo "llm_provider '$PROVIDER_API_NAME' not seeded"; exit 1; }

# ── Insert user_provider with the chosen encrypted_api_key ──────────────
docker exec "$PG_NAME" psql -U "$PG_USER" -d "$DB_NAME" >/dev/null -c \
  "INSERT INTO user_providers (id, user_id, llm_provider_id, encrypted_api_key, enabled, archived, metadata)
   VALUES (gen_random_uuid(), '$USER_ID', '$PROVIDER_ID', '$ENCRYPTED_KEY', true, false, '{}'::jsonb)"

UP_ID="$(docker exec "$PG_NAME" psql -U "$PG_USER" -d "$DB_NAME" -tA -c \
  "SELECT id FROM user_providers WHERE user_id='$USER_ID' AND llm_provider_id='$PROVIDER_ID' LIMIT 1")"

# ── Insert the user_model, enabled for both chat and flows ──────────────
docker exec "$PG_NAME" psql -U "$PG_USER" -d "$DB_NAME" >/dev/null -c \
  "INSERT INTO user_models (id, user_id, user_provider_id, api_name, display_name, enabled, available_for_chat, available_for_flows, archived, metadata)
   VALUES (gen_random_uuid(), '$USER_ID', '$UP_ID', '$MODEL_API_NAME', '$MODEL_LABEL', true, true, true, false, '{}'::jsonb)"

# ── Seed the user's default chat agent (agents-table chat-gate, 2026-06-06) ──
# Chat is gated on an is_default=true agent row existing (DefaultAgentFactory
# reads it for the base prompt; the FE disables the chat input + shows a
# "create your default agent" banner when it's absent). A fresh e2e user has
# none, so every live-chat scenario would hit a disabled input. Seed a minimal
# active default so the gate opens. Idempotent: skipped if one already exists.
docker exec "$PG_NAME" psql -U "$PG_USER" -d "$DB_NAME" >/dev/null -c \
  "INSERT INTO agents (id, user_id, api_name, display_name, system_prompt, tools, is_default, status, metadata)
   SELECT gen_random_uuid(), '$USER_ID', 'default-agent', 'Default Agent',
          'You are a helpful assistant.', '[]'::jsonb, true, 'active', '{}'::jsonb
   WHERE NOT EXISTS (
     SELECT 1 FROM agents WHERE user_id='$USER_ID' AND is_default=true AND status<>'archived'
   )"

echo "seeded $MODEL_API_NAME + default agent for user $USER_ID — key: $KEY_LABEL"

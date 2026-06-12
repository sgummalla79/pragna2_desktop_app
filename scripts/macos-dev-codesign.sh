#!/usr/bin/env bash
#
# macOS dev code-signing — give the dev binary a STABLE code signature so the OS
# keychain "Always Allow" grant for the app identifier persists across rebuilds.
#
# Why this exists
# ---------------
# Unsigned / ad-hoc dev builds get a *new* code signature on every relink, so
# macOS treats each launch as a different app and re-prompts for keychain access
# on startup (the refresh-token read, TD-009 / CF-007). Signing with one fixed
# self-signed certificate makes the binary's *designated requirement* constant —
# it is derived from the bundle identifier + the signing certificate, NOT the
# binary hash — so a single "Always Allow" click sticks across every future
# rebuild (as long as the binary is re-signed with this same cert).
#
# This is a LOCAL DEVELOPER convenience only. The cert is self-signed and not
# trusted for distribution; it has no effect on a packaged/notarized release.
# See docs/dev/macos-keychain-signing.md for the full rationale and workflow.
#
# Idempotent: creates the self-signed identity once, then (re)signs the dev
# binary. No-op on non-macOS so it is safe to wire into cross-platform scripts.
set -euo pipefail

# ── Constants ────────────────────────────────────────────────────────────────
# Fixed Common Name of the local self-signed code-signing identity. Kept stable
# so the designated requirement (which embeds this cert) never changes.
CERT_CN="Pragna2 Dev Code Signing"
# Transit password protecting the throwaway .p12 during import ONLY (the file is
# deleted immediately after). Not a secret at rest; required because the macOS
# PKCS#12 importer rejects an empty-password MAC.
P12_TRANSIT_PW="pragna2-dev-transit"

# Only macOS has the keychain ACL behaviour this works around.
if [ "$(uname -s)" != "Darwin" ]; then
  echo "[macos-dev-codesign] not macOS — nothing to do."
  exit 0
fi

# Resolve repo root from this script's location (scripts/ lives at repo root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_CONF="$REPO_ROOT/src-tauri/tauri.conf.json"
CARGO_TOML="$REPO_ROOT/src-tauri/Cargo.toml"

# App identifier and binary name are read from project config — no drift if they
# change in tauri.conf.json / Cargo.toml.
APP_IDENTIFIER="$(node -e 'process.stdout.write(require(process.argv[1]).identifier)' "$TAURI_CONF")"
BIN_NAME="$(grep -m1 '^name' "$CARGO_TOML" | sed -E 's/^name *= *"([^"]+)".*/\1/')"
BIN_PATH="$REPO_ROOT/src-tauri/target/debug/$BIN_NAME"

# ── 1. Ensure the self-signed code-signing identity exists ───────────────────
if security find-identity -p codesigning 2>/dev/null | grep -qF "$CERT_CN"; then
  echo "[macos-dev-codesign] signing identity present: $CERT_CN"
else
  echo "[macos-dev-codesign] creating self-signed code-signing identity: $CERT_CN"
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT
  openssl req -x509 -newkey rsa:2048 -keyout "$WORK/key.pem" -out "$WORK/cert.pem" \
    -days 3650 -nodes -subj "/CN=$CERT_CN" \
    -addext "basicConstraints=critical,CA:false" \
    -addext "keyUsage=critical,digitalSignature" \
    -addext "extendedKeyUsage=critical,codeSigning" >/dev/null 2>&1
  # -legacy → PKCS#12 MAC/cipher the macOS Security framework importer can verify.
  openssl pkcs12 -export -legacy -inkey "$WORK/key.pem" -in "$WORK/cert.pem" \
    -out "$WORK/cert.p12" -passout "pass:$P12_TRANSIT_PW" -name "$CERT_CN" >/dev/null 2>&1
  # -A → key usable by codesign without a per-use prompt (acceptable for a local
  # dev-only signing key).
  security import "$WORK/cert.p12" -k "$HOME/Library/Keychains/login.keychain-db" \
    -P "$P12_TRANSIT_PW" -A >/dev/null
  echo "[macos-dev-codesign] identity created in the login keychain."
fi

# ── 2. Sign the dev binary ───────────────────────────────────────────────────
if [ ! -f "$BIN_PATH" ]; then
  echo "[macos-dev-codesign] dev binary not found: $BIN_PATH" >&2
  echo "                     build it first — e.g. 'cargo build --manifest-path src-tauri/Cargo.toml' or run 'pnpm tauri dev' once." >&2
  exit 1
fi

codesign --force --sign "$CERT_CN" --identifier "$APP_IDENTIFIER" "$BIN_PATH"
codesign --verify "$BIN_PATH"
echo "[macos-dev-codesign] signed '$BIN_NAME' as '$APP_IDENTIFIER' with '$CERT_CN'."
echo "[macos-dev-codesign] On the FIRST launch click \"Always Allow\" on the keychain prompt — it will not ask again."

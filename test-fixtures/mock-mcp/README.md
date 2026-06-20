# Mock MCP Server Fixture

A **deterministic stdio MCP server** used only by tests. It lets the desktop's
client-delegated (stdio) MCP host (`src-tauri/src/platform/mcp_registry.rs`,
`src-tauri/src/application/mcp_host.rs`) be exercised end-to-end against a real
subprocess speaking the MCP protocol — discovery, tool calls, auth-required
classification, and the `auth` re-auth subprocess.

This README is the fixture's technical spec (the knob protocol + the Node↔Rust
equivalence contract). It is referenced by the integration tests (WI-2), the
#158 smoke (WI-4), and the cross-repo remote/OAuth work (WI-5).

## Isolation

This fixture is **fully self-contained and touches no production code.** It is a
sibling of `e2e/`, with its own projects:

- `node/` — Node mock on the official `@modelcontextprotocol/sdk` (own `package.json`).
- `rust/` — a **standalone** crate (own `Cargo.toml`, **not** a member of the
  `src-tauri` crate/workspace). The `rmcp` *server* feature lives here only, so the
  production desktop crate stays client-only.

Both impls are driven by ONE declarative spec and kept behaviorally equivalent by
the conformance harness (`node/equivalence.mjs`).

## The behavior spec

The spec is the single source of truth both impls deserialize:
`spec/schema.ts` (TypeScript) and `spec/schema.rs` (serde) are kept in lockstep.
Canonical specs live in `spec/presets/*.json`.

A mock receives its spec via the **`MOCK_MCP_SPEC`** env var, which is EITHER an
absolute path to a preset JSON file OR an inline JSON string (impls read it as a
file first, then fall back to parsing it as a literal).

```jsonc
{
  "serverName": "mock-mcp",
  "startupDelayMs": 0,            // delay the initialize handshake (probe STARTUP_TIMEOUT)
  "tools": [{
    "name": "search",
    "description": "...",
    "inputSchema": { "type": "object", "properties": { "query": { "type": "string" } } },
    "responses": [{               // ordered; Nth call uses responses[min(N, len-1)]
      "kind": "result",           // result | error | authError
      "callDelayMs": 0,           // delay tools/call (probe CALL_TIMEOUT)
      "content": "ok: 7 rows",
      "signal": "invalid_grant",  // authError: substring the host classifies as auth
      "providerInError": "gus",   // authError: emit "for provider 'gus'" for service extraction
      "channel": "isError"        // isError (default) | raisedError
    }]
  }],
  "auth": { "exitCode": 0, "requireProvider": "gus" }  // `auth` subcommand behavior
}
```

### Modes (both impls)

- `mock-mcp [serve]` — run the stdio MCP server.
- `mock-mcp auth [--provider X]` — emulate the host's re-auth subprocess
  (`<command> auth --provider <svc>`, see `mcp_host::auth`). Exits non-zero when
  `requireProvider` is set and `--provider` doesn't match; otherwise exits with
  `auth.exitCode`.

Both mocks are usable as a SINGLE executable command (the Node bin has a shebang +
is `chmod +x`), which the re-auth path requires — the host runs `<command> auth …`
using the launch `command` only (no args).

## Presets

| Preset | What it drives in the host |
|---|---|
| `normal-result` | `DelegatedCallOutcome::Result` |
| `tool-error` | non-auth `isError` body → `Result` (must NOT misclassify as auth) |
| `auth-signal-401` / `auth-signal-invalid-grant` | `AuthRequired` via `AUTH_ERROR_RESULT_SIGNALS` |
| `auth-provider-extract` | `service_from_error_text` → `AuthRequired{service:Some("gus")}` |
| `auth-raised-error` | the raised-error auth-classification branch |
| `multi-tool` | `discover` lists N tools; per-tool `call` |
| `startup-delay` / `call-delay` | host `STARTUP_TIMEOUT` / `CALL_TIMEOUT` → `Timeout` |
| `reauth-success` / `reauth-failure` | `mcp_host::auth` / `reauth` Ok vs `Protocol` |

## Run it

```sh
# Node mock
cd node && npm install
MOCK_MCP_SPEC=../spec/presets/normal-result.json ./bin/mock-mcp.mjs serve

# Rust mock
cd rust && cargo build
MOCK_MCP_SPEC=../spec/presets/normal-result.json ./target/debug/mock_mcp_server serve

# Conformance snapshot of one server (acts as an MCP client)
cd node && node conformance.mjs --command ./bin/mock-mcp.mjs

# Node<->Rust behavioral equivalence (build the Rust mock first)
cd node && node equivalence.mjs
```

## Consumers (other WIs)

- **WI-2** — Rust host integration tests under `src-tauri/tests/` spawn a mock by
  command (`MOCK_MCP_SPEC=<preset>`), default the Node bin; the Rust bin is the
  hermetic option.
- **WI-4** — the #158 real-Tauri smoke uses `normal-result` as a deterministic
  client-delegated connector; the e2e discovery spec stubs the discovery bridge.
- **WI-5** (cross-repo, `pragna2-api`) — `remote/` (a Node remote MCP server +
  mock OAuth authorization server) is built for the backend session to consume.

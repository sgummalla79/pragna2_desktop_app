# pragna2 desktop — end-to-end browser tests

Self-contained Playwright suite for the **desktop** frontend, run in
**browser-fallback mode**. Lives as its own sub-workspace (its own
`package.json`, deps NOT in the root) so a casual dev doesn't pay the
Chromium download cost.

## Why browser mode (and not a Tauri window)

The desktop app is a Tauri shell, but the same React frontend also runs in a
plain browser via `pnpm dev` (Vite on **:1420**). In the browser:

- the axios client uses the default **XHR adapter** (not Tauri's native HTTP) —
  so the BE must allow the FE origin via `CORS_ORIGINS` (setup does this);
- `AuthService.bootstrap()` reads the access token from **sessionStorage**
  first, and `Auth0Repository.me()` resolves the user by **decoding the ID token
  locally** (`userFromIdToken`) — no Auth0 round-trip, no Tauri runtime.

So these tests carry the full web-parity coverage on every platform incl. the
dev Mac. The native seam (keychain, native HTTP, loopback OAuth) that only a
real Tauri window can exercise is **deferred** — see pragna2-tracker **pragna2-tracker TD-028**
(it can't run via the official `tauri-driver` on macOS).

## ⚠️ Browser-fallback runs with a WINDOWS user-agent

Playwright's `devices['Desktop Chrome']` sends a **Windows** UA
(`Windows NT 10.0; Win64; x64`). So in every spec `isWindowsPlatform()` is `true`
but `isTauriRuntime()` is `false`. Two consequences you MUST keep in mind:

1. **The suite always renders the DEFAULT (non-Windows) chrome.** All OS-conditional
   UI is gated on `usesWindowsChrome()` (= Windows **and** Tauri), which is `false`
   here. So the **Windows-native chrome/layout cannot be e2e-tested** — cover it with
   the component unit tests (mock `usesWindowsChrome` both ways) instead. The real
   Windows window is pragna2-tracker TD-028.
2. **Never gate UI on a UA-only check** (`isWindowsPlatform()` alone) and never call a
   Tauri-only API at render unguarded — a Windows-UA browser with no Tauri runtime will
   crash to a blank page (this is what **CF-011** fixed; the whole suite went blank).
   Run `pnpm lint:platform` in the FE repo to catch reintroductions.

## Auth = seed token (no login form)

The desktop's wired auth repository is `Auth0Repository`, whose `login()` POSTs
to an Auth0 tenant — not our local BE. We never drive it. Instead
`global-setup.ts` logs in **once** against the local BE
(`POST /api/auth/sessions`) to obtain a real access-token JWT, mints a decodable
ID token carrying `sub`/`email`/`name`, and writes both to `.auth/tokens.json`.
The `fixtures.ts` test fixture injects them into **sessionStorage**
(`pragna_at`/`pragna_idt`) via `addInitScript` before any page script runs, so
every test boots already authenticated.

(`storageState` can't carry this — it only persists localStorage + cookies, and
`tokenStorage` uses sessionStorage.)

### Running against a real Auth0 BE (e.g. the :8001 Docker container)

The default flow above needs a BE running `AUTH_STRATEGY=local` (it POSTs
email/password to `/api/auth/sessions`). Under `AUTH_STRATEGY=auth0` that endpoint
is `NotImplementedError` — Auth0 login happens on the frontend. To run the suite
as a **real Auth0 user** against an `auth0` BE, set `E2E_AUTH_MODE=auth0`:
`global-setup.ts` then fetches a genuine token pair from the tenant via
Resource-Owner-Password-Grant (`helpers/tokens.ts` → `mintAuth0Tokens`). Required
env (all from the environment — never commit credentials):

```
E2E_AUTH_MODE=auth0
E2E_AUTH0_DOMAIN / E2E_AUTH0_CLIENT_ID / E2E_AUTH0_AUDIENCE   # tenant + SPA client
E2E_AUTH0_USERNAME / E2E_AUTH0_PASSWORD                       # the test user
E2E_TEST_EMAIL / E2E_TEST_NAME      # so the DB seeders resolve the Auth0 user's row
E2E_BE_URL=http://localhost:8001
E2E_PG_CONTAINER=pragna2-api  E2E_PG_DB=pragna2   # redirect the psql helper at the
                                                  # all-in-one container's in-process DB
```

Caveats: the in-container DB has no host port, so the PDF-render seeder
(`scenario-20`) can't run; exclude it and the long PDF (`scenario-21`). See the
project memory `run-desktop-e2e-against-auth0-8001` for the full procedure.

## Layout

```
e2e/
├── package.json                # Playwright + TypeScript only
├── playwright.config.ts        # baseURL=http://localhost:1420; globalSetup mints the token
├── tsconfig.json               # isolated; root tsc ignores this dir
├── global-setup.ts             # log in once → write .auth/tokens.json
├── fixtures.ts                 # authenticated `test`/`expect` (seeds sessionStorage)
├── helpers/
│   ├── env.ts                  # FE/BE/API URLs, ports, container name, test creds, token keys
│   └── tokens.ts               # mint + read/write the seed token pair
├── tests/
│   └── smoke-auth.spec.ts      # Phase-1 proof: seeded token boots into authenticated /chat
└── scripts/
    ├── setup-stack.sh          # PG + migrations + BE (local-auth) + register user + seed model/agent + FE
    ├── teardown-stack.sh       # stop processes + drop container
    └── seed-model.sh           # seed a flow-eligible user_model + default agent
```

## Prerequisites

- Docker running.
- BE repo at `/Users/sgummalla/Desktop/work/repos/pragna2-api` (override with
  `E2E_BE_REPO`), migrations current.
- Python + `uv` installed (BE runs via `uv run uvicorn`).
- Node + pnpm.

## Run

This sub-workspace installs with **npm** (its own `node_modules`, isolated from
the root pnpm workspace — pnpm would otherwise resolve against the root and
ignore this manifest). The root desktop app still uses pnpm; only `e2e/` is npm.

```bash
cd e2e
npm install                        # one-time
npx playwright install chromium    # one-time, ~100 MB
npm run setup                      # spin PG + BE + FE; register user + seed model/agent
npm test                           # run the suite
npm run teardown                   # stop everything
```

Dev loop: `npm run test:headed`, `npm run test:ui`, `npm run report`.

## Real-key (LLM) runs

Specs that exercise a live model self-skip unless a real provider key is
present. Put the keys in `/tmp/e2e-keys.env` (override with `E2E_KEYS_FILE`):

```bash
# /tmp/e2e-keys.env
E2E_ANTHROPIC_API_KEY=sk-ant-...
E2E_OPENAI_API_KEY=sk-...
E2E_GOOGLE_API_KEY=AIza...
```

`setup-stack.sh` sources this and seeds **one** provider per run (chosen by
`E2E_PROVIDER`, default `anthropic`). Authoring-only specs run keyless.

## Ports / isolation

- FE **:1420** (vite strictPort), BE **:8000**, throwaway Postgres **:5433**
  (container `pragna-desktop-e2e` — never touches `pragna-local-db` on :5432).
- All overridable via `E2E_*` env (see `helpers/env.ts` and `setup-stack.sh`).

/** Shared env defaults for the desktop e2e stack. Overridable via shell env so
 *  CI (or a port clash) can point at a different BE / FE / DB. The desktop FE
 *  dev server is pinned to :1420 (vite.config strictPort), so that is the
 *  default FE_URL — not the web app's :5173. */
export const FE_URL = process.env.E2E_FE_URL ?? 'http://localhost:1420';
export const BE_URL = process.env.E2E_BE_URL ?? 'http://localhost:8000';

/** API root including the `/api` prefix — matches the FE's `API_BASE_URL`
 *  default (`VITE_API_BASE_URL`). The auth-session and `/me` calls hang off
 *  this. */
export const API_BASE_URL = process.env.E2E_API_BASE_URL ?? `${BE_URL}/api`;

export const PG_CONTAINER = process.env.E2E_PG_CONTAINER ?? 'pragna-desktop-e2e';
export const TEST_DB = process.env.E2E_PG_DB ?? 'pragna_it';
/** Postgres role the `docker exec … psql` helper connects as. The throwaway
 *  local stack uses `postgres`; a containerised BE may own its DB under a
 *  different role (e.g. `nexus_kit`). Externalised so neither is hardcoded. */
export const PG_USER = process.env.E2E_PG_USER ?? 'postgres';

/** The test user the suite authenticates and seeds data as. Defaults to the
 *  local-stack seeded user; override via `E2E_TEST_EMAIL` / `E2E_TEST_NAME`
 *  (e.g. when running against an Auth0 BE, set the email to the real Auth0
 *  account so the DB seeders resolve the correct `user_id`). The password is
 *  only used by the local password-login path. */
export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL ?? 'verify@example.com',
  name: process.env.E2E_TEST_NAME ?? 'Verify',
  password: process.env.E2E_TEST_PASSWORD ?? 'VerifyTest123!',
};

/** Auth mode for seed-token minting:
 *  - `'local'` (default): log in against the local BE's password endpoint
 *    (`POST /api/auth/sessions`) — works only when the BE runs
 *    `AUTH_STRATEGY=local`.
 *  - `'auth0'`: fetch a REAL token pair from the Auth0 tenant via the
 *    Resource-Owner-Password-Grant, for running the suite against an
 *    `AUTH_STRATEGY=auth0` BE (e.g. the production Docker container) that
 *    rejects local password login. Selected via `E2E_AUTH_MODE`. */
export const AUTH_MODE = process.env.E2E_AUTH_MODE ?? 'local';

/** Auth0 tenant coordinates + test-user credentials. Used only when
 *  `AUTH_MODE === 'auth0'`. Every value is sourced from the environment — never
 *  hardcoded — so credentials never land in the repo. */
export const AUTH0 = {
  domain: process.env.E2E_AUTH0_DOMAIN ?? '',
  clientId: process.env.E2E_AUTH0_CLIENT_ID ?? '',
  audience: process.env.E2E_AUTH0_AUDIENCE ?? '',
  username: process.env.E2E_AUTH0_USERNAME ?? '',
  password: process.env.E2E_AUTH0_PASSWORD ?? '',
} as const;

/** OPTIONAL model-picker label. The suite must never pin a specific model or
 *  provider — a different provider (Anthropic / Gemini / OpenAI …) can be seeded
 *  on each run, so a hardcoded model name would spuriously fail the flow-editor
 *  model-selection step. When `E2E_MODEL_LABEL` is set, the picker matches that
 *  regex; when it is UNSET (the default), helpers select whatever model is
 *  available (the first option) — see `selectModelOption`. `null` = "no
 *  preference, pick whatever is seeded". */
export const MODEL_PICKER_LABEL: RegExp | null = process.env.E2E_MODEL_LABEL
  ? new RegExp(process.env.E2E_MODEL_LABEL)
  : null;

/** Visible label of the flow-editor model picker's leading "inherit" option
 *  (`FLOW_AGENT_MODEL_INHERIT_LABEL` in `src/constants/flows.ts`). The per-node
 *  chat model is optional (tracker #184/#185): the picker renders this option
 *  FIRST, before the real seeded models, and selecting it leaves the node with
 *  no model (`user_model_id` NULL). `selectModelOption` skips it so the
 *  provider-agnostic "first option" pick lands on a real model. Overridable via
 *  `E2E_MODEL_INHERIT_LABEL` if the FE copy changes. */
export const MODEL_INHERIT_LABEL: string =
  process.env.E2E_MODEL_INHERIT_LABEL ?? 'Use conversation model';

/** sessionStorage keys the FE's `tokenStorage` reads (see
 *  `src/infrastructure/storage/tokenStorage.ts`). The seed fixture writes the
 *  minted tokens under exactly these keys so `AuthService.bootstrap()` restores
 *  the session with no login UI. */
export const TOKEN_KEYS = {
  accessToken: 'pragna_at',
  idToken: 'pragna_idt',
} as const;

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

export const TEST_USER = {
  email: 'verify@example.com',
  name: 'Verify',
  password: 'VerifyTest123!',
};

/** Friendly model label the flow-editor / chat model picker option is matched
 *  by. `seed-model.sh` seeds `user_models.display_name = "<label> (test)"`, so
 *  this substring regex finds the option regardless of provider. Anthropic is
 *  the default-seeded provider; override via `E2E_MODEL_LABEL`. */
export const MODEL_PICKER_LABEL = process.env.E2E_MODEL_LABEL
  ? new RegExp(process.env.E2E_MODEL_LABEL)
  : /Claude Sonnet 4\.6/;

/** sessionStorage keys the FE's `tokenStorage` reads (see
 *  `src/infrastructure/storage/tokenStorage.ts`). The seed fixture writes the
 *  minted tokens under exactly these keys so `AuthService.bootstrap()` restores
 *  the session with no login UI. */
export const TOKEN_KEYS = {
  accessToken: 'pragna_at',
  idToken: 'pragna_idt',
} as const;

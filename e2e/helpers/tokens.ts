/** Seed-token minting + on-disk handoff between `global-setup.ts` (which logs in
 *  once) and the per-test fixture (which injects the tokens into sessionStorage).
 *
 *  Why a seed token instead of driving the login form: the desktop's wired auth
 *  repository is `Auth0Repository`, whose `login()` POSTs to an Auth0 tenant —
 *  not our local BE. But its `me()` decodes the session from the **ID token
 *  locally** (`userFromIdToken`, no network) before ever touching Auth0's
 *  `/userinfo`. So we mint the pair ourselves:
 *    - access token: a REAL local-BE JWT from `POST /api/auth/sessions`, used as
 *      the Bearer on every API call (the local BE validates it).
 *    - ID token: a decodable JWT carrying `sub`/`email`/`name` so `me()` returns
 *      the user with zero network. Its signature is irrelevant — the FE only
 *      base64-decodes the payload (`decodeJwtPayload`). */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { API_BASE_URL, AUTH_MODE, AUTH0, TEST_USER } from './env';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = path.join(HERE, '..', '.auth', 'tokens.json');

export interface SeedTokens {
  accessToken: string;
  idToken: string;
}

/** base64url-encode an object as a JWT segment (no padding, URL-safe). */
function b64urlSegment(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

/** Decode a JWT payload segment to read its claims (e.g. the BE `sub`). Returns
 *  `{}` when the token is malformed — the caller falls back to known test data. */
function decodePayload(jwt: string): Record<string, unknown> {
  try {
    const seg = jwt.split('.')[1];
    if (!seg) return {};
    return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Build a decodable (unsigned) ID token whose `sub` matches the BE user, so the
 *  FE-displayed identity and the API-authenticated identity stay consistent. */
function mintIdToken(sub: string): string {
  const header = b64urlSegment({ alg: 'none', typ: 'JWT' });
  const payload = b64urlSegment({
    sub,
    email: TEST_USER.email,
    name: TEST_USER.name,
  });
  return `${header}.${payload}.seed`;
}

/** Fetch a REAL Auth0 token pair via the Resource-Owner-Password-Grant.
 *  Used when `AUTH_MODE === 'auth0'` so the suite can authenticate against an
 *  `AUTH_STRATEGY=auth0` BE (which rejects local password login): the access
 *  token is a genuine Auth0 JWT the BE validates via JWKS, and the ID token
 *  carries `sub`/`email`/`name` for the FE's local `me()` decode. Throws loud on
 *  missing config or a non-2xx so global setup fails clearly. */
async function mintAuth0Tokens(): Promise<SeedTokens> {
  const required: Record<string, string> = {
    'E2E_AUTH0_DOMAIN': AUTH0.domain,
    'E2E_AUTH0_CLIENT_ID': AUTH0.clientId,
    'E2E_AUTH0_AUDIENCE': AUTH0.audience,
    'E2E_AUTH0_USERNAME': AUTH0.username,
    'E2E_AUTH0_PASSWORD': AUTH0.password,
  };
  for (const [key, value] of Object.entries(required)) {
    if (!value) throw new Error(`E2E_AUTH_MODE=auth0 requires ${key} — set it in the environment`);
  }

  const res = await fetch(`https://${AUTH0.domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'password',
      username: AUTH0.username,
      password: AUTH0.password,
      client_id: AUTH0.clientId,
      audience: AUTH0.audience,
      scope: 'openid profile email',
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Auth0 ROPG login failed: POST /oauth/token → ${res.status} ${res.statusText} ${detail}`);
  }
  const body = (await res.json()) as { access_token?: string; id_token?: string };
  if (!body.access_token || !body.id_token) {
    throw new Error('Auth0 ROPG response missing access_token / id_token');
  }
  return { accessToken: body.access_token, idToken: body.id_token };
}

/** Log in and mint the seed pair. Delegates to the Auth0 tenant when
 *  `AUTH_MODE === 'auth0'`, otherwise to the local BE's session endpoint.
 *  Throws on a non-2xx so a misconfigured stack fails loud in global setup. */
export async function mintSeedTokens(): Promise<SeedTokens> {
  if (AUTH_MODE === 'auth0') return mintAuth0Tokens();

  const res = await fetch(`${API_BASE_URL}/auth/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `seed login failed: POST /auth/sessions → ${res.status} ${res.statusText} ${detail}`,
    );
  }
  const body = (await res.json()) as { access_token?: string };
  const accessToken = body.access_token;
  if (!accessToken) throw new Error('seed login response had no access_token');

  const sub = String(decodePayload(accessToken).sub ?? TEST_USER.email);
  return { accessToken, idToken: mintIdToken(sub) };
}

/** Persist the minted tokens for the per-test fixture to read. */
export function writeTokens(tokens: SeedTokens): void {
  mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
  writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

/** Read the tokens minted by `global-setup.ts`. Throws with a clear hint if the
 *  global setup didn't run (e.g. the file is missing). */
export function readTokens(): SeedTokens {
  try {
    return JSON.parse(readFileSync(TOKENS_FILE, 'utf8')) as SeedTokens;
  } catch {
    throw new Error(
      `no seed tokens at ${TOKENS_FILE} — global-setup.ts must run first (is the stack up via \`pnpm run setup\`?)`,
    );
  }
}

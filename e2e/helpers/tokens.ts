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

import { API_BASE_URL, TEST_USER } from './env';

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

/** Log in against the local BE's session endpoint and mint the seed pair.
 *  Throws on a non-2xx so a misconfigured stack fails loud in global setup. */
export async function mintSeedTokens(): Promise<SeedTokens> {
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

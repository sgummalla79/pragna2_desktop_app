interface JwtPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  email?: string;
  name?: string;
  given_name?: string;
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payloadB64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() / 1000 + bufferSeconds > payload.exp;
}

// Extract a User from an Auth0 ID token without a backend call.
// The ID token contains sub, email, name, and identity provider prefix.
export function userFromIdToken(idToken: string): import('@/domain/types/auth.types').User | null {
  const payload = decodeJwtPayload(idToken);
  if (!payload?.sub) return null;
  const identityProvider = (payload.sub as string).split('|')[0];
  return {
    id: payload.sub as string,
    email: (payload.email as string | undefined) ?? '',
    name: (payload.name as string | undefined) ?? (payload.given_name as string | undefined) ?? null,
    identityProvider,
    settings: {},
  };
}

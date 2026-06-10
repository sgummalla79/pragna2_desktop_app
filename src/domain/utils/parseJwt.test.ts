import { describe, it, expect } from 'vitest';
import { decodeJwtPayload, isTokenExpired, userFromIdToken } from './parseJwt';

/** Build a JWT-shaped string (header.payload.signature) from a payload object. */
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o));
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

describe('decodeJwtPayload', () => {
  it('decodes the payload segment', () => {
    const token = makeJwt({ sub: 'auth0|abc', email: 'a@b.com' });
    expect(decodeJwtPayload(token)).toMatchObject({ sub: 'auth0|abc', email: 'a@b.com' });
  });

  it('returns null when the token is not three segments', () => {
    expect(decodeJwtPayload('a.b')).toBeNull();
    expect(decodeJwtPayload('nodots')).toBeNull();
  });

  it('returns null on a non-decodable / non-JSON payload', () => {
    expect(decodeJwtPayload('h.!!!notbase64!!!.s')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('treats a token without exp as expired', () => {
    expect(isTokenExpired(makeJwt({ sub: 'x' }))).toBe(true);
  });

  it('is false for an exp comfortably in the future', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(isTokenExpired(makeJwt({ exp: future }))).toBe(false);
  });

  it('is true for an exp in the past', () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    expect(isTokenExpired(makeJwt({ exp: past }))).toBe(true);
  });

  it('respects the buffer (near-future exp within buffer counts as expired)', () => {
    const soon = Math.floor(Date.now() / 1000) + 10;
    expect(isTokenExpired(makeJwt({ exp: soon }), 30)).toBe(true);
    expect(isTokenExpired(makeJwt({ exp: soon }), 0)).toBe(false);
  });
});

describe('userFromIdToken', () => {
  it('extracts id/email/name/identityProvider from the sub prefix', () => {
    const user = userFromIdToken(
      makeJwt({ sub: 'google-oauth2|123', email: 'a@b.com', name: 'Ada' }),
    );
    expect(user).toEqual({
      id: 'google-oauth2|123',
      email: 'a@b.com',
      name: 'Ada',
      identityProvider: 'google-oauth2',
      settings: {},
    });
  });

  it('falls back to given_name then null for the name', () => {
    expect(userFromIdToken(makeJwt({ sub: 'auth0|1', given_name: 'Grace' }))?.name).toBe('Grace');
    expect(userFromIdToken(makeJwt({ sub: 'auth0|1' }))?.name).toBeNull();
  });

  it('returns null when sub is absent', () => {
    expect(userFromIdToken(makeJwt({ email: 'a@b.com' }))).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './AuthService';
import type { IAuthRepository } from '@/application/ports/IAuthRepository';

vi.mock('@/infrastructure/storage/tokenStorage', () => ({
  tokenStorage: {
    getAccessToken: vi.fn(),
    getIdToken: vi.fn(),
    setAccessToken: vi.fn(),
    setIdToken: vi.fn(),
    clearAll: vi.fn(),
  },
}));
vi.mock('@/infrastructure/storage/secureStore', () => ({
  secureStore: {
    getRefreshToken: vi.fn(),
    setRefreshToken: vi.fn(),
    clearRefreshToken: vi.fn(),
  },
}));

import { tokenStorage } from '@/infrastructure/storage/tokenStorage';
import { secureStore } from '@/infrastructure/storage/secureStore';

const USER = { id: 'u1', email: 'a@b.com', name: null, identityProvider: 'auth0', settings: {} };
const TOKENS = { accessToken: 'at', idToken: 'it', refreshToken: 'rt' };

function makeRepo(overrides: Partial<IAuthRepository> = {}): IAuthRepository {
  return {
    register: vi.fn().mockResolvedValue(USER),
    login: vi.fn().mockResolvedValue(TOKENS),
    loginWithSocial: vi.fn().mockResolvedValue(TOKENS),
    refresh: vi.fn().mockResolvedValue(TOKENS),
    provisionOAuthUser: vi.fn().mockResolvedValue(USER),
    me: vi.fn().mockResolvedValue(USER),
    fetchSocialConnections: vi.fn().mockResolvedValue([]),
    updateSettings: vi.fn().mockResolvedValue(USER),
    ...overrides,
  } as unknown as IAuthRepository;
}

beforeEach(() => vi.clearAllMocks());

describe('AuthService.login', () => {
  it('stores tokens (access + refresh) and returns user + tokens', async () => {
    const repo = makeRepo();
    const out = await new AuthService(repo).login({ email: 'a@b.com', password: 'x' });
    expect(tokenStorage.setAccessToken).toHaveBeenCalledWith('at');
    expect(tokenStorage.setIdToken).toHaveBeenCalledWith('it');
    expect(secureStore.setRefreshToken).toHaveBeenCalledWith('rt');
    expect(out).toEqual({ user: USER, tokens: TOKENS });
  });
});

describe('AuthService.bootstrap', () => {
  it('uses the in-memory access token when present', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('at');
    const repo = makeRepo();
    const out = await new AuthService(repo).bootstrap();
    expect(out).toEqual({ user: USER, accessToken: 'at' });
    expect(repo.refresh).not.toHaveBeenCalled();
  });

  it('falls back to the keychain refresh token when no access token', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue(null);
    vi.mocked(secureStore.getRefreshToken).mockResolvedValue('rt');
    const repo = makeRepo();
    const out = await new AuthService(repo).bootstrap();
    expect(repo.refresh).toHaveBeenCalledWith('rt');
    expect(out).toEqual({ user: USER, accessToken: 'at' });
  });

  it('returns null when there is neither an access token nor a refresh token', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue(null);
    vi.mocked(secureStore.getRefreshToken).mockResolvedValue(null);
    expect(await new AuthService(makeRepo()).bootstrap()).toBeNull();
  });

  it('clears the refresh token + returns null when refresh is rejected', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue(null);
    vi.mocked(secureStore.getRefreshToken).mockResolvedValue('rt');
    const repo = makeRepo({ refresh: vi.fn().mockRejectedValue(new Error('expired')) });
    const out = await new AuthService(repo).bootstrap();
    expect(secureStore.clearRefreshToken).toHaveBeenCalled();
    expect(tokenStorage.clearAll).toHaveBeenCalled();
    expect(out).toBeNull();
  });

  it('falls through to refresh when a stale access token fails me()', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('stale');
    vi.mocked(secureStore.getRefreshToken).mockResolvedValue('rt');
    const me = vi.fn().mockRejectedValueOnce(new Error('401')).mockResolvedValue(USER);
    const repo = makeRepo({ me });
    const out = await new AuthService(repo).bootstrap();
    expect(tokenStorage.clearAll).toHaveBeenCalled();
    expect(repo.refresh).toHaveBeenCalledWith('rt');
    expect(out).toEqual({ user: USER, accessToken: 'at' });
  });

  it('is single-flight: concurrent calls share ONE refresh + provision', async () => {
    // The StrictMode double-invoke / refresh-rotation race: two parallel
    // bootstraps must collapse onto one run, or the second reuses the rotated
    // refresh token and clobbers the first's access token (the 401 burst).
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue(null);
    vi.mocked(tokenStorage.getIdToken).mockReturnValue('it');
    vi.mocked(secureStore.getRefreshToken).mockResolvedValue('rt');
    const repo = makeRepo();
    const service = new AuthService(repo);

    const [a, b] = await Promise.all([service.bootstrap(), service.bootstrap()]);

    expect(repo.refresh).toHaveBeenCalledTimes(1);
    expect(repo.provisionOAuthUser).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ user: USER, accessToken: 'at' });
    expect(b).toEqual(a);
  });

  it('starts a fresh run after the in-flight one settles', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('at');
    vi.mocked(tokenStorage.getIdToken).mockReturnValue('it');
    const repo = makeRepo();
    const service = new AuthService(repo);

    await service.bootstrap();
    await service.bootstrap();

    // The promise is released on settle, so a later call provisions again.
    expect(repo.provisionOAuthUser).toHaveBeenCalledTimes(2);
  });
});

describe('AuthService — ID-token provisioning', () => {
  it('login provisions via the ID token (creates the BE account) when present', async () => {
    vi.mocked(tokenStorage.getIdToken).mockReturnValue('it');
    const repo = makeRepo();
    const out = await new AuthService(repo).login({ email: 'a@b.com', password: 'x' });
    expect(repo.provisionOAuthUser).toHaveBeenCalledWith('it');
    expect(repo.me).not.toHaveBeenCalled();
    expect(out.user).toEqual(USER);
  });

  it('bootstrap provisions via the ID token when an access token is present', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('at');
    vi.mocked(tokenStorage.getIdToken).mockReturnValue('it');
    const repo = makeRepo();
    await new AuthService(repo).bootstrap();
    expect(repo.provisionOAuthUser).toHaveBeenCalledWith('it');
  });

  it('falls back to me() when there is no ID token (e.g. local session)', async () => {
    vi.mocked(tokenStorage.getAccessToken).mockReturnValue('at');
    vi.mocked(tokenStorage.getIdToken).mockReturnValue(null);
    const repo = makeRepo();
    await new AuthService(repo).bootstrap();
    expect(repo.me).toHaveBeenCalled();
    expect(repo.provisionOAuthUser).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout', () => {
  it('clears tokens and the persisted refresh token', () => {
    new AuthService(makeRepo()).logout();
    expect(tokenStorage.clearAll).toHaveBeenCalled();
    expect(secureStore.clearRefreshToken).toHaveBeenCalled();
  });
});

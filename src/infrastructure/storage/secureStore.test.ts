import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invoke(...a) }));

import { secureStore } from './secureStore';

const KEY = 'auth_refresh_token';
const enterTauri = () => ((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {});
const exitTauri = () => delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

beforeEach(() => invoke.mockReset());
afterEach(() => exitTauri());

describe('secureStore outside Tauri (browser shell)', () => {
  it('is a safe no-op: get → null, set/clear never invoke', async () => {
    expect(await secureStore.getRefreshToken()).toBeNull();
    await secureStore.setRefreshToken('x');
    await secureStore.clearRefreshToken();
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('secureStore inside Tauri', () => {
  beforeEach(enterTauri);

  it('setRefreshToken invokes secure_store_set with key + value', async () => {
    invoke.mockResolvedValue(undefined);
    await secureStore.setRefreshToken('rt');
    expect(invoke).toHaveBeenCalledWith('secure_store_set', { key: KEY, value: 'rt' });
  });

  it('getRefreshToken returns the stored value, or null when absent', async () => {
    invoke.mockResolvedValueOnce('rt');
    expect(await secureStore.getRefreshToken()).toBe('rt');
    invoke.mockResolvedValueOnce(null);
    expect(await secureStore.getRefreshToken()).toBeNull();
  });

  it('clearRefreshToken invokes secure_store_delete', async () => {
    invoke.mockResolvedValue(undefined);
    await secureStore.clearRefreshToken();
    expect(invoke).toHaveBeenCalledWith('secure_store_delete', { key: KEY });
  });
});

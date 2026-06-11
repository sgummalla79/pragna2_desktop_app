import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './runtime';

/**
 * Frontend wrapper over the Rust `secure_store_*` Tauri commands — the OS
 * keychain (macOS Keychain / Windows Credential Manager via the `keyring`
 * crate). Used to persist the auth **refresh token** across app restarts so the
 * session survives a relaunch (TD-009).
 *
 * Outside the Tauri runtime (e.g. the `pnpm dev` browser shell) every call is a
 * safe no-op: there's no secure store, so persistence simply doesn't happen and
 * the session is sign-in-each-launch. Callers must tolerate that.
 */

/** Keychain key for the Auth0 refresh token. */
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

export const secureStore = {
  /** Persist the refresh token (overwrites any existing value). */
  async setRefreshToken(token: string): Promise<void> {
    if (!isTauriRuntime()) return;
    await invoke('secure_store_set', { key: REFRESH_TOKEN_KEY, value: token });
  },

  /** Read the stored refresh token, or `null` when absent / not in Tauri. */
  async getRefreshToken(): Promise<string | null> {
    if (!isTauriRuntime()) return null;
    const value = await invoke<string | null>('secure_store_get', {
      key: REFRESH_TOKEN_KEY,
    });
    return value ?? null;
  },

  /** Remove the stored refresh token (no-op when absent / not in Tauri). */
  async clearRefreshToken(): Promise<void> {
    if (!isTauriRuntime()) return;
    await invoke('secure_store_delete', { key: REFRESH_TOKEN_KEY });
  },
};

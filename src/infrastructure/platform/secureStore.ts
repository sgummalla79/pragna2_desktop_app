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
  /**
   * Persist the refresh token (overwrites any existing value).
   *
   * A denied/cancelled keychain prompt never breaks login: the Rust side maps
   * it to a skipped write, and this `catch` swallows any other rejection with a
   * `console.warn`. The trade-off is that the session simply won't survive a
   * relaunch — the user logs in again next time.
   */
  async setRefreshToken(token: string): Promise<void> {
    if (!isTauriRuntime()) return;
    try {
      await invoke('secure_store_set', { key: REFRESH_TOKEN_KEY, value: token });
    } catch (error) {
      console.warn(
        '[secureStore] keychain write failed; session will not persist',
        error,
      );
    }
  },

  /**
   * Read the stored refresh token, or `null` when absent / not in Tauri / the
   * OS keychain is unavailable.
   *
   * The Rust side already maps a denied/cancelled keychain prompt to "no token".
   * This `catch` is a final safety net: any unexpected rejection degrades to
   * `null` (treated as "no saved session") so a keychain prompt the user
   * dismisses can never break app startup — the user simply logs in again.
   */
  async getRefreshToken(): Promise<string | null> {
    if (!isTauriRuntime()) return null;
    try {
      const value = await invoke<string | null>('secure_store_get', {
        key: REFRESH_TOKEN_KEY,
      });
      return value ?? null;
    } catch (error) {
      console.warn(
        '[secureStore] keychain read failed; treating as no saved session',
        error,
      );
      return null;
    }
  },

  /**
   * Remove the stored refresh token (no-op when absent / not in Tauri).
   *
   * A denied/failed delete must not break logout: any rejection degrades to a
   * `console.warn`. Worst case the stale token lingers in the keychain and is
   * overwritten on the next successful login.
   */
  async clearRefreshToken(): Promise<void> {
    if (!isTauriRuntime()) return;
    try {
      await invoke('secure_store_delete', { key: REFRESH_TOKEN_KEY });
    } catch (error) {
      console.warn('[secureStore] keychain delete failed', error);
    }
  },
};

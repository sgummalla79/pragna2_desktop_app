// Session tokens live in sessionStorage — they survive page refreshes within
// the same browser tab and are cleared automatically when the tab closes.

const KEYS = {
  accessToken: 'pragna_at',
  idToken:     'pragna_idt',
} as const;

function read(key: string): string | null {
  try { return sessionStorage.getItem(key) || null; } catch { return null; }
}

function write(key: string, value: string): void {
  try { if (value) sessionStorage.setItem(key, value); } catch { /* unavailable */ }
}

function erase(key: string): void {
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
}

export const tokenStorage = {
  getAccessToken: ()          => read(KEYS.accessToken),
  setAccessToken: (t: string) => write(KEYS.accessToken, t),
  clearAccessToken: ()        => erase(KEYS.accessToken),

  getIdToken: ()          => read(KEYS.idToken),
  setIdToken: (t: string) => write(KEYS.idToken, t),
  clearIdToken: ()        => erase(KEYS.idToken),

  clearAll(): void {
    erase(KEYS.accessToken);
    erase(KEYS.idToken);
  },
};

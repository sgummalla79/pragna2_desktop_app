import { describe, it, expect, vi, afterEach } from 'vitest';

// Fake the Tauri window API so the "inside Tauri" path is exercisable in jsdom,
// and so we can assert it is NEVER called outside the runtime (the CF-011 guard).
// `vi.hoisted` lets the mock factory (hoisted above imports) reference the spy.
const { getCurrentWindow, setTitle } = vi.hoisted(() => {
  const setTitle = vi.fn().mockResolvedValue(undefined);
  return {
    setTitle,
    getCurrentWindow: vi.fn(() => ({ setTitle })),
  };
});
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow }));

import { setNativeWindowTitle } from './window';

/** Real `isTauriRuntime()` keys off this; set/unset it to flip the runtime. */
function enterTauriRuntime(): void {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  getCurrentWindow.mockClear();
  setTitle.mockClear();
});

describe('setNativeWindowTitle', () => {
  it('is a no-op AND never touches the Tauri window API outside the Tauri runtime', async () => {
    await setNativeWindowTitle('Acme');

    expect(getCurrentWindow).not.toHaveBeenCalled();
    expect(setTitle).not.toHaveBeenCalled();
  });

  it('sets the native window title to the given brand name inside the Tauri runtime', async () => {
    enterTauriRuntime();

    await setNativeWindowTitle('Acme');

    expect(getCurrentWindow).toHaveBeenCalledTimes(1);
    expect(setTitle).toHaveBeenCalledTimes(1);
    expect(setTitle).toHaveBeenCalledWith('Acme');
  });
});

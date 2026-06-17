import { describe, it, expect, vi, beforeEach } from 'vitest';

const isTauriRuntime = vi.fn();
vi.mock('@/infrastructure/platform', () => ({ isTauriRuntime: () => isTauriRuntime() }));

import { resolveOAuthConnectMode } from './oauthConnectMode';

const loopbackConfig = {
  url: 'u',
  oauth: { clientId: 'a', loginUrl: 'https://login', callbackPort: 8082 },
};

describe('resolveOAuthConnectMode', () => {
  beforeEach(() => isTauriRuntime.mockReset());

  it('loopback when callbackPort present AND in the Tauri runtime', () => {
    isTauriRuntime.mockReturnValue(true);
    expect(resolveOAuthConnectMode(loopbackConfig)).toEqual({
      mode: 'loopback',
      callbackPort: 8082,
    });
  });

  it('browser when callbackPort present but NOT in the Tauri runtime', () => {
    // A plain browser cannot bind a loopback port — gate on runtime, not config.
    isTauriRuntime.mockReturnValue(false);
    expect(resolveOAuthConnectMode(loopbackConfig)).toEqual({ mode: 'browser' });
  });

  it('browser when there is no oauth block (DCR connector), even in Tauri', () => {
    isTauriRuntime.mockReturnValue(true);
    expect(resolveOAuthConnectMode({ url: 'u' })).toEqual({ mode: 'browser' });
  });
});

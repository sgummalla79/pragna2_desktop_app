import { describe, it, expect, vi, beforeEach } from 'vitest';

const start = vi.fn();
const cancel = vi.fn().mockResolvedValue(undefined);
const onUrl = vi.fn();
const onInvalidUrl = vi.fn().mockResolvedValue(() => {});
const openUrl = vi.fn().mockResolvedValue(undefined);
const isTauriRuntime = vi.fn().mockReturnValue(true);

vi.mock('@fabianlars/tauri-plugin-oauth', () => ({
  start: (...a: unknown[]) => start(...a),
  cancel: (...a: unknown[]) => cancel(...a),
  onUrl: (...a: unknown[]) => onUrl(...a),
  onInvalidUrl: (...a: unknown[]) => onInvalidUrl(...a),
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: (...a: unknown[]) => openUrl(...a) }));
vi.mock('@/infrastructure/platform', () => ({ isTauriRuntime: () => isTauriRuntime() }));
vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), fromError: vi.fn() },
}));

import { TauriMcpOAuthLoopbackFlow } from './tauriMcpOAuthLoopbackFlow';

const flow = () => new TauriMcpOAuthLoopbackFlow();

describe('TauriMcpOAuthLoopbackFlow.capture', () => {
  beforeEach(() => {
    start.mockReset();
    cancel.mockClear();
    onUrl.mockReset();
    openUrl.mockClear();
    isTauriRuntime.mockReturnValue(true);
  });

  it('throws CON_007 outside the Tauri runtime (never binds a port)', async () => {
    isTauriRuntime.mockReturnValue(false);
    await expect(flow().capture(8082, 'https://auth')).rejects.toMatchObject({
      code: 'CON_007',
    });
    expect(start).not.toHaveBeenCalled();
  });

  it('throws CON_008 when the port cannot be bound', async () => {
    start.mockRejectedValue(new Error('EADDRINUSE'));
    await expect(flow().capture(8082, 'https://auth')).rejects.toMatchObject({
      code: 'CON_008',
    });
  });

  it('throws CON_008 and tears down when a different port is bound', async () => {
    start.mockResolvedValue(9999);
    await expect(flow().capture(8082, 'https://auth')).rejects.toMatchObject({
      code: 'CON_008',
    });
    expect(cancel).toHaveBeenCalledWith(9999);
  });

  it('opens the auth URL and resolves with the captured code+state', async () => {
    start.mockResolvedValue(8082);
    let urlCb: ((raw: string) => void) | undefined;
    onUrl.mockImplementation((cb: (raw: string) => void) => {
      urlCb = cb;
      return Promise.resolve(() => {});
    });

    const p = flow().capture(8082, 'https://auth');
    await Promise.resolve();
    expect(openUrl).toHaveBeenCalledWith('https://auth');

    urlCb!('http://localhost:8082/callback?code=C&state=S');
    await expect(p).resolves.toEqual({ code: 'C', state: 'S' });
    expect(cancel).toHaveBeenCalledWith(8082);
  });

  it('rejects CON_007 on a provider error redirect', async () => {
    start.mockResolvedValue(8082);
    let urlCb: ((raw: string) => void) | undefined;
    onUrl.mockImplementation((cb: (raw: string) => void) => {
      urlCb = cb;
      return Promise.resolve(() => {});
    });

    const p = flow().capture(8082, 'https://auth');
    await Promise.resolve();
    urlCb!('http://localhost:8082/callback?error=access_denied');
    await expect(p).rejects.toMatchObject({ code: 'CON_007' });
  });

  it('ignores stray requests without code+state and keeps waiting', async () => {
    start.mockResolvedValue(8082);
    let urlCb: ((raw: string) => void) | undefined;
    onUrl.mockImplementation((cb: (raw: string) => void) => {
      urlCb = cb;
      return Promise.resolve(() => {});
    });

    const p = flow().capture(8082, 'https://auth');
    await Promise.resolve();
    urlCb!('http://localhost:8082/favicon.ico'); // stray — ignored
    urlCb!('http://localhost:8082/callback?code=C&state=S'); // real
    await expect(p).resolves.toEqual({ code: 'C', state: 'S' });
  });
});

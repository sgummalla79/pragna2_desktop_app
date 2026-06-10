import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';

const tauriFetch = vi.fn();
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: (...a: unknown[]) => tauriFetch(...a) }));

import { tauriHttpAdapter } from './tauriHttpAdapter';

/** Minimal axios config; the adapter only touches these fields. */
function cfg(over: Partial<InternalAxiosRequestConfig> = {}): InternalAxiosRequestConfig {
  return { method: 'get', headers: {}, ...over } as InternalAxiosRequestConfig;
}

beforeEach(() => tauriFetch.mockReset());

describe('tauriHttpAdapter', () => {
  it('builds the absolute URL with baseURL + path + query params', async () => {
    tauriFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    await tauriHttpAdapter(cfg({ baseURL: 'http://h/api', url: '/conversations', params: { limit: 5, skip: null } }));
    const calledUrl = tauriFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe('http://h/api/conversations?limit=5');
  });

  it('parses a JSON body by default', async () => {
    tauriFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await tauriHttpAdapter(cfg({ url: 'http://h/x' }));
    expect(res.data).toEqual({ ok: true });
    expect(res.status).toBe(200);
  });

  it('returns raw text for responseType text', async () => {
    tauriFetch.mockResolvedValue(new Response('hello', { status: 200 }));
    const res = await tauriHttpAdapter(cfg({ url: 'http://h/x', responseType: 'text' }));
    expect(res.data).toBe('hello');
  });

  it('returns a Blob for responseType blob', async () => {
    tauriFetch.mockResolvedValue(new Response('bytes', { status: 200 }));
    const res = await tauriHttpAdapter(cfg({ url: 'http://h/x', responseType: 'blob' }));
    expect(res.data).toBeInstanceOf(Blob);
  });

  it('returns an ArrayBuffer for responseType arraybuffer', async () => {
    tauriFetch.mockResolvedValue(new Response('bytes', { status: 200 }));
    const res = await tauriHttpAdapter(cfg({ url: 'http://h/x', responseType: 'arraybuffer' }));
    expect(res.data).toBeInstanceOf(ArrayBuffer);
  });

  it('strips a caller-set Content-Type for multipart FormData bodies', async () => {
    tauriFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    const form = new FormData();
    form.append('file', new File(['x'], 'f.txt'));
    await tauriHttpAdapter(
      cfg({ method: 'post', url: 'http://h/up', data: form, headers: { 'Content-Type': 'application/json' } }),
    );
    const passedHeaders = (tauriFetch.mock.calls[0][1] as { headers: Record<string, string> }).headers;
    expect(Object.keys(passedHeaders).some((k) => k.toLowerCase() === 'content-type')).toBe(false);
  });

  it('throws an AxiosError carrying the response when validateStatus rejects the code', async () => {
    tauriFetch.mockResolvedValue(new Response('nope', { status: 404 }));
    await expect(
      tauriHttpAdapter(cfg({ url: 'http://h/x', validateStatus: (s) => s < 300 })),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('wraps a transport failure as an ERR_NETWORK AxiosError', async () => {
    // Synchronous throw → the adapter's `await tauriFetch()` throws into its
    // try/catch with no stray promise for vitest to flag as unhandled.
    tauriFetch.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const err = await tauriHttpAdapter(cfg({ url: 'http://h/x' })).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeTruthy();
    expect((err as { code?: string }).code).toBe('ERR_NETWORK');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks --------------------------------------------------------------------
const isTauriRuntimeMock = vi.fn();
vi.mock('./runtime', () => ({ isTauriRuntime: () => isTauriRuntimeMock() }));

const openUrlMock = vi.fn();
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: (...a: unknown[]) => openUrlMock(...a) }));

// Import AFTER mocks are registered.
import { openExternal, isExternallyOpenableUrl } from './opener';

describe('isExternallyOpenableUrl', () => {
  it.each([
    ['https://example.com/guide', true],
    ['http://example.com', true],
    ['HTTPS://EXAMPLE.COM', true], // scheme is case-insensitive (URL lowercases it)
    ['sandbox:/mnt/data/file.pdf', false],
    ['file:///etc/passwd', false],
    ['mailto:a@b.com', false],
    ['javascript:alert(1)', false],
    ['/relative/path', false],
    ['not a url', false],
    ['', false],
  ])('returns %s → %s', (url, expected) => {
    expect(isExternallyOpenableUrl(url as string)).toBe(expected);
  });
});

describe('openExternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openUrlMock.mockResolvedValue(undefined);
  });

  it('rejects a non-web URL without dispatching to any transport', async () => {
    isTauriRuntimeMock.mockReturnValue(true);
    await expect(openExternal('file:///etc/passwd')).rejects.toBeInstanceOf(RangeError);
    expect(openUrlMock).not.toHaveBeenCalled();
  });

  describe('Tauri runtime', () => {
    beforeEach(() => isTauriRuntimeMock.mockReturnValue(true));

    it('routes the URL through the opener plugin', async () => {
      await openExternal('https://example.com/guide');
      expect(openUrlMock).toHaveBeenCalledWith('https://example.com/guide');
    });

    it('propagates an opener failure instead of swallowing it', async () => {
      openUrlMock.mockRejectedValue(new Error('no handler'));
      await expect(openExternal('https://example.com')).rejects.toThrow('no handler');
    });
  });

  describe('browser fallback (not Tauri)', () => {
    let windowOpenSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      isTauriRuntimeMock.mockReturnValue(false);
      windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    });
    afterEach(() => windowOpenSpy.mockRestore());

    it('opens a new tab with noopener,noreferrer and never touches the plugin', async () => {
      await openExternal('https://example.com/guide');
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://example.com/guide',
        '_blank',
        'noopener,noreferrer',
      );
      expect(openUrlMock).not.toHaveBeenCalled();
    });
  });
});

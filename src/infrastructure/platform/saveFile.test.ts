import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks --------------------------------------------------------------------
const isTauriRuntimeMock = vi.fn();
vi.mock('./runtime', () => ({ isTauriRuntime: () => isTauriRuntimeMock() }));

const downloadBlobMock = vi.fn();
vi.mock('@/lib/download', () => ({ downloadBlob: (...a: unknown[]) => downloadBlobMock(...a) }));

const saveMock = vi.fn();
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: (...a: unknown[]) => saveMock(...a) }));

const writeFileMock = vi.fn();
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: (...a: unknown[]) => writeFileMock(...a) }));

// Import AFTER mocks are registered.
import { saveBytes } from './saveFile';

const PDF = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' });

describe('saveBytes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeFileMock.mockResolvedValue(undefined);
  });

  describe('browser fallback (not Tauri)', () => {
    beforeEach(() => isTauriRuntimeMock.mockReturnValue(false));

    it('triggers a blob-anchor download and reports saved', async () => {
      const outcome = await saveBytes(PDF, 'report.pdf');
      expect(downloadBlobMock).toHaveBeenCalledWith(PDF, 'report.pdf');
      expect(saveMock).not.toHaveBeenCalled();
      expect(outcome).toEqual({ saved: true });
    });
  });

  describe('Tauri runtime', () => {
    beforeEach(() => isTauriRuntimeMock.mockReturnValue(true));

    it('shows a Save dialog filtered by the filename extension and writes the chosen path', async () => {
      saveMock.mockResolvedValue('/Users/me/Downloads/report.pdf');
      const outcome = await saveBytes(PDF, 'report.pdf');

      expect(saveMock).toHaveBeenCalledWith({
        defaultPath: 'report.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const [path, bytes] = writeFileMock.mock.calls[0];
      expect(path).toBe('/Users/me/Downloads/report.pdf');
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(Array.from(bytes as Uint8Array)).toEqual([1, 2, 3]);
      expect(downloadBlobMock).not.toHaveBeenCalled();
      expect(outcome).toEqual({ saved: true, path: '/Users/me/Downloads/report.pdf' });
    });

    it('returns { saved: false } and writes nothing when the dialog is cancelled', async () => {
      saveMock.mockResolvedValue(null);
      const outcome = await saveBytes(PDF, 'report.pdf');
      expect(writeFileMock).not.toHaveBeenCalled();
      expect(outcome).toEqual({ saved: false });
    });

    it('omits the filter for an extension-less filename', async () => {
      saveMock.mockResolvedValue('/tmp/Document');
      await saveBytes(PDF, 'Document');
      expect(saveMock).toHaveBeenCalledWith({ defaultPath: 'Document', filters: [] });
    });

    it('propagates a write failure instead of swallowing it', async () => {
      saveMock.mockResolvedValue('/tmp/report.pdf');
      writeFileMock.mockRejectedValue(new Error('disk full'));
      await expect(saveBytes(PDF, 'report.pdf')).rejects.toThrow('disk full');
    });
  });
});

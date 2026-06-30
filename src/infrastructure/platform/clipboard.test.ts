import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyText, copyImagePng } from './clipboard';

/**
 * Records every `ClipboardItem` constructed so tests can assert the MIME map.
 * The real DOM constructor isn't available in jsdom, so we stub it.
 */
const constructed: Array<Record<string, unknown>> = [];
const writeText = vi.fn().mockResolvedValue(undefined);
const write = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  constructed.length = 0;
  writeText.mockClear();
  write.mockClear();
  vi.stubGlobal(
    'ClipboardItem',
    class {
      items: Record<string, unknown>;
      constructor(items: Record<string, unknown>) {
        this.items = items;
        constructed.push(items);
      }
    },
  );
  Object.assign(navigator, { clipboard: { writeText, write } });
});

describe('copyText', () => {
  it('writes a ready string via writeText (no ClipboardItem)', async () => {
    await copyText('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(write).not.toHaveBeenCalled();
  });

  it('routes a Promise<string> through write() under text/plain (gesture-safe)', async () => {
    await copyText(Promise.resolve('<svg/>'));
    expect(writeText).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledTimes(1);
    expect(Object.keys(constructed[0])).toEqual(['text/plain']);
  });

  it('propagates a clipboard failure rather than swallowing it', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    await expect(copyText('x')).rejects.toThrow('denied');
  });
});

describe('copyImagePng', () => {
  it('writes a ready Blob under image/png', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    await copyImagePng(blob);
    expect(write).toHaveBeenCalledTimes(1);
    expect(Object.keys(constructed[0])).toEqual(['image/png']);
    expect(constructed[0]['image/png']).toBe(blob);
  });

  it('issues write() synchronously with a still-PENDING blob promise', async () => {
    // The activation-preserving contract: clipboard.write must be called before
    // the blob promise resolves. We resolve it only AFTER asserting write fired.
    let resolveBlob!: (b: Blob) => void;
    const pending = new Promise<Blob>((r) => {
      resolveBlob = r;
    });
    const done = copyImagePng(pending);
    expect(write).toHaveBeenCalledTimes(1); // fired while the promise is unresolved
    resolveBlob(new Blob(['x'], { type: 'image/png' }));
    await done;
  });

  it('propagates a clipboard failure rather than swallowing it', async () => {
    write.mockRejectedValueOnce(new Error('NotAllowedError'));
    await expect(copyImagePng(new Blob(['x']))).rejects.toThrow('NotAllowedError');
  });
});

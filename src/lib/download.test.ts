import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadBlob } from './download';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:dl');
  URL.revokeObjectURL = vi.fn();
});

describe('downloadBlob', () => {
  it('wraps the blob in an object URL, clicks an anchor, and revokes the URL', () => {
    const click = vi.fn();
    const created: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === 'a') {
        el.click = click;
        created.push(el);
      }
      return el;
    });

    downloadBlob(new Blob(['x']), 'report.pdf');

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(created[0].download).toBe('report.pdf');
    expect(created[0].href).toContain('blob:dl');
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dl');
    expect(document.body.querySelector('a')).toBeNull(); // anchor removed

    vi.restoreAllMocks();
  });
});

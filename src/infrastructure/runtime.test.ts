import { describe, it, expect, afterEach } from 'vitest';
import { isTauriRuntime } from './runtime';

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe('isTauriRuntime', () => {
  it('is false in a plain browser/jsdom (no Tauri internals)', () => {
    expect(isTauriRuntime()).toBe(false);
  });

  it('is true once Tauri injects __TAURI_INTERNALS__', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(isTauriRuntime()).toBe(true);
  });
});

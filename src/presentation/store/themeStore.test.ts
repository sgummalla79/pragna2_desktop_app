import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useThemeStore, isDarkResolved, initTheme } from './themeStore';
import { THEME_STORAGE_KEY, DARK_CLASS } from '@/constants/theme';

/** Stubs window.matchMedia so `(prefers-color-scheme: dark)` reports `prefers`. */
function stubPrefersDark(prefers: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: prefers,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove(DARK_CLASS);
  stubPrefersDark(false);
});

afterEach(() => {
  useThemeStore.setState({ mode: 'system' });
});

describe('isDarkResolved', () => {
  it('is true for explicit dark, false for explicit light', () => {
    expect(isDarkResolved('dark')).toBe(true);
    expect(isDarkResolved('light')).toBe(false);
  });

  it('for system, follows the OS preference', () => {
    stubPrefersDark(true);
    expect(isDarkResolved('system')).toBe(true);
    stubPrefersDark(false);
    expect(isDarkResolved('system')).toBe(false);
  });
});

describe('setMode', () => {
  it('persists the mode to localStorage', () => {
    useThemeStore.getState().setMode('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('adds the .dark class for dark and removes it for light', () => {
    useThemeStore.getState().setMode('dark');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
    useThemeStore.getState().setMode('light');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false);
  });

  it('for system, applies the .dark class iff the OS prefers dark', () => {
    stubPrefersDark(true);
    useThemeStore.getState().setMode('system');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);

    stubPrefersDark(false);
    useThemeStore.getState().setMode('system');
    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(false);
  });
});

describe('initTheme', () => {
  it('applies the current store mode to the DOM and registers an OS listener', () => {
    const addEventListener = vi.fn();
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener,
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    useThemeStore.setState({ mode: 'system' });
    initTheme();

    expect(document.documentElement.classList.contains(DARK_CLASS)).toBe(true);
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

import { create } from 'zustand';
import {
  DARK_CLASS,
  DEFAULT_THEME_MODE,
  PREFERS_DARK_QUERY,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from '@/constants/theme';

/**
 * Theme store — owns the light/dark/system appearance mode, persists the choice
 * to localStorage, and applies it to the DOM by toggling the `.dark` class on
 * `<html>`. Kept separate from `uiStore` (Single Responsibility): `uiStore`
 * explicitly delegates theming elsewhere.
 *
 * `system` mode resolves against the OS via `matchMedia` and re-applies live
 * when the OS preference changes (see {@link initTheme}).
 */

/** Reads the persisted mode, defaulting when unset/unavailable. */
function readInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_THEME_MODE;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_THEME_MODE;
}

/** True when the OS currently prefers a dark color scheme. */
function osPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(PREFERS_DARK_QUERY).matches;
}

/** Resolves a (possibly `system`) mode to the concrete dark/light decision. */
export function isDarkResolved(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && osPrefersDark());
}

/** Applies the resolved mode to the document root by toggling `.dark`. */
function applyThemeToDom(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle(DARK_CLASS, isDarkResolved(mode));
}

interface ThemeState {
  /** The user's chosen mode (light/dark/system). */
  mode: ThemeMode;
  /** Persist + apply a new mode. */
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: readInitialMode(),

  setMode: (mode) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* storage unavailable */
    }
    applyThemeToDom(mode);
    set({ mode });
  },
}));

/**
 * Applies the persisted theme to the DOM and wires the OS-preference listener.
 * Call once at app boot (before/at mount) so the initial paint is correct and
 * `system` mode tracks OS changes live. Idempotent enough for repeated calls.
 */
export function initTheme(): void {
  const { mode } = useThemeStore.getState();
  applyThemeToDom(mode);

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const media = window.matchMedia(PREFERS_DARK_QUERY);
    const onChange = () => {
      // Only `system` mode follows the OS; explicit light/dark ignore it.
      if (useThemeStore.getState().mode === 'system') applyThemeToDom('system');
    };
    // Modern browsers expose addEventListener; guard for older/jsdom shims.
    if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
    else if (typeof media.addListener === 'function') media.addListener(onChange);
  }
}

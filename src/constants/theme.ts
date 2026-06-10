/**
 * Theme (light/dark) configuration constants.
 *
 * Externalised per the no-hardcoding rule: the storage key, the DOM class that
 * activates dark mode (see `@custom-variant dark` in `index.css`), the
 * OS-preference media query, and the default mode all live here rather than
 * inline in the store/view.
 */

/** The three selectable appearance modes. `system` follows the OS preference. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** localStorage key holding the user's chosen {@link ThemeMode}. */
export const THEME_STORAGE_KEY = 'pragna:theme';

/** Class toggled on `<html>` to activate the dark token set (`index.css` `.dark`). */
export const DARK_CLASS = 'dark';

/** Media query whose match means "the OS prefers dark". */
export const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Default mode when the user has never chosen one. Desktop apps conventionally
 * follow the OS, so we default to `system` (a documented deviation from the web
 * app, which defaults to `dark` — see `docs/web-app-parity.md`).
 */
export const DEFAULT_THEME_MODE: ThemeMode = 'system';

/** Ordered list of modes for the Appearance selector. */
export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

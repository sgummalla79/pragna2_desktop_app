import { usesWindowsChrome } from '@/infrastructure/platform';
import { WindowsTitleBar } from './WindowsTitleBar';

/**
 * Top-of-window chrome strip.
 *
 * - **Windows (in the Tauri runtime):** the custom {@link WindowsTitleBar} with
 *   a drag region + minimize / maximize / close buttons (Tauri removes the
 *   native frame via `decorations: false`).
 * - **Everything else** — macOS (OS-rendered traffic lights) and any
 *   browser-fallback context: a plain drag-region strip; the native frame
 *   provides the window controls.
 *
 * The choice is gated on {@link usesWindowsChrome} (Windows **and** Tauri), so
 * the Tauri-only title bar never mounts in a plain browser — including a
 * Windows-UA browser like the e2e Desktop Chrome device. See docs/CODE_FIXES.md
 * CF-011.
 */
export function AppTitleBar() {
  if (usesWindowsChrome()) return <WindowsTitleBar />;
  return <div data-tauri-drag-region className="fixed inset-x-0 top-0 h-7 z-30" />;
}

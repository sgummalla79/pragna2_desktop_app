import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from './runtime';

/**
 * Set the native OS window title at runtime.
 *
 * The window title is hardcoded to "Pragna" in the static Tauri configs
 * (`tauri.conf.json` and the per-OS overlays) because the branding overlay
 * cannot safely rewrite the `windows` array at build time (Tauri replaces the
 * whole array on merge, wiping `titleBarStyle` / `decorations`). The native
 * title bar is hidden, but the OS still surfaces the title elsewhere — the
 * macOS Window menu / Mission Control / screen-share picker and the Windows
 * Alt+Tab switcher / taskbar tooltip — so a white-label build must override it
 * to the resolved brand name at runtime.
 *
 * Guarded by {@link isTauriRuntime}: a no-op in a plain browser, the dev server,
 * and the e2e browser-fallback path, so this never reaches an unguarded Tauri
 * window call (see docs/CODE_FIXES.md CF-011). `getCurrentWindow().setTitle`
 * throws when the Tauri internals are absent, so the guard is load-bearing.
 *
 * @param title - The window title to apply (typically the resolved brand name).
 */
export async function setNativeWindowTitle(title: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await getCurrentWindow().setTitle(title);
}

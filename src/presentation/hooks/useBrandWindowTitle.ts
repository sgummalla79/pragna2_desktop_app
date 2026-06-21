import { useEffect } from 'react';

import { APP_NAME } from '@/constants/api';
import { setNativeWindowTitle } from '@/infrastructure/platform';
import { logger } from '@/infrastructure/logging/logger';

/**
 * Apply the resolved brand name ({@link APP_NAME}) as the native OS window title
 * once on startup.
 *
 * The static Tauri config title ("Pragna") is the pre-paint default and the
 * stock fallback; this overrides it at runtime so a white-label build surfaces
 * the brand name everywhere the OS uses the window title (macOS Window menu /
 * Mission Control / screen-share picker, Windows Alt+Tab / taskbar). For a stock
 * build `APP_NAME` resolves to "Pragna", so the title is unchanged.
 *
 * Delegates to {@link setNativeWindowTitle}, which no-ops outside the Tauri
 * runtime — the browser-fallback (dev / e2e) path never reaches a Tauri call.
 */
export function useBrandWindowTitle(): void {
  useEffect(() => {
    setNativeWindowTitle(APP_NAME).catch((e) => {
      logger.fromError(
        'BWT_001:set-title',
        e instanceof Error ? e : new Error(String(e)),
      );
    });
  }, []);
}

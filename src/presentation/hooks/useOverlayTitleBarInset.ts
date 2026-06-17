import type { CSSProperties } from 'react';

import { usesMacOverlayChrome } from '@/infrastructure/platform';
import { TRAFFIC_LIGHT_SAFE_INSET_PX } from '@/constants/windowChrome';

/**
 * Reusable inset for the header bar of any FULL-SCREEN overlay surface (a modal
 * that draws over the app chrome with content pinned to the window's top-left —
 * the agent editor, the attachment viewer, …).
 *
 * On macOS the app uses an overlay title bar, so the native traffic-light
 * buttons float over the top-left corner. A full-screen overlay covers the
 * sidebar that normally hosts those lights, so its own top-left content (a back
 * button, a title, a filename) would sit UNDER them. This hook returns a left
 * padding that pushes that content clear of the lights — but ONLY when the
 * overlay chrome is actually present (`usesMacOverlayChrome`): macOS inside the
 * Tauri runtime. In a plain browser (dev, e2e Desktop Chrome, the web build)
 * and on Windows it returns `undefined`, leaving layout untouched.
 *
 * Spread the result onto the overlay's header element:
 *   `<div style={useOverlayTitleBarInset()} … >`
 *
 * @returns A style with `paddingLeft` on macOS-overlay chrome, else `undefined`.
 */
export function useOverlayTitleBarInset(): CSSProperties | undefined {
  return usesMacOverlayChrome()
    ? { paddingLeft: TRAFFIC_LIGHT_SAFE_INSET_PX }
    : undefined;
}

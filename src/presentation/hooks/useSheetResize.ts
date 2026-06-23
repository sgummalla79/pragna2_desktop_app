import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface SheetResize {
  /** Effective width (px), clamped to `[minWidth, viewport − 2·edgeInset]`. */
  width: number;
  /** True while a drag is in progress (drive the handle's hover/active style). */
  resizing: boolean;
  /** Bind to the left-edge drag handle's `onPointerDown`. */
  startResize: (e: ReactPointerEvent) => void;
}

/**
 * Horizontal resize for a RIGHT-anchored sheet whose right edge is fixed (inset
 * `edgeInset` from the viewport, e.g. `SheetContent`'s `right-2.5` = 10px) and
 * whose LEFT edge drags to widen/narrow it.
 *
 * Because the right edge is pinned, the width is derived from the pointer's x:
 * `width = (viewportRight − edgeInset) − clientX`, clamped to `[minWidth,
 * viewport − 2·edgeInset]`. A previously-dragged wide width is re-clamped to the
 * current viewport on every render, so shrinking the window can't strand the
 * sheet wider than the screen.
 *
 * Shared by the flow YAML editor and the attachment (PDF) viewer so both sheets
 * resize identically. Returns the effective width plus a handle binder; spread
 * the width onto `SheetContent`'s `style` and `startResize` onto the drag
 * handle's `onPointerDown`.
 *
 * @param defaultWidth Width (px) before any drag.
 * @param minWidth Smallest width (px) the drag allows.
 * @param edgeInset Fixed right-edge inset (px) — must match the sheet's `right-*`.
 */
export function useSheetResize(
  defaultWidth: number,
  minWidth: number,
  edgeInset: number,
): SheetResize {
  const [width, setWidth] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);

  const startResize = (e: ReactPointerEvent) => {
    // Primary button only; prevent text selection during the drag.
    if (e.button !== 0) return;
    setResizing(true);
    e.preventDefault();
  };

  // While dragging, map the pointer x to a width (right edge fixed at the inset).
  useEffect(() => {
    if (!resizing) return;
    function onMove(e: PointerEvent) {
      const cap = window.innerWidth - edgeInset * 2;
      const desired = window.innerWidth - edgeInset - e.clientX;
      setWidth(Math.max(Math.min(desired, cap), Math.min(minWidth, cap)));
    }
    function onUp() {
      setResizing(false);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [resizing, minWidth, edgeInset]);

  // Effective width, re-clamped to the current viewport every render.
  const viewportCap =
    typeof window !== 'undefined' ? window.innerWidth - edgeInset * 2 : defaultWidth;
  const effectiveWidth = Math.max(
    Math.min(width ?? defaultWidth, viewportCap),
    Math.min(minWidth, viewportCap),
  );

  return { width: effectiveWidth, resizing, startResize };
}

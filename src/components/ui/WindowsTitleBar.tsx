import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Custom title bar for Windows (rendered when `decorations: false` removes
 * the native chrome). Provides a draggable region and min / max / close
 * buttons styled to match the app's dark theme.
 *
 * The drag region is a sibling element covering the empty left portion —
 * NOT a parent of the buttons — so pointer events on the buttons are
 * never intercepted by the drag handler.
 *
 * Only mounted on Windows — see App.tsx.
 */
export function WindowsTitleBar() {
  const win = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Sync initial state then update whenever the window is resized.
    win.isMaximized().then(setIsMaximized);
    let unlisten: (() => void) | undefined;
    win.onResized(() => {
      win.isMaximized().then(setIsMaximized);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-[200] flex h-8 select-none items-center">
      {/* Drag region — fills the empty left space only, never covers the buttons. */}
      <div data-tauri-drag-region className="flex-1 h-full" />

      {/* Minimize */}
      <button
        type="button"
        aria-label="Minimize"
        onClick={() => win.minimize()}
        className={cn(
          'flex h-8 w-11 items-center justify-center',
          'text-foreground/60 hover:bg-accent hover:text-foreground transition-colors',
        )}
      >
        <Minus size={14} aria-hidden />
      </button>

      {/* Maximize / Restore */}
      <button
        type="button"
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        onClick={() => win.toggleMaximize()}
        className={cn(
          'flex h-8 w-11 items-center justify-center',
          'text-foreground/60 hover:bg-accent hover:text-foreground transition-colors',
        )}
      >
        {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
      </button>

      {/* Close */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => win.close()}
        className={cn(
          'flex h-8 w-11 items-center justify-center',
          'text-foreground/60 hover:bg-red-600 hover:text-white transition-colors',
        )}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

/** Single square — shown when the window is not maximized (click to maximize). */
function MaximizeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="10" height="10" rx="0.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Two overlapping squares — shown when the window is maximized (click to restore). */
function RestoreIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
      {/* Back square */}
      <rect x="2.5" y="0.5" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1" />
      {/* Front square with a white fill to cut out the overlap */}
      <rect x="0.5" y="2.5" width="8" height="8" rx="0.5" fill="transparent" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

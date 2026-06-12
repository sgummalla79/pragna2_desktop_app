import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Custom title bar for Windows (rendered when `decorations: false` removes
 * the native chrome). Provides a draggable region and min / max / close
 * buttons styled to match the app's dark theme.
 *
 * Only mounted on Windows — see App.tsx.
 */
export function WindowsTitleBar() {
  const win = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="fixed inset-x-0 top-0 z-[200] flex h-8 select-none items-center justify-end bg-transparent"
    >
      {/* Min */}
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

      {/* Max / Restore */}
      <button
        type="button"
        aria-label="Maximize"
        onClick={() => win.toggleMaximize()}
        className={cn(
          'flex h-8 w-11 items-center justify-center',
          'text-foreground/60 hover:bg-accent hover:text-foreground transition-colors',
        )}
      >
        <Square size={11} aria-hidden />
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

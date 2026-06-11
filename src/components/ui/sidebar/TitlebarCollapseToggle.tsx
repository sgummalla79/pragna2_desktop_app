import { useRef, useState, type ReactNode } from 'react';
import { AlignLeft, PanelLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  TITLEBAR_TOGGLE_LEFT_PX,
  TITLEBAR_TOGGLE_Y_NUDGE_PX,
  TOGGLE_ICON_PX,
  TRAFFIC_LIGHT_Y,
} from '@/constants/windowChrome';

/** How long after a click to ignore reflow-triggered mouse-enter, ms. */
const SUPPRESS_OPEN_MS = 300;
/** Delay before closing the flyout when the pointer leaves, ms. */
const CLOSE_DELAY_MS = 120;

interface Props {
  /** Whether the owning sidebar is collapsed. */
  collapsed: boolean;
  /** Toggle the collapsed state. */
  onToggle: () => void;
  /** aria-label/title for the action when collapsed (i.e. "open"). */
  openLabel: string;
  /** aria-label/title for the action when expanded (i.e. "collapse"). */
  collapseLabel: string;
  /** Content shown in the hover flyout while collapsed (the nav / list). */
  flyout: ReactNode;
  /** Extra classes for the flyout box (e.g. a fixed height for a tall list). */
  flyoutClassName?: string;
}

/**
 * The macOS title-bar collapse/expand toggle that sits just right of the
 * (inset) traffic lights, plus its collapsed-state hover flyout. Shared by the
 * settings sidebar and the chat sidebar so both behave identically — the
 * position/size come from `@/constants/windowChrome`, so they stay aligned with
 * the traffic lights in one place.
 *
 *  - Click: toggles collapsed (and never opens the flyout — a short suppress
 *    window blocks the reflow-triggered mouse-enter right after a click).
 *  - Collapsed + hover: reveals {@link Props.flyout} as a floating menu.
 */
export function TitlebarCollapseToggle({
  collapsed,
  onToggle,
  openLabel,
  collapseLabel,
  flyout,
  flyoutClassName,
}: Props) {
  // Flyout open state is JS-controlled (not CSS :hover) so it closes reliably on
  // selection and never auto-opens just because the pointer rests on the icon
  // after a click. A short close delay bridges the gap from icon → flyout.
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressOpenUntil = useRef(0);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openFlyout = () => {
    cancelClose();
    setFlyoutOpen(true);
  };
  const closeFlyout = () => {
    cancelClose();
    setFlyoutOpen(false);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setFlyoutOpen(false), CLOSE_DELAY_MS);
  };

  return (
    <div
      className="group fixed z-[70] flex items-center"
      // Positioned next to the (inset) traffic lights via shared constants.
      style={{
        left: TITLEBAR_TOGGLE_LEFT_PX,
        top: TRAFFIC_LIGHT_Y + TITLEBAR_TOGGLE_Y_NUDGE_PX,
        transform: 'translateY(-50%)',
      }}
    >
      <button
        type="button"
        onClick={() => {
          onToggle();
          // A click never opens the flyout, and we block any reflow-triggered
          // mouse-enter for a short window so it can't pop open afterward.
          closeFlyout();
          suppressOpenUntil.current = Date.now() + SUPPRESS_OPEN_MS;
        }}
        onMouseEnter={() => {
          if (collapsed && Date.now() >= suppressOpenUntil.current) openFlyout();
        }}
        onMouseLeave={scheduleClose}
        aria-label={collapsed ? openLabel : collapseLabel}
        aria-expanded={!collapsed}
        title={collapsed ? openLabel : collapseLabel}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded',
          'text-foreground/70 hover:text-foreground hover:bg-accent',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {/* Collapsed → hamburger idle, expand on hover.
            Expanded → panel (expanded) icon idle, collapse on hover. */}
        {collapsed ? (
          <>
            <AlignLeft size={TOGGLE_ICON_PX} aria-hidden="true" className="group-hover:hidden" />
            <PanelLeftOpen size={TOGGLE_ICON_PX} aria-hidden="true" className="hidden group-hover:block" />
          </>
        ) : (
          <>
            <PanelLeft size={TOGGLE_ICON_PX} aria-hidden="true" className="group-hover:hidden" />
            <PanelLeftClose size={TOGGLE_ICON_PX} aria-hidden="true" className="hidden group-hover:block" />
          </>
        )}
      </button>

      {/* Collapsed-only flyout, JS-controlled. The outer wrapper touches the
          button (top-full) so the pointer can travel into it without a dead
          gap; its pt-1.5 is the visual offset. */}
      {collapsed && (
        <div
          onMouseEnter={openFlyout}
          onMouseLeave={scheduleClose}
          className={cn(
            'absolute left-0 top-full z-[60] w-60 pt-1.5 transition-opacity duration-150',
            flyoutOpen
              ? 'visible opacity-100 pointer-events-auto'
              : 'invisible opacity-0 pointer-events-none',
          )}
        >
          <div
            onClick={closeFlyout}
            className={cn(
              'flex max-h-[75vh] flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-2xl',
              flyoutClassName,
            )}
          >
            {flyout}
          </div>
        </div>
      )}
    </div>
  );
}

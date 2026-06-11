import { useRef, useState } from 'react';
import { AlignLeft, PanelLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { Sidebar, ItemList } from '@/components/ui/sidebar/Sidebar';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import {
  TITLEBAR_TOGGLE_LEFT_PX,
  TITLEBAR_TOGGLE_Y_NUDGE_PX,
  TOGGLE_ICON_PX,
  TRAFFIC_LIGHT_Y,
} from '@/constants/windowChrome';
import { useUiStore } from '@/presentation/store/uiStore';
import type { SidebarItemConfig } from '@/components/ui/sidebar/types';

/** Settings navigation config — add/remove items here; styling never changes. */
const SETTINGS_NAV: SidebarItemConfig[] = [
  { type: 'back', to: ROUTES.CHAT, label: 'Back to Chat' },
  { type: 'section', label: 'AI Setup' },
  { type: 'nav', to: ROUTES.SETTINGS_CONFIGURATION, icon: <EntityIcon entity="configuration" />, label: 'Configuration' },
  { type: 'nav', to: ROUTES.SETTINGS_PROVIDERS, icon: <EntityIcon entity="providers" />, label: 'Providers' },
  { type: 'nav', to: ROUTES.SETTINGS_CONNECTORS, icon: <EntityIcon entity="connectors" />, label: 'Connectors' },
  { type: 'nav', to: ROUTES.SETTINGS_KNOWLEDGE, icon: <EntityIcon entity="knowledge" />, label: 'Knowledge' },
  { type: 'section', label: 'Build' },
  { type: 'nav', to: ROUTES.SETTINGS_AGENTS, icon: <EntityIcon entity="agents" />, label: 'Agents' },
  { type: 'nav', to: ROUTES.SETTINGS_FLOWS, icon: <EntityIcon entity="flows" />, label: 'Agent Flows' },
  { type: 'section', label: 'Account' },
  { type: 'nav', to: ROUTES.SETTINGS_APPEARANCE, icon: <EntityIcon entity="appearance" />, label: 'Appearance' },
  { type: 'nav', to: ROUTES.SETTINGS_PROFILE, icon: <EntityIcon entity="profile" />, label: 'Profile' },
];

/**
 * Settings navigation, macOS-style:
 *  - A collapse/expand toggle lives in the title-bar strip, just right of the
 *    traffic lights (fixed, top-left).
 *  - Expanded: the full static sidebar panel shows; the toggle collapses it.
 *  - Collapsed: the panel is hidden; clicking the toggle pins it open, and
 *    HOVERING the toggle reveals the nav as a floating flyout menu.
 */
export function SettingsSidebar() {
  const collapsed = useUiStore((s) => s.settingsPaneCollapsed);
  const toggle = useUiStore((s) => s.toggleSettingsPane);
  // Flyout open state is JS-controlled (not CSS :hover) so it closes reliably on
  // selection and never auto-opens just because the pointer rests on the icon
  // after a click. A short close delay bridges the gap from icon → flyout.
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // After a click (state change) the cursor stays on the icon and the reflow can
  // fire a spurious mouse-enter. Ignore opens for a short window so the flyout
  // only shows on a *deliberate* hover, never right after a click.
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
    closeTimer.current = setTimeout(() => setFlyoutOpen(false), 120);
  };

  return (
    <>
      {/* Title-bar toggle — sits right of the (inset) macOS traffic lights,
          vertically centered in the sidebar box's title row. */}
      <div
        className="group fixed z-[70] flex items-center"
        // Centered on the (inset) traffic lights' vertical center, with a fine nudge.
        style={{
          left: TITLEBAR_TOGGLE_LEFT_PX,
          top: TRAFFIC_LIGHT_Y + TITLEBAR_TOGGLE_Y_NUDGE_PX,
          transform: 'translateY(-50%)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            toggle();
            // A click never opens the flyout, and we block any reflow-triggered
            // mouse-enter for a short window so it can't pop open afterward.
            closeFlyout();
            suppressOpenUntil.current = Date.now() + 300;
          }}
          onMouseEnter={() => {
            if (collapsed && Date.now() >= suppressOpenUntil.current) openFlyout();
          }}
          onMouseLeave={scheduleClose}
          aria-label={collapsed ? 'Open sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Open sidebar' : 'Collapse sidebar'}
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
              className="flex max-h-[75vh] flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-2xl"
            >
              <ItemList items={SETTINGS_NAV} expanded />
            </div>
          </div>
        )}
      </div>

      {/* Expanded panel (static rail). Hidden when collapsed. */}
      {!collapsed && <Sidebar items={SETTINGS_NAV} label="Settings navigation" />}
    </>
  );
}

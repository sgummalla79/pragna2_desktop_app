import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  SIDEBAR_BOX_INSET_PX,
  SIDEBAR_BOX_GAP_PX,
  SIDEBAR_TITLE_ROW_PX,
} from '@/constants/windowChrome';

import { SidebarBackItem } from './SidebarBackItem';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarSection } from './SidebarSection';
import { SidebarDivider } from './SidebarDivider';
import type { SidebarItemConfig } from './types';

/** Renders the list of nav items (icons + optional labels). Shared by the
 *  expanded rail and the collapsed hover-flyout. */
export function ItemList({ items, expanded = true }: { items: SidebarItemConfig[]; expanded?: boolean }) {
  return (
    <>
      {items.map((item, index) => {
        if (!expanded && (item.type === 'divider' || item.type === 'section')) return null;
        switch (item.type) {
          case 'back':
            return <SidebarBackItem key={index} to={item.to} label={item.label} collapsed={!expanded} />;
          case 'section':
            return <SidebarSection key={index} label={item.label} />;
          case 'nav':
            return <SidebarNavItem key={index} to={item.to} icon={item.icon} label={item.label} collapsed={!expanded} />;
          case 'divider':
            return <SidebarDivider key={index} />;
        }
      })}
    </>
  );
}

interface Props {
  items: SidebarItemConfig[];
  /** Width of the panel in px. Default 240. */
  width?: number;
  /** ARIA label for the aside element. */
  label?: string;
  className?: string;
  /**
   * Optional header rendered above the nav list (Windows inline header).
   * When provided, the default `paddingTop` (macOS title-row clearance) is
   * removed — the header is responsible for its own top spacing.
   */
  headerContent?: ReactNode;
}

/**
 * Static sidebar panel (the expanded rail), rendered as a floating rounded
 * "box" inset from the window edges (window background shows around it). The
 * macOS traffic lights are inset (see {@link TRAFFIC_LIGHT_X}/`Y` +
 * tauri.conf.json) to sit INSIDE the box's top-left title row, so the nav
 * content is padded below that row ({@link SIDEBAR_TITLE_ROW_PX}). Collapse +
 * the collapsed hover flyout are handled by the title-bar toggle (see
 * SettingsSidebar), not here. Geometry comes from `@/constants/windowChrome`;
 * theme tokens only.
 */
export function Sidebar({ items, width = 240, label = 'Navigation', className, headerContent }: Props) {
  // 'back' items are pinned to the bottom of the rail — mirroring the chat
  // sidebar's avatar footer — so the scrollable nav fills the space above them.
  const bodyItems = items.filter((item) => item.type !== 'back');
  const footerItems = items.filter((item) => item.type === 'back');

  return (
    <aside
      aria-label={label}
      className={cn(
        'flex flex-shrink-0 flex-col overflow-hidden rounded-md',
        'bg-sidebar text-sidebar-foreground border border-border shadow-sm',
        className,
      )}
      style={{
        width,
        minWidth: width,
        marginTop: headerContent ? 8 : SIDEBAR_BOX_INSET_PX,
        marginBottom: SIDEBAR_BOX_INSET_PX,
        marginLeft: SIDEBAR_BOX_INSET_PX,
        marginRight: SIDEBAR_BOX_GAP_PX,
        height: headerContent ? `calc(100vh - 18px)` : `calc(100vh - ${SIDEBAR_BOX_INSET_PX * 2}px)`,
      }}
    >
      {/* Windows inline header (gear + title + toggle). Replaces the default
          paddingTop that clears the macOS traffic-light row. */}
      {headerContent}

      <div
        className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 px-3 pb-4"
        // When a custom header is present it manages its own top spacing;
        // otherwise push the nav below the macOS title row.
        style={{ paddingTop: headerContent ? 0 : SIDEBAR_TITLE_ROW_PX }}
      >
        <ItemList items={bodyItems} expanded />
      </div>

      {footerItems.length > 0 && (
        // Same placement as the chat sidebar's avatar footer (px-3 py-1).
        <div className="flex flex-col gap-0.5 px-3 py-1">
          <ItemList items={footerItems} expanded />
        </div>
      )}
    </aside>
  );
}

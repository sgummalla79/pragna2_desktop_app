import { cn } from '@/lib/utils';

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
}

/**
 * Static sidebar panel (the expanded rail). Collapse + the collapsed hover
 * flyout are handled by the title-bar toggle (see SettingsSidebar), not here.
 * `pt-7` clears the overlay title bar's macOS traffic lights. Theme tokens only.
 */
export function Sidebar({ items, width = 240, label = 'Navigation', className }: Props) {
  return (
    <aside
      aria-label={label}
      className={cn(
        'flex h-full flex-shrink-0 flex-col pt-7',
        'bg-sidebar text-sidebar-foreground border-r border-border',
        className,
      )}
      style={{ width, minWidth: width }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 px-3 py-4">
        <ItemList items={items} expanded />
      </div>
    </aside>
  );
}

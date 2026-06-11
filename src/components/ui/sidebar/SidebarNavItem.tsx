import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Props {
  to: string;
  icon: ReactNode;
  label: string;
  /** When true, render as icon-only with a native tooltip carrying
   *  the label so the row stays discoverable in collapsed mode. */
  collapsed?: boolean;
}

/**
 * Standard sidebar navigation link. Reads from palette tokens — no
 * hardcoded colours. Active state: tinted-primary background, full-
 * strength foreground. Inactive: muted foreground with accent hover.
 */
export function SidebarNavItem({ to, icon, label, collapsed = false }: Props) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          // Fixed h-8 + text-[13px] matches every other sidebar/menu row so all
          // hover boxes are the same size regardless of icon/content height.
          'flex items-center rounded-lg text-[13px] no-underline',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sidebar-ring)]',
          collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-3 px-3 h-8',
          isActive
            ? 'font-semibold text-sidebar-primary-foreground bg-sidebar-primary'
            // Shared darker hover (see --sidebar-hover in index.css).
            : 'font-medium text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-hover',
        )
      }
    >
      <span className="flex flex-shrink-0 items-center" aria-hidden="true">
        {icon}
      </span>
      {!collapsed && label}
    </NavLink>
  );
}

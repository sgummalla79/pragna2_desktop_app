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
          'flex items-center rounded-lg text-sm no-underline',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sidebar-ring)]',
          collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-3 px-3 py-1.5 min-h-9',
          isActive
            ? 'font-semibold text-sidebar-primary-foreground bg-sidebar-primary'
            : 'font-medium text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent',
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

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  to: string;
  label: string;
  /** Icon-only mode for collapsed sidebars. */
  collapsed?: boolean;
}

/**
 * Navigation item that takes the user back to a parent route.
 *
 * Icon: a left-pointing back arrow in a circular badge. The badge uses
 * `bg-foreground` / `text-background` so it inverts with the theme —
 * dark mode renders a white circle with a dark arrow; light mode renders a
 * dark circle with a light arrow. The "Back to Chat" tooltip (when collapsed)
 * and label (when expanded) carry the "back" semantic.
 */
export function SidebarBackItem({ to, label, collapsed = false }: Props) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        // Expanded: match SidebarNavItem's row metrics (gap-3 px-3 h-8) so the
        // icon and label line up with the nav items above. Collapsed: mirror the
        // chat sidebar's avatar footer button.
        'group flex items-center rounded-lg font-medium no-underline',
        // Match SidebarNavItem's inactive text color so the footer row tones
        // with the nav items above it.
        'text-sidebar-foreground/70 transition-colors hover:text-sidebar-accent-foreground hover:bg-sidebar-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        collapsed ? 'h-10 w-10 justify-center mx-auto' : 'w-full gap-3 px-3 h-8',
      )}
    >
      {/* Back arrow in a circular badge. The 20px circle matches the nav items'
          icon tile so the icon edge and label align; tokens invert per theme. */}
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-background"
        aria-hidden="true"
      >
        <ArrowLeft size={14} />
      </span>
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left text-[13px]">{label}</span>}
    </Link>
  );
}

import { Link } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
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
 * Icon: lucide's `MessagesSquare` (two stacked chat bubbles) rather
 * than a plain chevron. The settings sidebar's only "back" item
 * points at `/chat`, so the icon literally depicts the destination —
 * it reads better in collapsed mode than a generic arrow. The
 * "Back to Chat" tooltip (when collapsed) and label (when expanded)
 * still carry the "back" semantic.
 */
export function SidebarBackItem({ to, label, collapsed = false }: Props) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'flex items-center rounded-lg text-sm font-medium text-sidebar-foreground no-underline',
        'transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-2.5 px-3.5 py-2.5 min-h-11',
      )}
    >
      <MessagesSquare size={collapsed ? 18 : 16} className="flex-shrink-0" aria-hidden="true" />
      {!collapsed && label}
    </Link>
  );
}

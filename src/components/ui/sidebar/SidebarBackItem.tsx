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
        // Mirror the chat sidebar's avatar footer button (see AvatarMenu):
        // same size, padding, weight, text color, hover and focus treatment.
        'group flex items-center gap-2 rounded-lg font-medium no-underline',
        'text-foreground transition-colors hover:bg-sidebar-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        collapsed ? 'h-10 w-10 justify-center mx-auto' : 'w-full px-2 h-8',
      )}
    >
      <MessagesSquare size={collapsed ? 18 : 16} className="flex-shrink-0" aria-hidden="true" />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left text-[13px]">{label}</span>}
    </Link>
  );
}

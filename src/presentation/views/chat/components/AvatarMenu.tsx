import { DropdownMenu } from 'radix-ui';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, LogOut, ChevronDown } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/presentation/hooks/auth/useAuth';
import { cn } from '@/lib/utils';

/**
 * Shared className for every interactive menu item so they highlight
 * uniformly on hover / keyboard focus.
 */
const MENU_ITEM_CLASS = cn(
  'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm',
  'text-foreground outline-none',
  'data-[highlighted]:bg-sidebar-hover',
);

/**
 * Returns the single-character avatar glyph for a user, prioritising
 * `name` over `email`. Defensive fallback for the unauthenticated case
 * (shouldn't happen on `/chat`) keeps the component renderable in isolation.
 */
function avatarInitial(name: string | null | undefined, email: string | undefined): string {
  const source = (name && name.trim()) || email || '?';
  return source.trim()[0]?.toUpperCase() ?? '?';
}

interface AvatarMenuProps {
  /** Called after a navigation action — lets the mobile drawer close itself. */
  onNavigate?: () => void;
  /** When true, renders only the avatar circle (no name or chevron). Used in the collapsed Windows rail. */
  iconOnly?: boolean;
}

/**
 * Account / settings dropdown anchored to the {@link ChatSidebar} footer.
 *
 * An avatar pill at the bottom of the rail opens a menu with the user's
 * identity, a Settings shortcut, and Sign out. Built on Radix DropdownMenu so
 * keyboard navigation, focus-trap, and escape-to-dismiss come for free. Signing
 * out resets the auth store, which the {@link ProtectedRoute} guard observes to
 * redirect to the login screen; the explicit navigate keeps that snappy.
 */
export function AvatarMenu({ onNavigate, iconOnly = false }: AvatarMenuProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.name || user?.email || 'Account';
  const initial = avatarInitial(user?.name, user?.email);

  const goSettings = () => {
    navigate(ROUTES.SETTINGS);
    onNavigate?.();
  };

  const handleSignOut = () => {
    logout();
    onNavigate?.();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            'group flex items-center gap-2 rounded-lg font-medium',
            'text-foreground transition-colors hover:bg-sidebar-hover',
            'data-[state=open]:bg-sidebar-primary data-[state=open]:text-sidebar-primary-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            iconOnly
              ? 'h-8 w-8 justify-center px-0'
              : 'w-full px-2 h-8',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full leading-none',
              'bg-primary/10 text-primary text-[10px] font-semibold',
              'group-data-[state=open]:bg-sidebar-primary-foreground/20 group-data-[state=open]:text-sidebar-primary-foreground',
            )}
          >
            {initial}
          </span>
          {!iconOnly && (
            <>
              <span className="min-w-0 flex-1 truncate text-left text-[13px]">{displayName}</span>
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={cn(
                  'flex-shrink-0 text-muted-foreground transition-transform',
                  'group-data-[state=open]:rotate-180 group-data-[state=open]:text-sidebar-primary-foreground',
                )}
              />
            </>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          // Open above the trigger (the footer sits at the bottom of the rail).
          side="top"
          align="start"
          sideOffset={8}
          className={cn(
            'z-[700] min-w-[240px] rounded-lg border border-border',
            'bg-popover p-1 shadow-2xl focus:outline-none',
          )}
        >
          {/* User identity (non-interactive). */}
          <DropdownMenu.Label
            className="select-text truncate px-3 py-2 text-sm text-foreground"
            title={user?.email}
          >
            {user?.email ?? 'Signed in'}
          </DropdownMenu.Label>

          <DropdownMenu.Item onSelect={goSettings} className={MENU_ITEM_CLASS}>
            <SettingsIcon size={16} aria-hidden="true" />
            Settings
          </DropdownMenu.Item>

          <DropdownMenu.Item onSelect={handleSignOut} className={MENU_ITEM_CLASS}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

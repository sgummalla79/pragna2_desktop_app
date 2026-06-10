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
  'data-[highlighted]:bg-accent',
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
export function AvatarMenu({ onNavigate }: AvatarMenuProps) {
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
            'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-medium',
            'text-foreground transition-colors hover:bg-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
              'bg-primary/10 text-primary text-xs font-semibold',
            )}
          >
            {initial}
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-sm">{displayName}</span>
          {/* Chevron marks this as a dropdown; rotates 180° while open, driven
              purely by Radix's data-state on the trigger — no extra state. */}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn(
              'flex-shrink-0 text-muted-foreground transition-transform',
              'group-data-[state=open]:rotate-180',
            )}
          />
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

          <DropdownMenu.Separator className="my-1 h-px bg-accent" />

          <DropdownMenu.Item onSelect={goSettings} className={MENU_ITEM_CLASS}>
            <SettingsIcon size={16} aria-hidden="true" />
            Settings
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-accent" />

          <DropdownMenu.Item onSelect={handleSignOut} className={MENU_ITEM_CLASS}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

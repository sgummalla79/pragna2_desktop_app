import { useState } from 'react';
import { cn } from '@/lib/utils';
import { providerColor, providerInitial } from '@/constants/providers';
import { PROVIDER_LOGO_URLS, MONO_BLACK_PROVIDERS } from '@/assets/providerLogos';
import type { LlmProvider } from '@/domain/types/provider.types';

interface ProviderTileProps {
  llmProvider: LlmProvider;
  connected: boolean;
  /** UserProvider.enabled — undefined when not connected. */
  providerEnabled?: boolean;
  /** Calls PATCH /api/user-providers/{id} to flip the enabled state. Only set when connected. */
  onToggleEnabled?: () => void;
  /**
   * Overrides the connected-badge text (e.g. "2 connected" for a multi-instance
   * provider). Defaults to "Connected ✓" when connected.
   */
  connectedLabel?: string;
  onClick: () => void;
}

/**
 * Square provider tile. Connected state is signalled with the theme's primary
 * accent; not-connected stays neutral (muted). Top-right: enable/disable pill
 * (connected only). Bottom: connected status badge. Theme tokens only.
 */
export function ProviderTile({
  llmProvider,
  connected,
  providerEnabled,
  onToggleEnabled,
  connectedLabel,
  onClick,
}: ProviderTileProps) {
  const [hovered, setHovered] = useState(false);
  const [toggling, setToggling] = useState(false);
  const { bg, fg } = providerColor(llmProvider.name);
  const logoUrl = PROVIDER_LOGO_URLS[llmProvider.name];
  const isMonoBlack = MONO_BLACK_PROVIDERS.has(llmProvider.name);

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onToggleEnabled || toggling) return;
    setToggling(true);
    try {
      await onToggleEnabled();
    } finally {
      setToggling(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative w-40 h-40 flex flex-col gap-2 rounded-xl border-[1.5px] cursor-pointer select-none',
        'pt-4 px-3.5 pb-3 bg-card',
        'transition-[border-color,box-shadow] duration-[180ms]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        connected
          ? hovered
            ? 'border-primary/80 shadow-lg'
            : 'border-primary/40'
          : hovered
            ? 'border-muted-foreground/40 shadow-sm'
            : 'border-border',
      )}
    >
      {/* Enable/disable toggle pill — top-right; only when an enable handler is
          provided (single-instance providers). Multi-instance providers manage
          enable/disable per registration inside the modal, so no tile pill. */}
      {connected && onToggleEnabled && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggling}
          aria-pressed={providerEnabled}
          aria-label={providerEnabled ? 'Disable provider' : 'Enable provider'}
          className={cn(
            'absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full',
            'px-2 py-[3px] text-xs font-semibold border transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            providerEnabled
              ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
              : 'bg-muted text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full flex-shrink-0',
              providerEnabled ? 'bg-primary-foreground' : 'bg-muted-foreground',
            )}
            aria-hidden="true"
          />
          {toggling ? '…' : providerEnabled ? 'On' : 'Off'}
        </button>
      )}

      {/* Logo — 36×36 */}
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={llmProvider.name}
          className={cn('h-9 w-9 flex-shrink-0 rounded-md object-contain', isMonoBlack && 'invert')}
        />
      ) : (
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-base font-bold"
          style={{ background: bg, color: fg }}
          aria-hidden="true"
        >
          {providerInitial(llmProvider.name)}
        </div>
      )}

      {/* Name + technical identifier */}
      <div className="flex flex-1 flex-col gap-[2px]">
        <span className="text-sm font-bold text-foreground leading-tight">
          {llmProvider.displayName}
        </span>
        <span className="text-xs leading-[1.3] text-muted-foreground">
          {llmProvider.name}
        </span>
      </div>

      {/* Connected badge — bottom */}
      <div className="flex items-center">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-xs font-semibold border flex-shrink-0',
            connected
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-muted text-muted-foreground border-border',
          )}
        >
          {connected ? (connectedLabel ?? 'Connected ✓') : 'Not connected'}
        </span>
      </div>
    </div>
  );
}

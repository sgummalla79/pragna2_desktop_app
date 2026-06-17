import PragnaLogo from '@/assets/logo.svg?react';
import { cn } from '@/lib/utils';

interface Props {
  /** Whether a run is in flight — drives the spinning logo + status text. */
  active: boolean;
  /** Latest progress label from the agent's `on_progress` event, if any. */
  label: string | null;
}

/** Default status when the agent is working but hasn't emitted a label yet. */
const DEFAULT_LABEL = 'Thinking…';

/**
 * Persistent "Pragna indicator" at the bottom of the messages column — matches
 * the web FE / claude.ai. Two states:
 *
 * - **Idle** (`active === false`): a static logo, no text — "ready for your next
 *   message". It stays on screen after a reply instead of vanishing.
 * - **Thinking** (`active === true`): the logo spins and the live status label
 *   (or a default) renders beside it.
 */
export function ThinkingStrip({ active, label }: Props) {
  return (
    <div
      data-testid="thinking-strip"
      className="flex w-full items-center gap-2 px-1 py-1"
      role="status"
      aria-live="polite"
      aria-label={
        active ? `Agent status: ${label ?? DEFAULT_LABEL}` : 'Ready for your next message'
      }
    >
      <PragnaLogo
        className={cn(
          'h-7 w-7 shrink-0 text-foreground',
          active && 'animate-[spin_3s_linear_infinite]',
        )}
        aria-hidden="true"
      />
      {active && (
        <span className="text-sm text-muted-foreground">{label ?? DEFAULT_LABEL}</span>
      )}
    </div>
  );
}

import PragnaLogo from '@/assets/logo.svg?react';
import { cn } from '@/lib/utils';

interface Props {
  /** Whether a run is active (drives the spinning logo). */
  active: boolean;
  /** Latest progress label from the agent's `on_progress` event, if any. */
  label: string | null;
}

/** Default status when the agent is working but hasn't emitted a label yet. */
const DEFAULT_LABEL = 'Thinking…';

/**
 * "Pragna indicator" rendered at the bottom of the messages column while a turn
 * is in flight. The logo spins and a live status line shows the agent's latest
 * progress label (or a default). Hidden entirely when no run is active.
 */
export function ThinkingStrip({ active, label }: Props) {
  if (!active) return null;
  return (
    <div
      className="flex w-full items-center gap-2 px-1 py-1"
      role="status"
      aria-live="polite"
      aria-label={`Agent status: ${label ?? DEFAULT_LABEL}`}
    >
      <PragnaLogo
        className={cn(
          'h-7 w-7 shrink-0 text-foreground',
          'animate-[spin_3s_linear_infinite]',
        )}
        aria-hidden="true"
      />
      <span className="text-sm text-muted-foreground">{label ?? DEFAULT_LABEL}</span>
    </div>
  );
}

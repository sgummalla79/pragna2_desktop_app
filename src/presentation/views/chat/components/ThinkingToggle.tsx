import { Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThinkingToggleProps {
  /** Whether extended thinking is currently on. */
  enabled: boolean;
  /** Persist the new toggle value (parent owns persistence). */
  onChange: (enabled: boolean) => void;
}

/**
 * "Extended thinking" toggle for the chat composer, sitting beside the model
 * picker. Always visible: the value is sent on every turn and the backend
 * honours it only when the selected model is thinking-capable, ignoring it
 * gracefully otherwise — so the toggle is provider-agnostic by design.
 */
export function ThinkingToggle({ enabled, onChange }: ThinkingToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      aria-label="Extended thinking"
      title="Extended thinking"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5',
        'text-[13px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        enabled
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Brain size={14} aria-hidden />
      <span>Thinking</span>
    </button>
  );
}

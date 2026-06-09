import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  /** Controlled draft text. */
  value: string;
  onChange: (value: string) => void;
  /** Submit the current draft (parent trims + clears). */
  onSubmit: () => void;
  /** Abort the in-flight run; only shown while `running`. */
  onStop?: () => void;
  /** A run is in flight — the action button becomes Stop. */
  running?: boolean;
  /** Hard-disable sending (e.g. no chat-eligible model). */
  disabled?: boolean;
  placeholder?: string;
  /** Controls below the textarea (model picker, thinking toggle). */
  controls?: ReactNode;
  /** Banner above the input (setup gating). */
  banner?: ReactNode;
  autoFocus?: boolean;
}

/**
 * Chat composer: an auto-growing textarea with an inline send/stop button and
 * an optional row of controls (model picker, thinking toggle). Enter submits;
 * Shift+Enter inserts a newline. Sending is suppressed while a run is in flight
 * or when `disabled`; the button flips to Stop during a run so the user can
 * abort the client stream.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  running = false,
  disabled = false,
  placeholder = 'Message the assistant…',
  controls,
  banner,
  autoFocus,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && !running && value.trim().length > 0;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm focus-within:border-ring">
      {banner}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        autoFocus={autoFocus}
        disabled={disabled}
        className={cn(
          'max-h-48 w-full resize-none overflow-y-auto bg-transparent px-1.5 py-1 text-[15px] leading-relaxed',
          'text-foreground placeholder:text-muted-foreground outline-none',
          'field-sizing-content disabled:opacity-60',
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">{controls}</div>
        {running ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop generating"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90"
          >
            <Square size={14} className="fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => canSend && onSubmit()}
            disabled={!canSend}
            aria-label="Send message"
            title="Send message"
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              canSend
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <ArrowUp size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

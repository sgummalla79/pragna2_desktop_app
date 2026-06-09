import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SLASH_MAX_ITEMS } from '@/constants/slashCommands';
import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';
import { SlashCommandPopover } from './SlashCommandPopover';

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
  /**
   * Flows exposed as `/slash` commands. When provided, typing `/` at the start
   * of a word opens a suggestion popover; accepting one rewrites the draft to
   * `/{slashApiName} `. Dispatch routing is handled by the parent's session hook
   * (it re-parses the leading slash at send time).
   */
  slashFlows?: PragnaSlashFlow[];
}

/**
 * Chat composer: an auto-growing textarea with an inline send/stop button and
 * an optional row of controls (model picker, thinking toggle). Enter submits;
 * Shift+Enter inserts a newline. Sending is suppressed while a run is in flight
 * or when `disabled`; the button flips to Stop during a run so the user can
 * abort the client stream.
 *
 * When `slashFlows` is supplied, the composer also drives a `/slash` command
 * popover: while the popover is open the arrow keys move the highlight,
 * Enter/Tab accept, and Escape dismisses — so those keys don't submit/newline.
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
  slashFlows,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && !running && value.trim().length > 0;

  // ── Slash command popover state ─────────────────────────────────────────────
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashStart, setSlashStart] = useState(0);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  const allSlashFlows = slashFlows ?? [];

  // Detect / dismiss the popover on every value change. The cursor position is
  // read off the live DOM element (the textarea owns the selection; `value`
  // only tracks text). Slash is "active" when a `/` sits between the start of
  // the current word and the cursor, with no whitespace after it.
  useEffect(() => {
    if (allSlashFlows.length === 0) {
      setSlashOpen(false);
      return;
    }
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? value.length;
    // Walk backwards from the cursor: stop at the first whitespace (word
    // boundary) or the first `/`.
    let i = cursor - 1;
    while (i >= 0 && value[i] !== '/' && !/\s/.test(value[i])) i--;
    if (i >= 0 && value[i] === '/' && (i === 0 || /\s/.test(value[i - 1]))) {
      const q = value.slice(i + 1, cursor);
      // The query must contain no whitespace — keeps the popover closed for
      // pasted text like "/foo bar".
      if (!/\s/.test(q)) {
        setSlashOpen(true);
        setSlashStart(i);
        setSlashQuery(q);
        setSlashIndex(0);
        return;
      }
    }
    setSlashOpen(false);
  }, [value, allSlashFlows.length]);

  const filteredSlashFlows = useMemo<PragnaSlashFlow[]>(() => {
    if (!slashOpen) return [];
    const q = slashQuery.toLowerCase();
    return allSlashFlows
      .filter((f) => f.slashApiName.toLowerCase().startsWith(q))
      .slice(0, SLASH_MAX_ITEMS);
  }, [allSlashFlows, slashOpen, slashQuery]);

  const slashActive = slashOpen && filteredSlashFlows.length > 0;

  const acceptSlash = useCallback(
    (flow: PragnaSlashFlow) => {
      const before = value.slice(0, slashStart);
      const after = value.slice(slashStart + 1 + slashQuery.length);
      const next = `${before}/${flow.slashApiName} ${after}`;
      onChange(next);
      setSlashOpen(false);
      // Place the caret just past the inserted name + trailing space so the
      // user can keep typing the prompt without a manual click.
      const caret = before.length + 1 + flow.slashApiName.length + 1;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    },
    [value, slashStart, slashQuery, onChange],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // While the popover is open, these keys drive it instead of the composer.
    if (slashActive) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % filteredSlashFlows.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex(
          (i) => (i - 1 + filteredSlashFlows.length) % filteredSlashFlows.length,
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        acceptSlash(filteredSlashFlows[slashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <div className="relative flex flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm focus-within:border-ring">
      {slashActive && (
        <SlashCommandPopover
          items={filteredSlashFlows}
          selectedIndex={slashIndex}
          onSelect={acceptSlash}
          onHoverIndex={setSlashIndex}
        />
      )}
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

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';

interface SlashCommandPopoverProps {
  /** Pre-filtered, capped suggestions to render (already sliced by the parent). */
  items: PragnaSlashFlow[];
  /** Index of the highlighted item (keyboard/hover synced by the parent). */
  selectedIndex: number;
  /** Accept a suggestion (parent rewrites the composer text + caret). */
  onSelect: (flow: PragnaSlashFlow) => void;
  /** Sync the highlight as the pointer moves over items. */
  onHoverIndex: (index: number) => void;
}

/**
 * Suggestion list shown above the composer while the user is typing a `/slash`
 * command. Purely presentational: the parent ({@link ChatInput}) owns the open
 * state, the filtered list, and keyboard navigation; this renders the list and
 * forwards select/hover. Anchored to the composer via an absolutely-positioned
 * container, so the parent must be `relative`.
 */
export function SlashCommandPopover({
  items,
  selectedIndex,
  onSelect,
  onHoverIndex,
}: SlashCommandPopoverProps) {
  const selectedRef = useRef<HTMLLIElement>(null);

  // Keep the highlighted row in view as keyboard nav moves past the fold.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div
      role="listbox"
      aria-label="Slash command suggestions"
      className={cn(
        'absolute bottom-full left-0 right-0 z-30 mb-2',
        'overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl',
      )}
    >
      <ul className="m-0 max-h-64 list-none overflow-y-auto p-1">
        {items.map((flow, idx) => {
          const active = idx === selectedIndex;
          return (
            <li
              key={flow.slashApiName}
              ref={active ? selectedRef : null}
              role="option"
              aria-selected={active}
              // `onMouseDown` (not `onClick`) so the textarea keeps focus and the
              // blur-driven popover close doesn't fire before selection lands.
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(flow);
              }}
              onMouseEnter={() => onHoverIndex(idx)}
              className={cn(
                'flex cursor-pointer flex-col gap-0.5 rounded-md px-2.5 py-1.5',
                active ? 'bg-accent text-accent-foreground' : 'text-foreground',
              )}
            >
              <span className="font-mono text-[13px] font-semibold">
                /{flow.slashApiName}
              </span>
              {flow.description && (
                <span className="line-clamp-2 text-[11px] text-muted-foreground">
                  {flow.description}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

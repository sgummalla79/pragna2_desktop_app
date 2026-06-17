import { useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Footer state of a disclosure: still working, or finished. */
export type ActivityStatus = 'running' | 'done';

interface ActivityDisclosureProps {
  /** One-line summary shown in the collapsed header (truncated). */
  summary: string;
  /** Header text when expanded; defaults to {@link summary}. */
  openLabel?: string;
  /** Footer node: a spinner + "Working…" while running, a check + "Done" when
   *  finished. Defaults to `done`. */
  status?: ActivityStatus;
  /** Mount expanded (streaming surfaces pass `true`); defaults to collapsed. */
  defaultOpen?: boolean;
  /** Optional small leading icon in the header (e.g. a tool glyph). */
  leadingIcon?: ReactNode;
  /** Expanded detail, rendered next to the timeline's Clock node. */
  children: ReactNode;
}

/**
 * A reusable, collapsible "activity" disclosure rendered beneath an assistant
 * turn — the shared visual language for reasoning traces, tool calls, and any
 * future agent activity that should stay out of the way until inspected.
 *
 * A faint summary header with a chevron expands into a short vertical timeline:
 * a Clock node carrying the detail, then a terminal node (a spinner "Working…"
 * while running, or a "Done" check when finished). Collapsed by default; a
 * local `useState` toggle keeps the dependency surface narrow (no Collapsible).
 *
 * Consumers (`ReasoningPanel`, `ToolCallBadge`, …) supply only the summary,
 * label, status, and body — never their own chrome — so every activity reads
 * identically.
 */
export function ActivityDisclosure({
  summary,
  openLabel,
  status = 'done',
  defaultOpen = false,
  leadingIcon,
  children,
}: ActivityDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-md py-1.5 text-left',
          'text-[13px] text-muted-foreground transition-colors hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        )}
      >
        {leadingIcon && <span className="shrink-0">{leadingIcon}</span>}
        <span className="min-w-0 flex-1 truncate">
          {open ? (openLabel ?? summary) : summary}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ol className="relative mt-1 space-y-3 pl-1">
          <li className="relative flex gap-3 pb-1">
            <span
              className="absolute left-[9px] top-5 h-[calc(100%-4px)] w-px bg-border"
              aria-hidden="true"
            />
            <Clock
              className="relative z-10 mt-0.5 h-[18px] w-[18px] shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0 text-[14px] leading-relaxed text-muted-foreground">
              {children}
            </div>
          </li>
          <li className="flex items-center gap-3">
            {status === 'running' ? (
              <Loader2
                className="relative z-10 h-[18px] w-[18px] shrink-0 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="relative z-10 h-[18px] w-[18px] shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            )}
            <span className="text-[14px] text-muted-foreground">
              {status === 'running' ? 'Working…' : 'Done'}
            </span>
          </li>
        </ol>
      )}
    </div>
  );
}

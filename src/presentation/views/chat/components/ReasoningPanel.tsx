import { useMemo } from 'react';
import { ActivityDisclosure } from './ActivityDisclosure';

interface ReasoningPanelProps {
  /** The model's extended-thinking trace (BE migration 0026). */
  reasoning: string;
  /** Mount expanded (the streaming surface passes `true` so the trace is
   *  visible live); defaults to collapsed for persisted history. */
  defaultOpen?: boolean;
}

/** Max characters of the collapsed-header summary before we ellipsise. */
const SUMMARY_MAX_CHARS = 96;

/**
 * Collapsible reasoning timeline rendered beneath an assistant turn.
 *
 * A thin wrapper over the shared {@link ActivityDisclosure}: it derives the
 * collapsed summary from the trace's first line and hands the full trace in as
 * the expanded body. All chrome (header, chevron, timeline, "Done") lives in
 * the shared component so reasoning reads identically to tool calls and any
 * future activity.
 */
export function ReasoningPanel({ reasoning, defaultOpen = false }: ReasoningPanelProps) {
  // Collapsed-header preview: first non-empty line, whitespace-collapsed.
  const summary = useMemo(() => {
    const firstLine =
      reasoning
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0) ?? reasoning.trim();
    const collapsed = firstLine.replace(/\s+/g, ' ');
    return collapsed.length > SUMMARY_MAX_CHARS
      ? `${collapsed.slice(0, SUMMARY_MAX_CHARS).trimEnd()}…`
      : collapsed;
  }, [reasoning]);

  return (
    <ActivityDisclosure summary={summary} openLabel="Reasoning" defaultOpen={defaultOpen}>
      <p className="whitespace-pre-wrap break-words">{reasoning}</p>
    </ActivityDisclosure>
  );
}

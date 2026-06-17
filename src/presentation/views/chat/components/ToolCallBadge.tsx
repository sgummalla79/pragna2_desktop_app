import { useMemo } from 'react';
import { Wrench } from 'lucide-react';
import type { ChatToolCall } from '@/presentation/views/chat/hooks/useChatSession';
import { ActivityDisclosure } from './ActivityDisclosure';
import { toolArgEntries, toolArgSummary, toolDisplayLabel } from '../utils/toolDisplay';

interface ToolCallBadgeProps {
  call: ChatToolCall;
}

/**
 * Inline renderer for a single tool call under an assistant turn.
 *
 * Renders through the shared {@link ActivityDisclosure} so a tool call reads
 * exactly like a reasoning trace: a clean collapsed summary (friendly tool
 * label + primary argument), expanding into the arguments as readable
 * key/value lines and a "Working…/Done" footer. It NEVER shows the raw internal
 * tool name, raw args JSON, or the raw result payload (pragna2-tracker — clean
 * tool rendering); the model's prose answer conveys the outcome.
 */
export function ToolCallBadge({ call }: ToolCallBadgeProps) {
  const label = useMemo(() => toolDisplayLabel(call.name), [call.name]);
  const argSummary = useMemo(() => toolArgSummary(call.args), [call.args]);
  const entries = useMemo(() => toolArgEntries(call.args), [call.args]);

  const summary = argSummary ? `${label} · ${argSummary}` : label;

  return (
    <div data-testid="tool-call-badge">
      <ActivityDisclosure
        summary={summary}
        openLabel={label}
        status={call.complete ? 'done' : 'running'}
        leadingIcon={
          <Wrench className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        }
      >
        {entries.length > 0 ? (
          <dl className="space-y-0.5">
            {entries.map((e) => (
              <div key={e.key} className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground/70">{e.key}:</dt>
                <dd className="min-w-0 break-words">{e.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <span>{label}</span>
        )}
      </ActivityDisclosure>
    </div>
  );
}

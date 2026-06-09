import type { ChatToolCall } from '@/presentation/views/chat/hooks/useChatSession';

interface ToolCallBadgeProps {
  call: ChatToolCall;
}

/**
 * Inline renderer for a single tool call under an assistant turn.
 *
 * Shows the tool name, the (partial) JSON arguments as they stream in, and —
 * once the matching `ToolCallResultEvent` arrives — the string result. Kept
 * low-contrast so it doesn't dominate the assistant's prose.
 */
export function ToolCallBadge({ call }: ToolCallBadgeProps) {
  const argsPreview =
    call.args !== undefined
      ? JSON.stringify(call.args)
      : (call.argsBuffer || '…').trim();

  return (
    <div className="my-2 rounded-md border border-border bg-accent px-3 py-2 text-[12px]">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-primary">tool</span>
        <span className="font-mono text-[12px] font-semibold text-foreground">
          {call.name}
        </span>
        {!call.complete && (
          <span className="text-[11px] text-muted-foreground">running…</span>
        )}
      </div>
      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-foreground">
        {argsPreview}
      </pre>
      {call.result !== undefined && (
        <div className="mt-2 border-t border-border pt-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            result
          </span>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[12px] text-foreground">
            {call.result}
          </pre>
        </div>
      )}
    </div>
  );
}

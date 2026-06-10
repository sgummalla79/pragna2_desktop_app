import { useState } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Flow } from '@/domain/types/flow.types';
import type { ChatToolCall } from '@/presentation/views/chat/hooks/useChatSession';

interface FlowProposalCardProps {
  /** The flow this `propose_flow_*` tool call refers to (matched by api_name). */
  flow: Flow;
  /** The propose-flow tool call; `args.summary` arrives once it finishes streaming. */
  call: ChatToolCall;
  /**
   * Accept the proposal — starts an episode for {@link flow}. Receives the LLM's
   * summary + the user's optional extra context. The parent passes the flow's
   * **bare `apiName`** to `startEpisode` (NOT the prefixed tool name — the create
   * endpoint looks up by `api_name`).
   */
  onAccept: (summary: string, additionalContext: string) => void;
  /** True while an episode run is in flight (disables the actions). */
  busy?: boolean;
}

/**
 * Inline confirmation card rendered when the agent proposes one of the user's
 * flows via a `propose_flow_<api_name>` tool call. Shows the flow name, the LLM's
 * summary, the flow description, and an optional extra-context box; Confirm starts
 * the flow as an episode (which may immediately pause into a HITL form), Skip
 * dismisses it locally.
 *
 * Confirm is gated until the tool-call args finish streaming (`call.complete`),
 * so a fast click can't fire against a half-streamed `summary`.
 */
export function FlowProposalCard({ flow, call, onAccept, busy }: FlowProposalCardProps) {
  const [additionalContext, setAdditionalContext] = useState('');
  const [decision, setDecision] = useState<'confirmed' | 'skipped' | null>(null);

  const args = call.args as { summary?: string } | undefined;
  const summary = args?.summary?.trim() ?? '';
  const argsReady = call.complete;

  if (decision === 'skipped') {
    return (
      <div className="text-[12px] text-muted-foreground">
        Skipped the “{flow.displayName}” suggestion.
      </div>
    );
  }

  const confirm = () => {
    if (!argsReady || busy) return;
    setDecision('confirmed');
    onAccept(summary, additionalContext.trim());
  };

  return (
    <div className="my-1 rounded-lg border border-primary/30 bg-accent/30 p-3 text-[13px]">
      <div className="flex items-center gap-2">
        <Zap size={15} className="text-primary" aria-hidden />
        <span className="font-semibold text-foreground">
          Suggested flow: {flow.displayName}
        </span>
      </div>

      {summary && <p className="mt-1.5 text-foreground/90">{summary}</p>}
      {flow.description && (
        <p className="mt-1 text-[12px] text-muted-foreground">{flow.description}</p>
      )}

      {decision !== 'confirmed' && (
        <Textarea
          className="mt-2"
          rows={2}
          value={additionalContext}
          disabled={busy}
          placeholder="Add any extra context (optional)…"
          onChange={(e) => setAdditionalContext(e.target.value)}
        />
      )}

      <div className="mt-2 flex items-center justify-end gap-2">
        {decision === 'confirmed' ? (
          <span className="text-[12px] text-muted-foreground">
            {busy ? 'Starting…' : 'Started.'}
          </span>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setDecision('skipped')}
            >
              Skip
            </Button>
            <Button size="sm" disabled={!argsReady || busy} onClick={confirm}>
              {argsReady ? 'Run flow' : 'Preparing…'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

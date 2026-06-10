import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Flow } from '@/domain/types/flow.types';
import type { ChatMessage as ChatMessageModel } from '@/presentation/views/chat/hooks/useChatSession';
import { MarkdownMessage } from './MarkdownMessage';
import { ReasoningPanel } from './ReasoningPanel';
import { ToolCallBadge } from './ToolCallBadge';
import { ModelBadge } from './ModelBadge';
import { FlowProposalCard } from './FlowProposalCard';

/** Backend prefix for propose-flow tool names (`propose_flow_<api_name>`). */
const PROPOSE_FLOW_PREFIX = 'propose_flow_';

interface ChatMessageProps {
  message: ChatMessageModel;
  /** Whether this turn is currently mid-stream (drives live reasoning open). */
  streaming?: boolean;
  /** Producer-model id for the "by <model>" attribution (assistant turns). */
  userModelId?: string | null;
  /**
   * The user's flows, used to detect `propose_flow_<api_name>` tool calls and
   * render a {@link FlowProposalCard} instead of a plain tool badge. Omitted
   * where proposals aren't wired (e.g. the landing).
   */
  proposalFlows?: Flow[];
  /**
   * Accept a flow proposal → start the episode. Receives the matched flow's
   * **bare `apiName`** (not the prefixed tool name) plus the LLM summary + the
   * user's extra context. Absent → propose-flow calls render as plain badges.
   */
  onAcceptProposal?: (
    flowApiName: string,
    summary: string,
    additionalContext: string,
  ) => void;
  /** True while an episode run is in flight (disables proposal actions). */
  proposalBusy?: boolean;
}

/**
 * Renders one chat turn.
 *
 * - **User** turns: a right-aligned rounded bubble in the primary tint.
 * - **Assistant** turns: full-width markdown, with an optional reasoning panel
 *   above, tool-call badges inline, and a quiet model attribution below.
 * - **Tool / system** turns: minimal muted text (rarely surfaced directly).
 */
export function ChatMessage({
  message,
  streaming,
  userModelId,
  proposalFlows,
  onAcceptProposal,
  proposalBusy,
}: ChatMessageProps) {
  // Map propose-flow tool names → the flow they refer to, so a matching tool
  // call renders a proposal card instead of a badge.
  const proposalFlowByToolName = useMemo(() => {
    const map = new Map<string, Flow>();
    for (const f of proposalFlows ?? []) {
      map.set(`${PROPOSE_FLOW_PREFIX}${f.apiName}`, f);
    }
    return map;
  }, [proposalFlows]);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary/10 px-4 py-2.5 text-[15px] leading-relaxed text-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'tool' || message.role === 'system') {
    return (
      <div className="text-[13px] text-muted-foreground">{message.content}</div>
    );
  }

  // Assistant turn.
  return (
    <div className="flex flex-col gap-1.5">
      {message.reasoning && (
        <ReasoningPanel reasoning={message.reasoning} defaultOpen={streaming} />
      )}
      {message.content && <MarkdownMessage content={message.content} />}
      {message.toolCalls?.map((call) => {
        const proposed = proposalFlowByToolName.get(call.name);
        if (proposed && onAcceptProposal) {
          return (
            <FlowProposalCard
              key={call.id}
              flow={proposed}
              call={call}
              busy={proposalBusy}
              onAccept={(summary, additionalContext) =>
                onAcceptProposal(proposed.apiName, summary, additionalContext)
              }
            />
          );
        }
        return <ToolCallBadge key={call.id} call={call} />;
      })}
      {!streaming && (
        <div className={cn('mt-0.5', !message.content && 'mt-0')}>
          <ModelBadge userModelId={userModelId} />
        </div>
      )}
    </div>
  );
}

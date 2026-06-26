import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Flow } from '@/domain/types/flow.types';
import type { Attachment } from '@/domain/types/attachment.types';
import type { FinishReason } from '@/domain/types/conversation.types';
import type { ChatMessage as ChatMessageModel } from '@/presentation/views/chat/hooks/useChatSession';
import { MarkdownMessage } from './MarkdownMessage';
import { ReasoningPanel } from './ReasoningPanel';
import { ToolCallBadge } from './ToolCallBadge';
import { ModelBadge } from './ModelBadge';
import { AgentBadge } from './AgentBadge';
import { FlowProposalCard } from './FlowProposalCard';
import { AttachmentChip } from './AttachmentChip';
import { DocumentCard } from './DocumentCard';
import { MessageActions, type ModelOption } from './MessageActions';
import { DOCUMENT_TOOL_NAMES } from '@/constants/documentTools';
import { PROPOSE_FLOW_PREFIX } from '@/constants/chat';


/** Per-message action callbacks (edit/branch on user; regen/continue on assistant). */
export interface MessageActionHandlers {
  onEdit?: (messageId: string, newContent: string) => void;
  onBranch?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onRegenerateWithModel?: (messageId: string, modelId: string) => void;
  onContinue?: () => void;
}

interface ChatMessageProps {
  message: ChatMessageModel;
  /** Whether this turn is currently mid-stream (drives live reasoning open). */
  streaming?: boolean;
  /** Producer-model id for the "by <model>" attribution (assistant turns). */
  userModelId?: string | null;
  /** Producing agent id for the persona attribution (assistant turns); shows
   *  which standalone agent answered after a mid-chat switch (#147). */
  userAgentId?: string | null;
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
  /** Files attached to this turn (from the persisted message). */
  attachments?: Attachment[];
  /** Open an attachment in the viewer (image/PDF inline, else download). */
  onOpenAttachment?: (attachment: Attachment) => void;
  /** Message-action callbacks; when present, hover reveals the action row. */
  actions?: MessageActionHandlers;
  /** Show the Branch button on user turns (chat preference). */
  branchEnabled?: boolean;
  /** Models for the regenerate-with-model dropdown (empty hides it). */
  availableModels?: ModelOption[];
  /** True for the chronologically last assistant turn (gates Continue). */
  isLastAssistant?: boolean;
  /** Persisted finish reason; `'length'` on the last assistant turn shows Continue. */
  finishReason?: FinishReason | null;
  /**
   * Suppress this message's reasoning panel. The {@link AssistantTurn} grouping
   * folds the whole turn's reasoning into one activity umbrella, so the answer
   * message it renders must not also show its own reasoning strip.
   */
  hideReasoning?: boolean;
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
  userAgentId,
  proposalFlows,
  onAcceptProposal,
  proposalBusy,
  attachments,
  onOpenAttachment,
  actions,
  branchEnabled = true,
  availableModels,
  isLastAssistant,
  finishReason,
  hideReasoning,
}: ChatMessageProps) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  // Map propose-flow tool names → the flow they refer to, so a matching tool
  // call renders a proposal card instead of a badge.
  const proposalFlowByToolName = useMemo(() => {
    const map = new Map<string, Flow>();
    for (const f of proposalFlows ?? []) {
      map.set(`${PROPOSE_FLOW_PREFIX}${f.apiName}`, f);
    }
    return map;
  }, [proposalFlows]);

  const attachmentChips = (justifyEnd: boolean) =>
    attachments && attachments.length > 0 ? (
      <div className={cn('flex flex-wrap gap-1.5', justifyEnd && 'justify-end')}>
        {attachments.map((a) => (
          <AttachmentChip
            key={a.id}
            filename={a.filename}
            contentType={a.contentType}
            onClick={onOpenAttachment ? () => onOpenAttachment(a) : undefined}
          />
        ))}
      </div>
    ) : null;

  if (message.role === 'user') {
    if (editing) {
      const trimmed = editDraft.trim();
      return (
        <div data-role="user" className="flex w-full flex-col items-end gap-2">
          <Textarea
            value={editDraft}
            autoFocus
            rows={3}
            onChange={(e) => setEditDraft(e.target.value)}
            className="w-full max-w-[85%]"
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!trimmed}
              onClick={() => {
                setEditing(false);
                actions?.onEdit?.(message.id, trimmed);
              }}
            >
              Save &amp; submit
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div data-role="user" className="group flex flex-col items-end gap-1.5">
        {attachmentChips(true)}
        {message.content && (
          <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary/10 px-4 py-2.5 text-[15px] leading-relaxed text-foreground">
            {message.content}
          </div>
        )}
        {actions?.onEdit && (
          <MessageActions
            role="user"
            onEdit={() => {
              setEditDraft(message.content);
              setEditing(true);
            }}
            onBranch={() => actions.onBranch?.(message.id)}
            showBranch={branchEnabled && Boolean(actions.onBranch)}
          />
        )}
      </div>
    );
  }

  // Tool-result messages are represented by the assistant turn's clean tool
  // activity badge (ToolCallBadge); their raw content is the tool's result
  // payload (often a large JSON blob) and must never be dumped into the
  // transcript. Suppress them entirely — the assistant's prose conveys the
  // outcome (pragna2-tracker — clean tool rendering).
  if (message.role === 'tool') return null;

  if (message.role === 'system') {
    return (
      <div data-role="system" className="text-[13px] text-muted-foreground">
        {message.content}
      </div>
    );
  }

  // Assistant turn.
  const showContinue =
    !streaming &&
    isLastAssistant &&
    finishReason === 'length' &&
    Boolean(actions?.onContinue);

  // A tool-call row (the empty-content `tool_calls` row, the document/flow-
  // proposal card row) is intermediate turn machinery, not a regeneratable
  // answer — its "regenerate" would re-run from a mid-turn boundary (a dangling
  // tool call), so suppress the action row there. Regenerate belongs only on the
  // turn's final text reply (an assistant message with no tool calls).
  const isToolCallRow = (message.toolCalls?.length ?? 0) > 0;

  return (
    <div data-role="assistant" className="group flex flex-col gap-1.5">
      {message.reasoning && !hideReasoning && (
        <ReasoningPanel reasoning={message.reasoning} defaultOpen={streaming} />
      )}
      {message.content && (
        <MarkdownMessage content={message.content} isStreaming={streaming} />
      )}
      {message.toolCalls?.map((call) => {
        // Document tools (create_pdf_short / create_pdf_long) surface as a
        // DocumentCard below the reply — suppress the generic badge so the raw
        // JSON args / "PDF … created" ack never show. See constants/documentTools.
        if (DOCUMENT_TOOL_NAMES.has(call.name)) return null;
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
      {/* Assistant-generated documents (e.g. create_pdf PDFs) render as
          full-width cards that open in the attachment viewer. */}
      {attachments && attachments.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {attachments.map((a) => (
            <DocumentCard key={a.id} attachment={a} onOpen={onOpenAttachment} />
          ))}
        </div>
      )}
      {!streaming && (
        <div className={cn('flex items-center gap-2', !message.content && 'mt-0', message.content && 'mt-0.5')}>
          <AgentBadge agentId={userAgentId} />
          <ModelBadge userModelId={userModelId} />
          {actions?.onRegenerate && !isToolCallRow && (
            <MessageActions
              role="assistant"
              content={message.content}
              onRegenerate={() => actions.onRegenerate?.(message.id)}
              onRegenerateWithModel={
                actions.onRegenerateWithModel
                  ? (modelId) => actions.onRegenerateWithModel?.(message.id, modelId)
                  : undefined
              }
              availableModels={availableModels}
            />
          )}
        </div>
      )}
      {showContinue && (
        <div className="mt-1 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => actions?.onContinue?.()}>
            Continue
          </Button>
          <span className="text-[12px] text-muted-foreground">Response was cut short.</span>
        </div>
      )}
    </div>
  );
}

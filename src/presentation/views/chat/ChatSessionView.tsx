import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Message } from '@ag-ui/client';
import { ROUTES } from '@/constants/routes';
import { CONTINUE_PROMPT, TERMINAL_FINISH_REASONS } from '@/constants/chat';
import { useConversation } from '@/presentation/hooks/conversations/useConversation';
import { useConversationMessages } from '@/presentation/hooks/conversations/useConversationMessages';
import {
  useBranchConversation,
  useSetConversationAgent,
  useSetConversationModel,
  useSetThinkingEnabled,
  useTruncateFromMessage,
} from '@/presentation/hooks/conversations/useConversationMutations';
import { usePragnaSlashFlows } from '@/presentation/hooks/flows/usePragnaSlashFlows';
import { useFlows } from '@/presentation/hooks/flows/useFlows';
import { useOpenEpisode } from '@/presentation/hooks/episodes/useEpisodes';
import {
  LONG_PDF_EPISODE_SENTINEL,
  LONG_PDF_GENERATING_LABEL,
} from '@/constants/documentTools';
import {
  SIDEBAR_BOX_INSET_PX,
  SIDEBAR_BOX_GAP_PX,
  SIDEBAR_TITLE_ROW_PX,
  CHAT_SIDEBAR_WIDTH_PX,
  TITLEBAR_SEARCH_LEFT_PX,
  TOGGLE_BUTTON_PX,
  TITLE_GAP_PX,
  TRAFFIC_LIGHT_Y,
} from '@/constants/windowChrome';
import { useUiStore } from '@/presentation/store/uiStore';
import { useRefetchOpenEpisodeOnSettle } from './hooks/useRefetchOpenEpisodeOnSettle';
import { useChatModels } from './hooks/useChatModels';
import { useChatPreferences } from '@/presentation/hooks/preferences/useChatPreferences';
import { toast } from 'sonner';
import { logger } from '@/infrastructure/logging/logger';
import { detailOr } from '@/lib/httpError';
import { ERRORS } from '@/constants/errors';
import type {
  Conversation,
  PersistedMessage,
} from '@/domain/types/conversation.types';
import type { Attachment } from '@/domain/types/attachment.types';
import { ChatInput } from './components/ChatInput';
import { ChatMessage } from './components/ChatMessage';
import { AttachmentViewer } from './components/AttachmentViewer';
import { HITLFormCard } from './components/hitl/HITLFormCard';
import { ReauthCard } from './components/hitl/ReauthCard';
import { ModelPicker } from './components/ModelPicker';
import { AgentPicker } from './components/AgentPicker';
import { ThinkingToggle } from './components/ThinkingToggle';
import { ThinkingStrip } from './components/ThinkingStrip';
import { useChatSession, type ChatMessage as ChatMessageModel } from './hooks/useChatSession';
import { AssistantTurn } from './components/AssistantTurn';
import { groupChatMessages } from './utils/assistantTurns';
import { useReconcileMessages } from './hooks/useReconcileMessages';
import {
  clearPendingInitialMessage,
  readPendingInitialMessage,
  writePendingInitialMessage,
} from './hooks/initialMessageHandoff';

/** Placeholder header title before the auto-title lands. */
const UNTITLED = 'New chat';

/** Map a persisted message to the AG-UI seed shape (content + reasoning +
 *  tool calls). Carrying `tool_calls` lets the chat surface rehydrate historical
 *  tool-call badges on resume (pragna2-tracker TD-018). */
function persistedToAGUIMessage(m: PersistedMessage): Message {
  const base: Record<string, unknown> = {
    id: m.id,
    role: m.role,
    content: m.content,
  };
  if (m.role === 'assistant' && m.reasoning) base.reasoning = m.reasoning;
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    base.toolCalls = m.toolCalls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) },
    }));
  }
  return base as unknown as Message;
}

/**
 * Active conversation view for `/chat/:id`.
 *
 * Loads the persisted message log first, then mounts {@link ChatConversation}
 * keyed by the conversation id so the underlying agent is created with the full
 * history as its seed (and is recreated fresh on every conversation switch).
 */
export default function ChatSessionView() {
  const { id } = useParams();
  const conversationId = id ?? '';
  const conversationQuery = useConversation(conversationId);
  const messagesQuery = useConversationMessages(conversationId, {
    enabled: Boolean(conversationId),
  });

  if (!conversationId) return null;

  // Wait for the history fetch before mounting the session so the agent seeds
  // with it (the agent only reads `initialMessages` at creation time).
  if (messagesQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading conversation…
      </div>
    );
  }

  const persisted = messagesQuery.data ?? [];

  return (
    <ChatConversation
      key={conversationId}
      conversationId={conversationId}
      conversation={conversationQuery.data ?? null}
      persisted={persisted}
    />
  );
}

interface ChatConversationProps {
  conversationId: string;
  conversation: Conversation | null;
  persisted: PersistedMessage[];
}

/** Inner session surface — owns the chat agent for one conversation. */
function ChatConversation({
  conversationId,
  conversation,
  persisted,
}: ChatConversationProps) {
  const navigate = useNavigate();
  const setModel = useSetConversationModel();
  const setAgent = useSetConversationAgent();
  const setThinking = useSetThinkingEnabled();
  const truncate = useTruncateFromMessage();
  const branch = useBranchConversation();
  const { prefs } = useChatPreferences();
  const { chatModels } = useChatModels();

  const initialMessages = useMemo(
    () => persisted.map(persistedToAGUIMessage),
    [persisted],
  );

  // Slash-exposed flows for the composer popover + per-turn dispatch. Discovery
  // failures degrade gracefully (no popover); they're logged in the hook layer.
  const { data: slashFlows } = usePragnaSlashFlows();
  const slashFlowNames = useMemo(
    () => new Set((slashFlows ?? []).map((f) => f.slashApiName)),
    [slashFlows],
  );

  const {
    messages,
    status,
    error,
    progressLabel,
    send,
    sendWithOverrides,
    sendWithModel,
    stop,
    streamingMessageIds,
    streamingModelByMessageId,
    pendingInterrupt,
    submitInterrupt,
    pendingReauth,
    submitReauth,
    startEpisode,
    attach,
    replaceMessages,
    reconcileBlocked,
  } = useChatSession({ threadId: conversationId, initialMessages, slashFlowNames });

  // Reconcile in-memory → persisted once a run settles (see useReconcileMessages).
  // `reconcileBlocked` holds it shut during a raw episode/delegation resume until
  // the /messages refetch lands, so a stale snapshot can't wipe the turn (#158).
  useReconcileMessages(
    status,
    messages,
    persisted,
    initialMessages,
    replaceMessages,
    reconcileBlocked,
  );

  // ── Background document episode (create_pdf_long) ──────────────────────────
  // create_pdf_long acks instantly, then generates the document in a SEPARATE
  // background episode and posts it back as a later assistant turn + PDF. We
  // discover that episode and attach to its live stream so the document surfaces
  // with no manual reload (CF-005 / pragna2-tracker TD-030). Refetch the open-episode query when
  // the ack run settles (the doc episode is spawned just before RUN_FINISHED).
  const openEpisode = useOpenEpisode(conversationId);
  useRefetchOpenEpisodeOnSettle(status, conversationId);

  // Auto-attach to a live/active episode (mount-with-active, or the doc episode
  // discovered on settle). Guarded so we don't double-POST while the open-episode
  // query re-renders, and never while a foreground run is already streaming.
  const attachedEpisodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    const ep = openEpisode.data;
    if (!ep || ep.status !== 'active') return;
    if (status === 'running') return;
    if (attachedEpisodeIdRef.current === ep.id) return;
    attachedEpisodeIdRef.current = ep.id;
    attach(conversationId, ep.id);
  }, [openEpisode.data, status, conversationId, attach]);

  // True while a background create_pdf_long document episode is generating —
  // drives the "Generating your document…" thinking-strip label.
  const isLongPdfEpisode =
    openEpisode.data?.status === 'active' &&
    openEpisode.data?.seedSummary === LONG_PDF_EPISODE_SENTINEL;

  // Flows for detecting `propose_flow_*` tool calls → proposal cards.
  const { data: proposalFlows } = useFlows();

  const [draft, setDraft] = useState('');
  // The attachment currently open in the full-screen viewer (null = closed).
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);

  // Per-message producer-model attribution: persisted ids → userModelId,
  // overlaid by the live streaming map for the in-flight turn.
  const persistedModelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of persisted) {
      if (m.role === 'assistant' && m.userModelId) map.set(m.id, m.userModelId);
    }
    return map;
  }, [persisted]);

  // Per-message producer-agent attribution: persisted assistant ids → agentId,
  // so a transcript whose agent was switched mid-chat shows the right persona per
  // turn. The live streaming turn has no persisted agent yet → falls back to the
  // conversation's current active agent at the render site.
  const persistedAgentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of persisted) {
      if (m.role === 'assistant' && m.agentId) map.set(m.id, m.agentId);
    }
    return map;
  }, [persisted]);

  // Persisted attachments per message id (the live AG-UI messages don't carry
  // them; they come from the persisted message log).
  const attachmentsByMessageId = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    for (const m of persisted) {
      if (m.attachments.length > 0) map.set(m.id, m.attachments);
    }
    return map;
  }, [persisted]);

  // Persisted finish reason per message id; `'length'` on the last assistant
  // turn surfaces a Continue affordance.
  const finishReasonById = useMemo(() => {
    const map = new Map<string, PersistedMessage['finishReason']>();
    for (const m of persisted) {
      if (m.role === 'assistant') map.set(m.id, m.finishReason);
    }
    return map;
  }, [persisted]);

  // Id of the chronologically last assistant turn (gates Continue).
  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);

  // Group the flat message list into user/system messages + assistant turns, so
  // each turn's intermediate work folds into one activity umbrella (claude.ai
  // style). The streaming turn is the last assistant turn while a run is live.
  const groups = useMemo(
    () =>
      groupChatMessages(messages, (m) => {
        // End a turn at a persisted TERMINAL finish reason so a previously-
        // completed assistant turn isn't merged with a later adjacent one (e.g. a
        // re-attached streaming run after a remount, whose originating user
        // message isn't in the re-seeded list yet) — otherwise the prior turn's
        // answer + reasoning fold into the live activity umbrella (tracker #148).
        // `tool_calls` (mid-turn) and `null`/legacy rows are not terminal — see
        // TERMINAL_FINISH_REASONS for the rationale + the legacy-row caveat.
        const fr = finishReasonById.get(m.id);
        return fr != null && TERMINAL_FINISH_REASONS.has(fr);
      }),
    [messages, finishReasonById],
  );
  const streamingTurnKey = useMemo(() => {
    if (status !== 'running') return null;
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if (g.kind === 'assistant-turn') return g.messages[0].id;
    }
    return null;
  }, [groups, status]);

  // Models for the regenerate-with-model dropdown. Gated by the chat preference
  // and only for plain (non-flow) conversations — a flow runs its own model.
  const availableModels = useMemo(() => {
    if (!prefs.regenWithModelEnabled || conversation?.flowId) return [];
    return chatModels.map((m) => ({ id: m.id, displayName: m.displayName }));
  }, [prefs.regenWithModelEnabled, conversation?.flowId, chatModels]);

  /** Nearest preceding user-turn content for an assistant message (regenerate). */
  const priorUserContent = (assistantMessageId: string): string | null => {
    const idx = messages.findIndex((m) => m.id === assistantMessageId);
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content;
    }
    return null;
  };

  // Message-action handlers (edit/branch on user; regenerate/continue on assistant).
  const messageActions = {
    onEdit: (messageId: string, newContent: string) => {
      truncate.mutate(
        { conversationId, messageId },
        { onSuccess: () => send(newContent), onError: (e) => logger.fromError('CHT_005:edit', e) },
      );
    },
    onBranch: (messageId: string) => {
      const branchPoint = messages.find((m) => m.id === messageId);
      branch.mutate(
        { conversationId, messageId },
        {
          onSuccess: (fork) => {
            if (branchPoint?.role === 'user') {
              writePendingInitialMessage(fork.id, { text: branchPoint.content });
            }
            navigate(`${ROUTES.CHAT}/${fork.id}`);
          },
          onError: (e) => logger.fromError('CHT_005:branch', e),
        },
      );
    },
    onRegenerate: (assistantMessageId: string) => {
      const content = priorUserContent(assistantMessageId);
      if (!content) return;
      truncate.mutate(
        { conversationId, messageId: assistantMessageId },
        { onSuccess: () => send(content), onError: (e) => logger.fromError('CHT_004:regen', e) },
      );
    },
    onRegenerateWithModel: (assistantMessageId: string, modelId: string) => {
      const content = priorUserContent(assistantMessageId);
      if (!content) return;
      truncate.mutate(
        { conversationId, messageId: assistantMessageId },
        {
          onSuccess: () => sendWithModel(content, modelId),
          onError: (e) => logger.fromError('CHT_004:regen-model', e),
        },
      );
    },
    onContinue: () => send(CONTINUE_PROMPT),
  };

  // Render one message through the full `ChatMessage` with every per-message
  // prop wired. Used directly for user/system messages and, via `AssistantTurn`,
  // for a turn's "outside" messages (the answer + outputs) — those pass
  // `hideReasoning` since the turn's reasoning is folded into the umbrella.
  const renderMessage = (m: ChatMessageModel, opts: { hideReasoning: boolean }) => (
    <ChatMessage
      message={m}
      streaming={streamingMessageIds.has(m.id)}
      userModelId={
        streamingModelByMessageId.get(m.id) ??
        persistedModelById.get(m.id) ??
        activeModelId
      }
      // Persisted per-turn agent wins. Only the in-flight (streaming) turn —
      // not yet persisted — falls back to the conversation's current active
      // agent; completed turns without a stored agent show nothing rather than
      // being re-labeled to whatever agent is active now (a switch must not
      // rewrite the attribution of past turns).
      userAgentId={
        persistedAgentById.get(m.id) ??
        (streamingMessageIds.has(m.id) ? activeAgentId : null)
      }
      proposalFlows={proposalFlows}
      proposalBusy={status === 'running'}
      onAcceptProposal={(flowApiName, summary, additionalContext) =>
        startEpisode({
          flowApiName,
          seedSummary: summary || null,
          seedUserInput: additionalContext || null,
        })
      }
      attachments={attachmentsByMessageId.get(m.id)}
      onOpenAttachment={setViewingAttachment}
      actions={messageActions}
      branchEnabled={prefs.branchEnabled}
      availableModels={availableModels}
      isLastAssistant={m.id === lastAssistantId}
      finishReason={finishReasonById.get(m.id) ?? null}
      hideReasoning={opts.hideReasoning}
    />
  );

  // Fire the landing's pending first message exactly once on mount.
  const firedFirstMessage = useRef(false);
  useEffect(() => {
    if (firedFirstMessage.current) return;
    const pending = readPendingInitialMessage(conversationId);
    if (!pending) return;
    firedFirstMessage.current = true;
    clearPendingInitialMessage(conversationId);
    sendWithOverrides(pending.text, {
      userModelId: pending.userModelId,
      thinkingEnabled: pending.thinkingEnabled,
    });
  }, [conversationId, sendWithOverrides]);

  // Auto-scroll to the latest content as it streams in.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, progressLabel]);

  const handleSend = (attachmentIds: string[] = []) => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    send(text, attachmentIds);
  };

  const title = conversation?.title?.trim() || UNTITLED;
  const activeModelId = conversation?.userModelId ?? null;
  const activeAgentId = conversation?.agentId ?? null;
  const thinkingEnabled = conversation?.thinkingEnabled ?? false;

  // Left offset for the title in the window title-bar strip. Left-aligned: it
  // starts after the sidebar box when expanded, and after the traffic lights +
  // collapse toggle + search button when collapsed (so it never overlaps the
  // window controls or the title-bar actions).
  const chatCollapsed = useUiStore((s) => s.chatPaneCollapsed);
  const titleLeftPx = chatCollapsed
    ? TITLEBAR_SEARCH_LEFT_PX + TOGGLE_BUTTON_PX + TITLE_GAP_PX
    : SIDEBAR_BOX_INSET_PX + CHAT_SIDEBAR_WIDTH_PX + SIDEBAR_BOX_GAP_PX + TITLE_GAP_PX;

  return (
    <div
      className="flex h-full flex-col"
      // Reserve the overlay title-bar zone (traffic lights + collapse toggle +
      // the window-title text) so the messages/composer sit cleanly below it.
      style={{ paddingTop: SIDEBAR_BOX_INSET_PX + SIDEBAR_TITLE_ROW_PX }}
    >
      {/* Conversation title shown IN the window title-bar strip (macOS-style) —
          LEFT-aligned, vertically centered on the traffic lights, starting after
          the sidebar (expanded) or after the window controls (collapsed). Not a
          header row above the messages. pointer-events-none keeps the title bar
          draggable through the text. */}
      <h1
        data-testid="conversation-title"
        className="pointer-events-none fixed z-[60] truncate text-sm font-medium text-foreground"
        style={{
          left: titleLeftPx,
          top: TRAFFIC_LIGHT_Y,
          transform: 'translateY(-50%)',
          maxWidth: `calc(100vw - ${titleLeftPx + TITLE_GAP_PX}px)`,
        }}
        title={title}
      >
        {title}
      </h1>

      {/* Messages. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
          {groups.map((g, i) =>
            g.kind === 'message' ? (
              <div key={g.message.id}>
                {renderMessage(g.message, { hideReasoning: false })}
              </div>
            ) : (
              <AssistantTurn
                key={g.messages[0].id}
                messages={g.messages}
                renderMessage={renderMessage}
                hasAttachment={(id) => (attachmentsByMessageId.get(id)?.length ?? 0) > 0}
                streaming={g.messages[0].id === streamingTurnKey}
                progressLabel={progressLabel}
                // The error state belongs to the latest run, so only the last
                // turn is the failed one — suppress its benign "no reply" notice
                // in favour of the error banner below (#191).
                runFailed={status === 'error' && i === groups.length - 1}
              />
            ),
          )}
          <ThinkingStrip
            active={status === 'running' || Boolean(isLongPdfEpisode)}
            label={progressLabel ?? (isLongPdfEpisode ? LONG_PDF_GENERATING_LABEL : null)}
          />
          {status === 'error' && error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              {error}
            </div>
          )}
          {pendingInterrupt && (
            <HITLFormCard
              // Remount per pause so a fresh interrupt resets the form.
              key={pendingInterrupt.episodeId}
              schema={pendingInterrupt.schema}
              submitting={status === 'running'}
              onSubmit={(form, text) => submitInterrupt(form, text)}
            />
          )}
          {pendingReauth && (
            <ReauthCard
              key={pendingReauth.episodeId}
              envelope={pendingReauth.envelope}
              submitting={status === 'running'}
              onResume={(action) => submitReauth(action)}
            />
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer. */}
      <div className="bg-background px-4 py-3">
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput
            value={draft}
            onChange={setDraft}
            onSubmit={handleSend}
            conversationId={conversationId}
            onStop={stop}
            running={status === 'running'}
            disabled={Boolean(pendingInterrupt) || Boolean(pendingReauth)}
            placeholder={
              pendingInterrupt
                ? 'Complete the form above to continue…'
                : pendingReauth
                  ? 'Resolve the connector above to continue…'
                  : 'Reply…'
            }
            slashFlows={slashFlows}
            leadingControls={
              // Mid-conversation agent switch (#147). Only for default-agent
              // chats — a flow-bound conversation runs its own agent. Disabled
              // mid-run (the BE 409s on a switch during an open episode).
              conversation?.flowId ? null : (
                <AgentPicker
                  agentId={activeAgentId}
                  onAgentChange={(agentId) =>
                    setAgent.mutate(
                      { id: conversationId, agentId },
                      {
                        onError: (err) => {
                          // CHT_005 is the shared conversation-update code (same
                          // as set-model / set-thinking); surface the BE's own
                          // detail (404/400/409) when present.
                          logger.fromError('CHT_005:set-agent', err);
                          toast.error(detailOr(err, ERRORS.CHT_005.message));
                        },
                      },
                    )
                  }
                  disabled={status === 'running'}
                />
              )
            }
            controls={
              <>
                <ModelPicker
                  userModelId={activeModelId}
                  onModelChange={(userModelId) =>
                    setModel.mutate(
                      { id: conversationId, userModelId },
                      { onError: (err) => logger.fromError('CHT_005:set-model', err) },
                    )
                  }
                />
                <ThinkingToggle
                  enabled={thinkingEnabled}
                  onChange={(next) =>
                    setThinking.mutate(
                      { id: conversationId, thinkingEnabled: next },
                      { onError: (err) => logger.fromError('CHT_005:set-thinking', err) },
                    )
                  }
                />
              </>
            }
          />
        </div>
      </div>

      <AttachmentViewer
        attachment={viewingAttachment}
        onClose={() => setViewingAttachment(null)}
      />
    </div>
  );
}

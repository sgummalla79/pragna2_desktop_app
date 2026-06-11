import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Message } from '@ag-ui/client';
import { ROUTES } from '@/constants/routes';
import { CONTINUE_PROMPT } from '@/constants/chat';
import { useConversation } from '@/presentation/hooks/conversations/useConversation';
import { useConversationMessages } from '@/presentation/hooks/conversations/useConversationMessages';
import {
  useBranchConversation,
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
  TITLEBAR_TOGGLE_LEFT_PX,
  TOGGLE_BUTTON_PX,
  TITLE_GAP_PX,
  TRAFFIC_LIGHT_Y,
} from '@/constants/windowChrome';
import { useUiStore } from '@/presentation/store/uiStore';
import { useRefetchOpenEpisodeOnSettle } from './hooks/useRefetchOpenEpisodeOnSettle';
import { useChatModels } from './hooks/useChatModels';
import { useChatPreferences } from '@/presentation/hooks/preferences/useChatPreferences';
import { logger } from '@/infrastructure/logging/logger';
import type {
  Conversation,
  PersistedMessage,
} from '@/domain/types/conversation.types';
import type { Attachment } from '@/domain/types/attachment.types';
import { ChatInput } from './components/ChatInput';
import { ChatMessage } from './components/ChatMessage';
import { AttachmentViewer } from './components/AttachmentViewer';
import { HITLFormCard } from './components/hitl/HITLFormCard';
import { ModelPicker } from './components/ModelPicker';
import { ThinkingToggle } from './components/ThinkingToggle';
import { ThinkingStrip } from './components/ThinkingStrip';
import { useChatSession } from './hooks/useChatSession';
import {
  clearPendingInitialMessage,
  readPendingInitialMessage,
  writePendingInitialMessage,
} from './hooks/initialMessageHandoff';

/** Placeholder header title before the auto-title lands. */
const UNTITLED = 'New chat';

/** Map a persisted message to the AG-UI seed shape (content + reasoning +
 *  tool calls). Carrying `tool_calls` lets the chat surface rehydrate historical
 *  tool-call badges on resume (TD-018). */
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
    startEpisode,
    attach,
    replaceMessages,
  } = useChatSession({ threadId: conversationId, initialMessages, slashFlowNames });

  // Reconcile in-memory → persisted once a run settles. A tool-using turn (e.g.
  // create_pdf) or a buffered episode/attach stream leaves the final-assistant
  // with its LangChain stream id, so per-message lookups keyed on BE UUIDs
  // (attachments → the DocumentCard, model attribution) miss until a manual
  // reload. Swapping to the persisted list (which carries the BE ids +
  // attachments) fixes it. Never overwrite an in-flight stream (status guard),
  // and never wipe a just-streamed reply before the /messages refetch lands.
  useEffect(() => {
    if (status === 'running') return;
    if (messages.length === 0) return;
    if (persisted.length === 0) return;
    const lastInMemory = messages[messages.length - 1];
    const lastPersisted = persisted[persisted.length - 1];
    if (persisted.length !== messages.length || lastInMemory.id !== lastPersisted.id) {
      replaceMessages(initialMessages);
    }
  }, [persisted, messages, status, initialMessages, replaceMessages]);

  // ── Background document episode (create_pdf_long) ──────────────────────────
  // create_pdf_long acks instantly, then generates the document in a SEPARATE
  // background episode and posts it back as a later assistant turn + PDF. We
  // discover that episode and attach to its live stream so the document surfaces
  // with no manual reload (CF-005 / TD-030). Refetch the open-episode query when
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
  const thinkingEnabled = conversation?.thinkingEnabled ?? false;

  // Left offset for the title in the window title-bar strip. Left-aligned: it
  // starts after the sidebar box when expanded, and after the traffic lights +
  // collapse toggle when collapsed (so it never overlaps the window controls).
  const chatCollapsed = useUiStore((s) => s.chatPaneCollapsed);
  const titleLeftPx = chatCollapsed
    ? TITLEBAR_TOGGLE_LEFT_PX + TOGGLE_BUTTON_PX + TITLE_GAP_PX
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
          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              streaming={streamingMessageIds.has(m.id)}
              userModelId={
                streamingModelByMessageId.get(m.id) ??
                persistedModelById.get(m.id) ??
                activeModelId
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
            />
          ))}
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
            disabled={Boolean(pendingInterrupt)}
            placeholder={pendingInterrupt ? 'Complete the form above to continue…' : 'Reply…'}
            slashFlows={slashFlows}
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

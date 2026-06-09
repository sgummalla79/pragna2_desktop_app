import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Message } from '@ag-ui/client';
import { useConversation } from '@/presentation/hooks/conversations/useConversation';
import { useConversationMessages } from '@/presentation/hooks/conversations/useConversationMessages';
import {
  useSetConversationModel,
  useSetThinkingEnabled,
} from '@/presentation/hooks/conversations/useConversationMutations';
import { logger } from '@/infrastructure/logging/logger';
import type {
  Conversation,
  PersistedMessage,
} from '@/domain/types/conversation.types';
import { ChatInput } from './components/ChatInput';
import { ChatMessage } from './components/ChatMessage';
import { ModelPicker } from './components/ModelPicker';
import { ThinkingToggle } from './components/ThinkingToggle';
import { ThinkingStrip } from './components/ThinkingStrip';
import { useChatSession } from './hooks/useChatSession';
import {
  clearPendingInitialMessage,
  readPendingInitialMessage,
} from './hooks/initialMessageHandoff';

/** Placeholder header title before the auto-title lands. */
const UNTITLED = 'New chat';

/** Map a persisted message to the AG-UI seed shape (content + reasoning). */
function persistedToAGUIMessage(m: PersistedMessage): Message {
  const base: Record<string, unknown> = {
    id: m.id,
    role: m.role,
    content: m.content,
  };
  if (m.role === 'assistant' && m.reasoning) base.reasoning = m.reasoning;
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
  const setModel = useSetConversationModel();
  const setThinking = useSetThinkingEnabled();

  const initialMessages = useMemo(
    () => persisted.map(persistedToAGUIMessage),
    [persisted],
  );

  const {
    messages,
    status,
    error,
    progressLabel,
    send,
    sendWithOverrides,
    stop,
    streamingMessageIds,
    streamingModelByMessageId,
  } = useChatSession({ threadId: conversationId, initialMessages });

  const [draft, setDraft] = useState('');

  // Per-message producer-model attribution: persisted ids → userModelId,
  // overlaid by the live streaming map for the in-flight turn.
  const persistedModelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of persisted) {
      if (m.role === 'assistant' && m.userModelId) map.set(m.id, m.userModelId);
    }
    return map;
  }, [persisted]);

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

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    send(text);
  };

  const title = conversation?.title?.trim() || UNTITLED;
  const activeModelId = conversation?.userModelId ?? null;
  const thinkingEnabled = conversation?.thinkingEnabled ?? false;

  return (
    <div className="flex h-full flex-col">
      {/* Header. */}
      <header className="flex items-center gap-2 border-b border-border px-4 pt-8 pb-2">
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={title}>
          {title}
        </h1>
      </header>

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
            />
          ))}
          <ThinkingStrip active={status === 'running'} label={progressLabel} />
          {status === 'error' && error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer. */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput
            value={draft}
            onChange={setDraft}
            onSubmit={handleSend}
            onStop={stop}
            running={status === 'running'}
            placeholder="Reply…"
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
    </div>
  );
}

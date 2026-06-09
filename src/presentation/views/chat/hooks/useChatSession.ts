import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentSubscriber, Message } from '@ag-ui/client';
import { useQueryClient } from '@tanstack/react-query';
import { PRAGNA_BASE_URL } from '@/constants/api';
import { TauriHttpAgent } from '@/infrastructure/agui/TauriHttpAgent';
import { invalidateConversationListQueries } from '@/presentation/hooks/conversations/useConversations';
import { useAuthStore } from '@/presentation/store/authStore';
import { logger } from '@/infrastructure/logging/logger';

/** A tool call rendered inline under an assistant turn. */
export interface ChatToolCall {
  id: string;
  name: string;
  /** Cumulative argument JSON snippet as the LLM streams it. */
  argsBuffer: string;
  /** Final parsed args once the call completes; `undefined` while streaming. */
  args?: Record<string, unknown>;
  /** Tool result, if the server emitted a ToolCallResultEvent. */
  result?: string;
  /** True once we've seen the matching ToolCallEndEvent. */
  complete: boolean;
}

/** UI-shaped message — the canonical state the chat view renders. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  /** Assistant-only: any tool calls the LLM emitted during the turn. */
  toolCalls?: ChatToolCall[];
  /** Assistant-only extended-thinking trace (live event or hydrated message). */
  reasoning?: string;
}

export type ChatStatus = 'idle' | 'running' | 'error';

/** First-turn overrides reconstructed from the landing picker state. */
export interface SendOverrides {
  userModelId?: string;
  thinkingEnabled?: boolean;
}

export interface ChatSessionApi {
  /** Current turn state. Reflects the underlying agent's `messages` 1:1. */
  messages: ChatMessage[];
  /** Current run status. `error` flips back to `idle` on the next send. */
  status: ChatStatus;
  /** Last error message when `status === 'error'`; `null` otherwise. */
  error: string | null;
  /** Latest live progress label from the agent's `on_progress` event. */
  progressLabel: string | null;
  /** Append a user turn and run the agent. No-op while a run is in flight. */
  send: (text: string) => void;
  /**
   * Landing → first-send variant. Like {@link send}, but mutates the pragna URL
   * with `?user_model_id=` / `?thinking_enabled=` query params reconstructed
   * from the landing picker state. The backend reads these on auto-create and
   * stamps the conversation row to match — without this the first turn would
   * use server defaults regardless of what the user picked.
   */
  sendWithOverrides: (text: string, opts: SendOverrides) => void;
  /** Abort the current run (client-side). Safe to call when idle. */
  stop: () => void;
  /** Ids of assistant turns currently mid-stream (for reveal animation). */
  streamingMessageIds: Set<string>;
  /** Per-streaming-message producer-model attribution (no-flip badge render). */
  streamingModelByMessageId: Map<string, string>;
}

export interface UseChatSessionOptions {
  /**
   * Stable `thread_id` so the backend recognises a resumed conversation. New
   * chats pass a fresh UUID; resumed chats pass `conversation.id`. Changing it
   * recreates the underlying agent.
   */
  threadId?: string;
  /** Seed messages to hydrate the agent with on mount (resume history). */
  initialMessages?: Message[];
}

/**
 * Stateful hook wiring a single {@link TauriHttpAgent} to React state.
 *
 * One agent per `(accessToken, threadId)` pair, recreated on either changing.
 * Reusing the same `threadId` across requests is what makes "resume
 * conversation" work. The subscriber is installed once at agent creation and
 * mirrors the agent's `messages` into local state on every event.
 *
 * `send` is a no-op while a run is in flight — the user must wait or `stop`.
 * Phase 1 supports default-agent chat only; slash dispatch, episode attach, and
 * attachments are deferred (see `docs/TODO.md`).
 */
export function useChatSession(
  options: UseChatSessionOptions = {},
): ChatSessionApi {
  const { threadId, initialMessages } = options;
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  // Lazy-init from `initialMessages` so the first render already shows the
  // seeded transcript (avoids a one-frame blank scroll area on resume).
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    (initialMessages ?? []).map((m) => toChatMessage(m, new Map(), new Map())),
  );
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  // toolCallId → ChatToolCall, accumulated across the run.
  const toolCallsRef = useRef<Map<string, ChatToolCall>>(new Map());
  // messageId → reasoning trace (live `reasoning_content` events).
  const reasoningByMessageIdRef = useRef<Map<string, string>>(new Map());
  // Most recent `TEXT_MESSAGE_START` id — fallback for reasoning events that
  // omit `message_id` (single-message turns, the common case).
  const lastStreamingMessageIdRef = useRef<string | null>(null);
  // Rolling latest `model_attribution` id; stamped onto a streaming message id
  // when its `TEXT_MESSAGE_START` fires.
  const lastModelEntityIdRef = useRef<string | null>(null);
  const [streamingModelByMessageId, setStreamingModelByMessageId] = useState<
    Map<string, string>
  >(() => new Map());
  const [streamingMessageIds, setStreamingMessageIds] = useState<Set<string>>(
    () => new Set(),
  );

  // Captured base URL so `sendWithOverrides` can restore it after a run that
  // appended per-turn query params (the override is per-turn, never sticky).
  const overrideUrlRef = useRef<string | null>(null);

  const agent = useMemo<TauriHttpAgent | null>(() => {
    if (!accessToken) return null;
    return new TauriHttpAgent({
      url: `${PRAGNA_BASE_URL}/chat`,
      headers: { Authorization: `Bearer ${accessToken}` },
      threadId,
      initialMessages,
    });
    // `initialMessages` is intentionally excluded — it's a hydration seed that
    // should only matter when `threadId` changes; including it would recreate
    // the agent (and reset state) on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, threadId]);

  // Mirror agent.messages → React state, resolving accumulated tool calls +
  // live reasoning. A fresh array reference forces a re-render.
  const syncMessages = useCallback(() => {
    if (!agent) return;
    setMessages(
      agent.messages.map((m: Message) =>
        toChatMessage(m, toolCallsRef.current, reasoningByMessageIdRef.current),
      ),
    );
  }, [agent]);

  useEffect(() => {
    if (!agent) return undefined;
    toolCallsRef.current = new Map();
    reasoningByMessageIdRef.current = new Map();
    setStatus('idle');
    setError(null);
    // Hydrate React state from the agent's seed history (subscriber callbacks
    // only fire during a live run, never for the seed).
    syncMessages();

    const subscriber: AgentSubscriber = {
      onRunInitialized: () => {
        setStatus('running');
        setError(null);
        setProgressLabel(null);
        lastModelEntityIdRef.current = null;
        setStreamingModelByMessageId(new Map());
        reasoningByMessageIdRef.current = new Map();
        setStreamingMessageIds(new Set());
      },
      onRunFailed: ({ error: e }) => {
        // AbortError is a user-initiated unwind (Stop, navigation) — reset
        // silently, nothing to surface.
        setStreamingMessageIds(new Set());
        if (
          e instanceof Error &&
          (e.name === 'AbortError' || /aborted/i.test(e.message))
        ) {
          setStatus('idle');
          setProgressLabel(null);
          return;
        }
        setStatus('error');
        setError(e.message || 'Run failed');
        setProgressLabel(null);
        logger.fromError('CHT_004:run_failed', e);
      },
      onRunFinalized: () => {
        setStatus((prev) => (prev === 'error' ? prev : 'idle'));
        setProgressLabel(null);
        setStreamingMessageIds(new Set());
        // Restore the base URL after an overrides run so the next plain send
        // reverts to the conversation's persisted preference.
        if (overrideUrlRef.current !== null && agent) {
          agent.url = overrideUrlRef.current;
          overrideUrlRef.current = null;
        }
        // Sidebar lists + this conversation's single-lookup (auto-title arrival).
        invalidateConversationListQueries(qc, {
          conversationId: threadId ?? undefined,
        });
        // Refetch the persisted message log so assistant turns pick up their
        // server-stamped `user_model_id` attribution.
        if (threadId) {
          qc.invalidateQueries({
            queryKey: ['conversations', threadId, 'messages'],
          });
        }
      },
      onTextMessageStartEvent: ({ event }) => {
        syncMessages();
        lastStreamingMessageIdRef.current = event.messageId;
        setStreamingMessageIds((prev) => {
          const next = new Set(prev);
          next.add(event.messageId);
          return next;
        });
        const modelId = lastModelEntityIdRef.current;
        if (modelId) {
          setStreamingModelByMessageId((prev) => {
            const next = new Map(prev);
            next.set(event.messageId, modelId);
            return next;
          });
        }
      },
      onTextMessageContentEvent: () => {
        syncMessages();
      },
      onTextMessageEndEvent: ({ event }) => {
        syncMessages();
        setStreamingMessageIds((prev) => {
          if (!prev.has(event.messageId)) return prev;
          const next = new Set(prev);
          next.delete(event.messageId);
          return next;
        });
      },
      onToolCallStartEvent: ({ event }) => {
        toolCallsRef.current.set(event.toolCallId, {
          id: event.toolCallId,
          name: event.toolCallName,
          argsBuffer: '',
          complete: false,
        });
        syncMessages();
      },
      onToolCallArgsEvent: ({ event, toolCallBuffer, partialToolCallArgs }) => {
        const existing = toolCallsRef.current.get(event.toolCallId);
        if (existing) {
          toolCallsRef.current.set(event.toolCallId, {
            ...existing,
            argsBuffer: toolCallBuffer,
            args: partialToolCallArgs as Record<string, unknown>,
          });
          syncMessages();
        }
      },
      onToolCallEndEvent: ({ event, toolCallArgs }) => {
        const existing = toolCallsRef.current.get(event.toolCallId);
        if (existing) {
          toolCallsRef.current.set(event.toolCallId, {
            ...existing,
            args: toolCallArgs as Record<string, unknown>,
            complete: true,
          });
          syncMessages();
        }
      },
      onToolCallResultEvent: ({ event }) => {
        const existing = toolCallsRef.current.get(event.toolCallId);
        if (existing) {
          toolCallsRef.current.set(event.toolCallId, {
            ...existing,
            result: event.content ?? '',
          });
        }
        syncMessages();
      },
      onCustomEvent: ({ event }) => {
        // on_progress — live thinking-strip label (last-wins).
        if (event.name === 'on_progress') {
          const value = event.value as { label?: unknown } | null | undefined;
          const label =
            value && typeof value === 'object' && typeof value.label === 'string'
              ? value.label
              : null;
          if (label) setProgressLabel(label);
          return;
        }
        // title_updated — BE pushes this before closing the stream on a fresh
        // conversation; invalidate so the sidebar title updates immediately.
        if (event.name === 'title_updated') {
          qc.invalidateQueries({ queryKey: ['conversations'] });
          return;
        }
        // model_attribution — rolling latest producer-model id; the next
        // TEXT_MESSAGE_START snapshots it onto the streaming message id.
        if (event.name === 'model_attribution') {
          const value = event.value as
            | { model_entity_id?: unknown }
            | null
            | undefined;
          const modelId =
            value &&
            typeof value === 'object' &&
            typeof value.model_entity_id === 'string' &&
            value.model_entity_id
              ? value.model_entity_id
              : null;
          if (modelId) lastModelEntityIdRef.current = modelId;
          return;
        }
        // reasoning_content — stamp the thinking trace onto the streaming id.
        if (event.name === 'reasoning_content') {
          const value = event.value as
            | { message_id?: unknown; reasoning?: unknown }
            | null
            | undefined;
          const reasoning =
            value && typeof value === 'object' && typeof value.reasoning === 'string'
              ? value.reasoning
              : null;
          const messageId =
            value &&
            typeof value === 'object' &&
            typeof value.message_id === 'string' &&
            value.message_id
              ? value.message_id
              : lastStreamingMessageIdRef.current;
          if (reasoning && messageId) {
            reasoningByMessageIdRef.current.set(messageId, reasoning);
            syncMessages();
          }
          return;
        }
        // Unknown custom events are ignored.
      },
    };

    const { unsubscribe } = agent.subscribe(subscriber);
    return () => {
      unsubscribe();
      // `abortRun` stops the CLIENT-side fetch; the BE run continues server-side
      // and persists, so the result is visible on next mount via the message log.
      agent.abortRun();
    };
  }, [agent, syncMessages, qc, threadId]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!agent || !trimmed) return;
      if (status === 'running') return;

      agent.messages.push({ id: randomId(), role: 'user', content: trimmed });
      syncMessages();

      agent.runAgent().catch((e: unknown) => {
        // runAgent rejects when the subscriber chain throws; onRunFailed already
        // updated state. Log any unhandled rejection path.
        if (e instanceof Error && e.name === 'AbortError') return;
        logger.fromError(
          'CHT_004:run_rejected',
          e instanceof Error ? e : new Error(String(e)),
        );
      });
    },
    [agent, status, syncMessages],
  );

  const sendWithOverrides = useCallback(
    (text: string, opts: SendOverrides) => {
      const trimmed = text.trim();
      if (!agent || !trimmed) return;
      if (status === 'running') return;

      // Build query params from non-undefined opts. `thinking_enabled` must
      // survive being set to `false`, so an explicit "off" round-trips.
      const params = new URLSearchParams();
      if (opts.userModelId) params.set('user_model_id', opts.userModelId);
      if (opts.thinkingEnabled !== undefined) {
        params.set('thinking_enabled', String(opts.thinkingEnabled));
      }
      if (params.toString().length > 0) {
        overrideUrlRef.current = agent.url;
        const base = agent.url.split('?')[0];
        agent.url = `${base}?${params.toString()}`;
      }
      send(text);
    },
    [agent, status, send],
  );

  const stop = useCallback(() => {
    if (agent && status === 'running') {
      agent.abortRun();
      setStatus('idle');
      setProgressLabel(null);
    }
  }, [agent, status]);

  return {
    messages,
    status,
    error,
    progressLabel,
    send,
    sendWithOverrides,
    stop,
    streamingMessageIds,
    streamingModelByMessageId,
  };
}

/**
 * Translate an agent `messages` entry into the UI's {@link ChatMessage} shape,
 * attaching accumulated tool calls and any reasoning trace.
 */
function toChatMessage(
  m: Message,
  toolCalls: Map<string, ChatToolCall>,
  reasoningByMessageId?: Map<string, string>,
): ChatMessage {
  if (m.role === 'assistant') {
    const calls = m.toolCalls
      ?.map((tc) => toolCalls.get(tc.id))
      .filter((tc): tc is ChatToolCall => Boolean(tc));
    const reasoning =
      reasoningByMessageId?.get(m.id) ??
      (typeof (m as { reasoning?: unknown }).reasoning === 'string'
        ? (m as { reasoning?: string }).reasoning
        : undefined);
    return {
      id: m.id,
      role: 'assistant',
      content: m.content ?? '',
      toolCalls: calls && calls.length > 0 ? calls : undefined,
      reasoning: reasoning || undefined,
    };
  }
  if (m.role === 'tool') {
    return { id: m.id, role: 'tool', content: m.content ?? '' };
  }
  if (m.role === 'system' || m.role === 'developer') {
    return { id: m.id, role: 'system', content: m.content ?? '' };
  }
  return {
    id: m.id,
    role: 'user',
    content: typeof m.content === 'string' ? m.content : '',
  };
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

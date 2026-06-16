import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentSubscriber, Message } from '@ag-ui/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  API_BASE_URL,
  CLIENT_CAPABILITIES_HEADER,
  CLIENT_CAPABILITY_STDIO_DELEGATION,
  PRAGNA_BASE_URL,
} from '@/constants/api';
import { ERRORS } from '@/constants/errors';
import { SLASH_COMMAND_RE } from '@/constants/slashCommands';
import { TauriHttpAgent } from '@/infrastructure/agui/TauriHttpAgent';
import { mcpStdio } from '@/infrastructure/platform';
import { invalidateConversationListQueries } from '@/presentation/hooks/conversations/useConversations';
import { useServices } from '@/presentation/providers/ServiceContext';
import { useAuthStore } from '@/presentation/store/authStore';
import { logger } from '@/infrastructure/logging/logger';
import type { AskUserSchema, CreateEpisodePayload } from '@/domain/types/episode.types';
import {
  type DelegationEnvelope,
  type DelegationResult,
  type ReauthAction,
  type ReauthEnvelope,
  readDelegationEnvelope,
  readReauthEnvelope,
} from '@/domain/types/mcpDelegation.types';

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

/**
 * A live HITL pause: the open episode awaiting the user, plus the `ask_user`
 * form schema to render. Cleared once the user submits (and re-set if the
 * resumed run pauses again).
 */
export interface PendingInterrupt {
  episodeId: string;
  schema: AskUserSchema;
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
  /**
   * Append a user turn and run the agent. No-op while a run is in flight.
   * `attachmentIds` (uploaded ahead of send) are passed to the backend via
   * `forwardedProps.attachment_ids`, which it resolves into multimodal content.
   */
  send: (text: string, attachmentIds?: string[]) => void;
  /**
   * Landing → first-send variant. Like {@link send}, but mutates the pragna URL
   * with `?user_model_id=` / `?thinking_enabled=` query params reconstructed
   * from the landing picker state. The backend reads these on auto-create and
   * stamps the conversation row to match — without this the first turn would
   * use server defaults regardless of what the user picked.
   */
  sendWithOverrides: (text: string, opts: SendOverrides) => void;
  /**
   * Send a turn against a specific model for this run only (appends
   * `?user_model_id=`); used by "regenerate with model". The conversation's
   * persisted model is unaffected — the URL reverts on run finalize.
   */
  sendWithModel: (text: string, userModelId: string) => void;
  /** Abort the current run (client-side). Safe to call when idle. */
  stop: () => void;
  /** Ids of assistant turns currently mid-stream (for reveal animation). */
  streamingMessageIds: Set<string>;
  /** Per-streaming-message producer-model attribution (no-flip badge render). */
  streamingModelByMessageId: Map<string, string>;
  /**
   * The current HITL pause (open episode + `ask_user` schema), or `null`. Set
   * when a run pauses (`on_interrupt` seen → open-episode resolved to
   * `awaiting_user`); the view renders a form from `schema`.
   */
  pendingInterrupt: PendingInterrupt | null;
  /**
   * Submit the HITL form to resume the paused episode (`POST …/episodes/{id}/
   * resume`). Streams the continuation live through the same transport; if the
   * resumed run pauses again, {@link pendingInterrupt} is re-set. No-op while a
   * run is in flight or when there's no pending interrupt.
   */
  submitInterrupt: (form: Record<string, unknown>, text: string) => void;
  /**
   * A live connector re-auth pause (#2): a remote-OAuth connector's token was
   * revoked mid-run. The view renders a card offering Re-authenticate / Continue.
   * Null when not paused on re-auth.
   */
  pendingReauth: { episodeId: string; envelope: ReauthEnvelope } | null;
  /**
   * Resume a connector re-auth pause (`POST …/episodes/{id}/resume-reauth`).
   * `retry` after the user reconnected the connector; `continue` to skip it and
   * let the run degrade. No-op while a run is in flight or with no pending re-auth.
   */
  submitReauth: (action: ReauthAction) => void;
  /**
   * Start a flow episode (`POST …/episodes`) — e.g. accepting a flow proposal —
   * and stream its run live. May immediately pause into a {@link pendingInterrupt}.
   */
  startEpisode: (payload: CreateEpisodePayload) => void;
  /**
   * Attach to a live background run (`POST …/episodes/{eid}/stream`). The
   * endpoint replays the episode's event log + streams any live events, so a
   * `create_pdf_long` document generated after the instant ack posts back into
   * the transcript with no manual reload (and its "section i of N" progress
   * feeds the thinking-strip). No-op while a run is already in flight.
   */
  attach: (conversationId: string, episodeId: string) => void;
  /**
   * Replace the agent's in-memory messages with the authoritative persisted
   * list (used to reconcile streamed stream-id messages to their BE UUIDs after
   * a run settles, so attachment / model-attribution lookups resolve). Idempotent.
   */
  replaceMessages: (replacement: Message[]) => void;
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
  /**
   * Slash-exposed flow names (the bare `slash_api_name`, no leading `/`). When a
   * sent message starts with `/{name}` and `{name}` is in this set, the turn is
   * dispatched to `POST {PRAGNA_BASE_URL}/flows/{name}` instead of the default
   * chat agent; the URL is restored on run finalize. Unknown `/foo` prefixes
   * fall through to normal chat (the text is sent verbatim).
   */
  slashFlowNames?: Set<string>;
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
 * Supports default-agent chat, per-turn `/slash` flow dispatch (see
 * `slashFlowNames`), HITL episodes (`startEpisode`/`submitInterrupt`), and
 * background-run {@link UseChatSession.attach} — used to surface an async
 * `create_pdf_long` document into the transcript (see pragna2-tracker TD-030 /
 * `docs/CODE_FIXES.md` CF-005). Streamed turns are reconciled to their persisted
 * BE ids via {@link UseChatSession.replaceMessages} so attachment / model lookups
 * resolve.
 */
export function useChatSession(
  options: UseChatSessionOptions = {},
): ChatSessionApi {
  const { threadId, initialMessages, slashFlowNames } = options;
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const { episodeService } = useServices();

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

  // Captured base URL so `sendWithOverrides` / slash dispatch can restore it
  // after a run that mutated the URL per-turn (the override is never sticky).
  const overrideUrlRef = useRef<string | null>(null);

  // Latest slash-flow name set, read inside the stable `send` callback so a
  // changing Set identity never forces `send` to be recreated (which would
  // re-fire the landing handoff effect).
  const slashFlowNamesRef = useRef<Set<string> | undefined>(undefined);
  slashFlowNamesRef.current = slashFlowNames;

  // ── HITL episode state ──────────────────────────────────────────────────────
  // The live pause awaiting a form submission; null when not paused.
  const [pendingInterrupt, setPendingInterrupt] =
    useState<PendingInterrupt | null>(null);
  // Latest pending interrupt, read inside the stable `send` callback to block a
  // normal chat turn while a form is open (the backend 409s on an open episode).
  const pendingInterruptRef = useRef<PendingInterrupt | null>(null);
  pendingInterruptRef.current = pendingInterrupt;
  // Set when an `on_interrupt` is seen mid-stream; the trigger to resolve the
  // open episode (for its id) once the run finalizes. Schema is stashed for an
  // instant form render (the event carries the schema but not the episode id).
  const sawInterruptRef = useRef(false);
  const interruptSchemaRef = useRef<AskUserSchema | null>(null);
  // Abort controller for an in-flight raw episode run (start/resume), so `stop`
  // can cancel it (these bypass ag-ui's `runAgent`/`abortRun`).
  const rawAbortRef = useRef<AbortController | null>(null);
  // Stable ref to the latest open-episode resolver, called from the subscriber
  // (avoids adding it to the subscribe effect's deps).
  const resolveOpenEpisodeRef = useRef<() => void>(() => {});
  // Phase F: headless client-delegated tool runner; set after runEpisodeStream
  // is defined (resolveOpenEpisode → runDelegation → runEpisodeStream cycle).
  const runDelegationRef = useRef<
    (episodeId: string, envelope: DelegationEnvelope) => void
  >(() => {});
  // #2: a mid-run connector re-auth pause awaiting the user's choice; null when
  // not paused on re-auth. Carries the episode id so the card can resume it.
  const [pendingReauth, setPendingReauth] = useState<
    { episodeId: string; envelope: ReauthEnvelope } | null
  >(null);
  const pendingReauthRef = useRef<{
    episodeId: string;
    envelope: ReauthEnvelope;
  } | null>(null);
  pendingReauthRef.current = pendingReauth;

  const agent = useMemo<TauriHttpAgent | null>(() => {
    if (!accessToken) return null;
    return new TauriHttpAgent({
      url: `${PRAGNA_BASE_URL}/chat`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Phase F: declare that this (desktop) client can execute client-delegated
        // (stdio) tools. The header rides on every run/episode/resume request
        // (run() + runRaw() both spread this.headers), so the backend binds stdio
        // tools and the capability gate passes. The web app omits it → 409.
        [CLIENT_CAPABILITIES_HEADER]: CLIENT_CAPABILITY_STDIO_DELEGATION,
      },
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

  // A deferred `abortRun()` scheduled by the subscriber-effect cleanup below,
  // tagged with the agent it targets. React StrictMode dev-double-invokes effects
  // (mount → cleanup → mount); aborting SYNCHRONOUSLY in that cleanup would kill
  // the in-flight first turn (the cleanup runs `agent.abortRun()`), and the
  // `firedFirstMessage` guard in ChatSessionView then blocks a re-send — so the
  // first reply never renders (CF-012). Deferring the abort one macrotask lets the
  // re-subscribe of the SAME agent (StrictMode / a benign effect re-run) cancel it,
  // while a real unmount or conversation switch (no same-agent re-subscribe) still
  // aborts the client fetch.
  const pendingAbortRef = useRef<{
    agent: TauriHttpAgent;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  useEffect(() => {
    if (!agent) return undefined;
    // This same agent re-subscribed before its deferred abort fired (StrictMode
    // synthetic remount) — cancel it so the in-flight run survives.
    if (pendingAbortRef.current && pendingAbortRef.current.agent === agent) {
      clearTimeout(pendingAbortRef.current.timer);
      pendingAbortRef.current = null;
    }
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
          (e.name === 'AbortError' || /aborted|cancel/i.test(e.message))
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
        // If this run paused for human input, resolve the open episode (the
        // `on_interrupt` event carried the schema but not the episode id).
        if (sawInterruptRef.current) {
          resolveOpenEpisodeRef.current();
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
        // on_interrupt — the run paused for human input (ask_user). The value
        // carries the form `schema` but NOT the episode id, so stash the schema
        // and flag the run; the open episode is resolved (for its id) once the
        // run finalizes (chat path) or the raw episode run completes (resume).
        if (event.name === 'on_interrupt') {
          const value = event.value as { schema?: AskUserSchema } | null | undefined;
          const schema =
            value && typeof value === 'object' && value.schema ? value.schema : null;
          if (schema) interruptSchemaRef.current = schema;
          sawInterruptRef.current = true;
          return;
        }
        // Unknown custom events are ignored.
      },
    };

    const { unsubscribe } = agent.subscribe(subscriber);
    return () => {
      unsubscribe();
      // Defer `abortRun` one macrotask. `abortRun` stops the CLIENT-side fetch
      // (the BE run continues server-side and persists). A REAL unmount /
      // conversation switch has no immediate same-agent re-subscribe, so this
      // fires and stops the fetch as before. StrictMode's synthetic remount
      // re-subscribes this SAME agent first, cancelling the timer above — so the
      // first turn is NOT killed mid-flight (CF-012).
      const abortAgent = agent;
      const timer = setTimeout(() => {
        abortAgent.abortRun();
        if (pendingAbortRef.current?.timer === timer) pendingAbortRef.current = null;
      }, 0);
      pendingAbortRef.current = { agent: abortAgent, timer };
    };
  }, [agent, syncMessages, qc, threadId]);

  // On conversation (re)mount, surface any already-open `awaiting_user` episode
  // so a paused form reappears when the user returns to the chat. One cheap GET
  // per open; resolves to no pending interrupt for ordinary conversations.
  useEffect(() => {
    void resolveOpenEpisodeRef.current();
  }, [threadId]);

  const send = useCallback(
    (text: string, attachmentIds?: string[]) => {
      const trimmed = text.trim();
      if (!agent || !trimmed) return;
      if (status === 'running') return;
      // A pending HITL form / re-auth pause owns the conversation — resolve it,
      // not chat (the backend 409s on an open episode anyway).
      if (pendingInterruptRef.current) return;
      if (pendingReauthRef.current) return;

      // Per-turn slash dispatch: a `/{name} …` prefix whose name is an exposed
      // flow routes this turn to the flow endpoint. Slash wins over any per-turn
      // model/thinking override URL `sendWithOverrides` set just before calling
      // here — a flow runs against its own configured model, so the query params
      // don't apply. The base URL is restored in `onRunFinalized`.
      const slashName = SLASH_COMMAND_RE.exec(trimmed)?.[1];
      if (slashName && slashFlowNamesRef.current?.has(slashName)) {
        if (overrideUrlRef.current === null) overrideUrlRef.current = agent.url;
        agent.url = `${PRAGNA_BASE_URL}/flows/${encodeURIComponent(slashName)}`;
      }

      agent.messages.push({ id: randomId(), role: 'user', content: trimmed });
      syncMessages();

      // Attachments uploaded ahead of send ride along as a forwarded prop; the
      // backend resolves the ids into multimodal content on the last user turn.
      const runParams =
        attachmentIds && attachmentIds.length > 0
          ? { forwardedProps: { attachment_ids: attachmentIds } }
          : undefined;

      agent.runAgent(runParams).catch((e: unknown) => {
        // runAgent rejects when the subscriber chain throws; onRunFailed already
        // updated state. Log any unhandled rejection path.
        if (
          e instanceof Error &&
          (e.name === 'AbortError' || /aborted|cancel/i.test(e.message))
        ) return;
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

  const sendWithModel = useCallback(
    (text: string, userModelId: string) => sendWithOverrides(text, { userModelId }),
    [sendWithOverrides],
  );

  // Resolve the conversation's open episode after a pause — the `on_interrupt`
  // event gives us the schema but not the episode id, so one lookup gets the id
  // (and the canonical schema). Sets `pendingInterrupt` iff `awaiting_user`.
  const resolveOpenEpisode = useCallback(async () => {
    sawInterruptRef.current = false;
    if (!threadId) return;
    try {
      const page = await episodeService.list(threadId, { limit: 1, offset: 0 });
      const ep = page.episodes[0];
      if (ep && ep.status === 'awaiting_user') {
        // Phase F: a client-delegated (stdio) tool pause runs HEADLESSLY —
        // execute the tools locally and auto-resume, no form rendered.
        const envelope = readDelegationEnvelope(ep.interruptValue);
        if (envelope) {
          runDelegationRef.current(ep.id, envelope);
          return;
        }
        // #2: a remote-OAuth connector re-auth pause renders a card offering
        // Re-authenticate / Continue (vs the headless delegation path).
        const reauth = readReauthEnvelope(ep.interruptValue);
        if (reauth) {
          setPendingReauth({ episodeId: ep.id, envelope: reauth });
          return;
        }
        const schema =
          (ep.interruptValue as { schema?: AskUserSchema } | null)?.schema ??
          interruptSchemaRef.current ??
          null;
        if (schema) {
          setPendingInterrupt({ episodeId: ep.id, schema });
          return;
        }
      }
      setPendingInterrupt(null);
      setPendingReauth(null);
    } catch (e) {
      logger.fromError(
        'HITL_001:open_episode',
        e instanceof Error ? e : new Error(String(e)),
      );
    } finally {
      interruptSchemaRef.current = null;
    }
  }, [threadId, episodeService]);
  resolveOpenEpisodeRef.current = resolveOpenEpisode;

  // Stream a raw episode run (start or resume) through the agent transport,
  // managing status + abort ourselves (these bypass ag-ui's runAgent lifecycle,
  // so onRunInitialized/onRunFinalized don't fire). The per-event subscriber
  // hooks still fire via `apply`, so messages + a second `on_interrupt` surface
  // live; we resolve the open episode again after it completes.
  const runEpisodeStream = useCallback(
    async (url: string, body: unknown, errCode: 'HITL_002' | 'HITL_003') => {
      if (!agent || !threadId) return;
      const controller = new AbortController();
      rawAbortRef.current = controller;
      setStatus('running');
      setError(null);
      setProgressLabel(null);
      setStreamingMessageIds(new Set());
      reasoningByMessageIdRef.current = new Map();
      let errored = false;
      try {
        await agent.runRaw(url, body, controller.signal);
        await resolveOpenEpisode();
      } catch (e) {
        if (
          e instanceof Error &&
          (e.name === 'AbortError' || /abort|cancel/i.test(e.message))
        ) {
          // user-initiated unwind (Stop / navigation) — silent
        } else {
          errored = true;
          setStatus('error');
          setError(e instanceof Error && e.message ? e.message : ERRORS[errCode].message);
          logger.fromError(
            `${errCode}:episode_run`,
            e instanceof Error ? e : new Error(String(e)),
          );
        }
      } finally {
        setStreamingMessageIds(new Set());
        setProgressLabel(null);
        if (!errored) setStatus('idle');
        rawAbortRef.current = null;
        invalidateConversationListQueries(qc, { conversationId: threadId });
        qc.invalidateQueries({
          queryKey: ['conversations', threadId, 'messages'],
        });
      }
    },
    [agent, threadId, resolveOpenEpisode, qc],
  );

  // Phase F: headless client-delegated tool execution. Run each call locally via
  // the Rust stdio host, then auto-resume the paused run with the ordered results
  // (`/resume-tool` maps them by index). A failed/declined call → `tool_error` so
  // the run degrades + the agent reports it. Reuses runEpisodeStream, which
  // re-resolves the open episode on completion — so a run that pauses again at
  // another delegation recurses naturally.
  const runDelegation = useCallback(
    async (episodeId: string, envelope: DelegationEnvelope) => {
      if (!threadId) return;
      setStatus('running');
      setProgressLabel('Running local tools…');
      const results: DelegationResult[] = [];
      for (const call of envelope.calls) {
        try {
          const result = await mcpStdio.call(
            call.connector_id,
            call.upstream_name,
            call.args,
          );
          results.push({ tool_result: result });
        } catch (e) {
          results.push({
            tool_error: e instanceof Error ? e.message : String(e),
          });
          logger.fromError(
            'DELEG_001:tool_call',
            e instanceof Error ? e : new Error(String(e)),
          );
        }
      }
      const url = `${API_BASE_URL}/conversations/${threadId}/episodes/${episodeId}/resume-tool`;
      await runEpisodeStream(url, { results }, 'HITL_002');
    },
    [threadId, runEpisodeStream],
  );
  runDelegationRef.current = (episodeId, envelope) => {
    void runDelegation(episodeId, envelope);
  };

  const submitInterrupt = useCallback(
    (form: Record<string, unknown>, text: string) => {
      if (!agent || !threadId || !pendingInterrupt) return;
      if (status === 'running') return;
      const url = `${API_BASE_URL}/conversations/${threadId}/episodes/${pendingInterrupt.episodeId}/resume`;
      // Hide the form while the resume streams; re-set if it pauses again.
      setPendingInterrupt(null);
      void runEpisodeStream(url, { form, text }, 'HITL_002');
    },
    [agent, threadId, pendingInterrupt, status, runEpisodeStream],
  );

  // #2: resume a connector re-auth pause. `retry` = the user reconnected the
  // connector out-of-band (the card opened the OAuth flow) → re-run the tool
  // call; `continue` = skip it (the run degrades + reports). Reuses
  // runEpisodeStream so a subsequent pause re-resolves naturally.
  const submitReauth = useCallback(
    (action: ReauthAction) => {
      if (!agent || !threadId || !pendingReauth) return;
      if (status === 'running') return;
      const url = `${API_BASE_URL}/conversations/${threadId}/episodes/${pendingReauth.episodeId}/resume-reauth`;
      setPendingReauth(null);
      void runEpisodeStream(url, { action }, 'HITL_002');
    },
    [agent, threadId, pendingReauth, status, runEpisodeStream],
  );

  const startEpisode = useCallback(
    (payload: CreateEpisodePayload) => {
      if (!agent || !threadId) return;
      if (status === 'running') return;
      const url = `${API_BASE_URL}/conversations/${threadId}/episodes`;
      void runEpisodeStream(
        url,
        {
          flow_api_name: payload.flowApiName,
          seed_summary: payload.seedSummary ?? null,
          seed_user_input: payload.seedUserInput ?? null,
        },
        'HITL_003',
      );
    },
    [agent, threadId, status, runEpisodeStream],
  );

  const attach = useCallback(
    (conversationId: string, episodeId: string) => {
      if (!agent) return;
      // Already running (the user submitted a turn between the open-episode
      // query landing the active result and this firing) — don't double-POST;
      // the active run is authoritative and would deliver the same events.
      if (status === 'running') return;
      // Swap the agent URL to the episode stream endpoint; `onRunFinalized`
      // restores it (same override pattern as slash dispatch / sendWithOverrides).
      if (overrideUrlRef.current === null) overrideUrlRef.current = agent.url;
      agent.url = `${API_BASE_URL}/conversations/${encodeURIComponent(
        conversationId,
      )}/episodes/${encodeURIComponent(episodeId)}/stream`;
      // No message push — the endpoint replays the event log + live events; the
      // standard subscriber chain applies them to `agent.messages` exactly as a
      // chat run does, and `onRunFinalized` refetches /messages so the
      // posted-back document's PDF attachment surfaces as a DocumentCard.
      agent.runAgent({}).catch((e: unknown) => {
        if (
          e instanceof Error &&
          (e.name === 'AbortError' || /aborted|cancel/i.test(e.message))
        ) return;
        logger.fromError(
          'CHT_004:attach_rejected',
          e instanceof Error ? e : new Error(String(e)),
        );
      });
    },
    [agent, status],
  );

  // Replace the agent's in-memory message list with the authoritative persisted
  // list, then mirror to React state. After a tool-using turn (e.g. create_pdf)
  // or a buffered episode stream, the in-memory final-assistant keeps its
  // LangChain stream id, so per-message lookups keyed on BE UUIDs (attachments →
  // the document card, model attribution) miss until reconciled. Idempotent.
  const replaceMessages = useCallback(
    (replacement: Message[]) => {
      if (!agent) return;
      agent.setMessages(replacement);
      syncMessages();
    },
    [agent, syncMessages],
  );

  const stop = useCallback(() => {
    // A raw episode run (start/resume) bypasses ag-ui's abortRun — cancel its
    // own controller first.
    if (rawAbortRef.current) {
      rawAbortRef.current.abort();
      rawAbortRef.current = null;
      setStatus('idle');
      setProgressLabel(null);
      return;
    }
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
    // Prefer the live-accumulated call (carries streamed args + result); fall
    // back to building from the message's own tool calls so a hydrated/resumed
    // turn still renders its historical badges (pragna2-tracker TD-018).
    const calls = m.toolCalls
      ?.map((tc) => toolCalls.get(tc.id) ?? aguiToolCallToChatToolCall(tc))
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

/**
 * Build a {@link ChatToolCall} from an AG-UI message tool call (the shape
 * `{ id, function: { name, arguments } }`). Used to rehydrate historical
 * tool-call badges on resume, when the live accumulator ref is empty. The
 * persisted result isn't carried on the AG-UI shape, so it's omitted.
 */
function aguiToolCallToChatToolCall(tc: unknown): ChatToolCall | null {
  const call = tc as {
    id?: string;
    function?: { name?: string; arguments?: string };
  };
  const id = call?.id;
  const name = call?.function?.name;
  if (!id || !name) return null;
  const argsBuffer = call.function?.arguments ?? '';
  let args: Record<string, unknown> | undefined;
  try {
    args = argsBuffer ? (JSON.parse(argsBuffer) as Record<string, unknown>) : undefined;
  } catch {
    args = undefined; // malformed JSON — show the raw buffer, not a crash.
  }
  return { id, name, argsBuffer, args, complete: true };
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Domain types for chat conversations and their persisted messages.
 *
 * Frontend shapes for `/api/conversations/*`. The backend serialises in
 * snake_case; mappers in `infrastructure/repositories/mappers/mapConversation.ts`
 * translate at the boundary. UI code only sees the camelCase shapes here.
 *
 * Phase 1 (core chat) scope: attachments, usage/cost, branch and truncate are
 * deferred — see `docs/TODO.md`.
 */

/** A message turn's author. `tool`/`system` turns are rendered minimally. */
export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

/** Normalised terminal stop signal for an assistant turn (BE migration 0022). */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'other';

/** One conversation the user owns (`GET /api/conversations`). */
export interface Conversation {
  id: string;
  /** Set when the conversation is bound to a flow; `null` for default-agent chats. */
  flowId: string | null;
  /** Client-supplied UUID = primary key AND LangGraph checkpoint thread_id. */
  threadId: string;
  /** Model the next chat turn will use. `null` for legacy rows; mutable via PATCH. */
  userModelId: string | null;
  /** Auto-generated or user-set title; `null` until auto-title lands. */
  title: string | null;
  /** Per-conversation Anthropic extended-thinking toggle. */
  thinkingEnabled: boolean;
  /** Per-user "pin to sidebar top" flag. */
  pinned: boolean;
  /** ISO-8601 UTC timestamp of the last pin event, or `null` when not pinned. */
  pinnedAt: string | null;
  createdAt: string;
}

/** One tool invocation surfaced under an assistant turn. */
export interface PersistedToolCall {
  id: string;
  name: string;
  args?: Record<string, unknown>;
  result?: string;
}

/**
 * A persisted message turn (`GET /api/conversations/{id}/messages`).
 *
 * The chat surface (`useChatSession`) translates these into the in-memory
 * `ChatMessage` shape it renders on hydration.
 */
export interface PersistedMessage {
  id: string;
  role: MessageRole;
  content: string;
  /** Assistant-only tool invocations; `null` for other roles. */
  toolCalls: PersistedToolCall[] | null;
  /** Assistant-only: the `user_model` that produced this content (BE 0010). */
  userModelId: string | null;
  messageIndex: number;
  createdAt: string;
  modifiedAt: string;
  /** Assistant-only terminal stop signal; `null` for other roles / legacy rows. */
  finishReason: FinishReason | null;
  /** Assistant-only extended-thinking trace (BE 0026); `null` otherwise. */
  reasoning: string | null;
}

/** Body for `POST /api/conversations` (eager-create before the first turn). */
export interface CreateConversationPayload {
  /** Client-supplied UUID, reused as the `/chat/{id}` route and thread_id. */
  threadId: string;
  /** Model the first turn will use. */
  userModelId?: string | null;
  /** Apply the first-turn extended-thinking choice at create time. */
  thinkingEnabled?: boolean;
}

/** Partial-update body for `PATCH /api/conversations/{id}`. */
export interface UpdateConversationPayload {
  title?: string;
  userModelId?: string;
  thinkingEnabled?: boolean;
  pinned?: boolean;
}

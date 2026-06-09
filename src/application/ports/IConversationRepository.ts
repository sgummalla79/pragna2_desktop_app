import type {
  Conversation,
  CreateConversationPayload,
  PersistedMessage,
  UpdateConversationPayload,
} from '@/domain/types/conversation.types';

/** Filter / pagination shape accepted by {@link IConversationRepository.list}. */
export interface ConversationListParams {
  /** Max rows to return. */
  limit?: number;
  /** Rows to skip (offset pagination). */
  offset?: number;
  /** `true` → only pinned (by `pinned_at` desc), `false` → only unpinned,
   *  `undefined` → all by `created_at` desc. */
  pinned?: boolean;
}

/**
 * Port for conversation persistence (`/api/conversations/*`).
 *
 * Phase 1 surface: list / get / create / messages / update / delete. Usage,
 * branch, and truncate-from are deferred (see `docs/TODO.md`).
 */
export interface IConversationRepository {
  /** List the authenticated user's conversations (newest first). */
  list(params?: ConversationListParams): Promise<Conversation[]>;
  /**
   * Read a single conversation by id. Returns `null` for "not found" / "not
   * owned" (both 404 server-side) so the caller can render the "New chat"
   * placeholder without an error.
   */
  get(conversationId: string): Promise<Conversation | null>;
  /**
   * Eager-create a conversation row before the first message is sent.
   * Idempotent: a retry with the same `threadId` returns the existing row
   * (BE returns 200 vs 201; both map to the same shape here).
   */
  create(payload: CreateConversationPayload): Promise<Conversation>;
  /** Persisted message log for a conversation, ordered by `messageIndex`. */
  getMessages(conversationId: string): Promise<PersistedMessage[]>;
  /** Partial-update: title, active model, thinking flag, and/or pin. */
  update(
    conversationId: string,
    payload: UpdateConversationPayload,
  ): Promise<Conversation>;
  /** Hard-delete; FK cascade removes messages + usage records. */
  delete(conversationId: string): Promise<void>;
}

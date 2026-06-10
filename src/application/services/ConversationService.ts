import type {
  ConversationListParams,
  IConversationRepository,
} from '@/application/ports/IConversationRepository';
import type {
  Conversation,
  CreateConversationPayload,
  PersistedMessage,
  UpdateConversationPayload,
} from '@/domain/types/conversation.types';

/**
 * Application-layer facade over {@link IConversationRepository}.
 *
 * One-line delegations today; the service exists so views acquire the
 * dependency through `useServices()` and future cross-cutting concerns land
 * here without changing call sites.
 */
export class ConversationService {
  constructor(private readonly conversationRepository: IConversationRepository) {}

  /** List the user's conversations (newest first). */
  list(params?: ConversationListParams): Promise<Conversation[]> {
    return this.conversationRepository.list(params);
  }

  /** Read one conversation, or `null` if absent / not owned. */
  get(conversationId: string): Promise<Conversation | null> {
    return this.conversationRepository.get(conversationId);
  }

  /** Eager-create (idempotent on `threadId`). */
  create(payload: CreateConversationPayload): Promise<Conversation> {
    return this.conversationRepository.create(payload);
  }

  /** Persisted message log, ordered by `messageIndex`. */
  getMessages(conversationId: string): Promise<PersistedMessage[]> {
    return this.conversationRepository.getMessages(conversationId);
  }

  /** Partial-update title / model / thinking / pin. */
  update(
    conversationId: string,
    payload: UpdateConversationPayload,
  ): Promise<Conversation> {
    return this.conversationRepository.update(conversationId, payload);
  }

  /** Hard-delete the conversation. */
  delete(conversationId: string): Promise<void> {
    return this.conversationRepository.delete(conversationId);
  }

  /** Truncate the conversation at a message (delete it + everything after). */
  truncateFrom(conversationId: string, messageId: string): Promise<void> {
    return this.conversationRepository.truncateFrom(conversationId, messageId);
  }

  /** Fork a new conversation up to + including a message. */
  branch(conversationId: string, messageId: string): Promise<Conversation> {
    return this.conversationRepository.branch(conversationId, messageId);
  }
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import { invalidateConversationListQueries } from './useConversations';

/**
 * Mutations against a single conversation: rename, change active model, toggle
 * pin, toggle extended-thinking, delete.
 *
 * Each invalidates only the sidebar list queries (+ the affected conversation's
 * single-lookup) on success — never the per-conversation `messages` subtree,
 * which is unrelated to these row-level edits.
 */

/** Rename a conversation. */
export function useRenameConversation() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      conversationService.update(id, { title }),
    onSuccess: (_data, vars) =>
      invalidateConversationListQueries(qc, { conversationId: vars.id }),
  });
}

/** Change the active model for a conversation; the next turn uses the new one. */
export function useSetConversationModel() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userModelId }: { id: string; userModelId: string }) =>
      conversationService.update(id, { userModelId }),
    onSuccess: (_data, vars) =>
      invalidateConversationListQueries(qc, { conversationId: vars.id }),
  });
}

/** Toggle the per-user pin flag; pinning stamps `pinned_at` server-side. */
export function useSetPinned() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      conversationService.update(id, { pinned }),
    onSuccess: (_data, vars) =>
      invalidateConversationListQueries(qc, { conversationId: vars.id }),
  });
}

/** Toggle the per-conversation Anthropic extended-thinking flag. */
export function useSetThinkingEnabled() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, thinkingEnabled }: { id: string; thinkingEnabled: boolean }) =>
      conversationService.update(id, { thinkingEnabled }),
    onSuccess: (_data, vars) =>
      invalidateConversationListQueries(qc, { conversationId: vars.id }),
  });
}

/**
 * Hard-delete a conversation. FK cascade removes messages.
 *
 * Cache lifecycle is load-bearing: `onMutate` cancels in-flight per-conversation
 * refetches (so a refetch can't land after the row is dropped → 404), and
 * `onSuccess` invalidates ONLY the length-2 list keys (never the per-conv
 * subtree, whose still-mounted observers would otherwise refetch and 404).
 * Callers navigate away from `/chat/<id>` before awaiting this mutation.
 */
export function useDeleteConversation() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationService.delete(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['conversations', id] });
    },
    onSuccess: () => {
      qc.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'conversations' && q.queryKey.length === 2,
      });
    },
  });
}

/**
 * Truncate a conversation at a message (delete it + everything after). The
 * shared primitive behind edit + regenerate; the caller re-sends afterward.
 * Invalidates the per-conversation message log so the truncated state shows.
 */
export function useTruncateFromMessage() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) =>
      conversationService.truncateFrom(conversationId, messageId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ['conversations', vars.conversationId, 'messages'],
      });
    },
  });
}

/**
 * Fork a new conversation from a message; returns the new conversation (the
 * caller navigates to it and re-sends the branch-point message). Refreshes the
 * sidebar list so the fork appears.
 */
export function useBranchConversation() {
  const { conversationService } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) =>
      conversationService.branch(conversationId, messageId),
    onSuccess: () => invalidateConversationListQueries(qc),
  });
}

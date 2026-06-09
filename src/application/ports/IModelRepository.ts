import type { BulkUpdateEntry, Model, UpdateModelPayload } from '@/domain/types/model.types';

/**
 * Access to a user's registered models (/api/user-models).
 *
 * Models are created automatically when a provider is registered (POST /api/user-providers)
 * or when models are refreshed (POST /api/user-providers/{id}/refresh-models).
 * There is no standalone POST or DELETE on user_models — deletion cascades from the provider.
 */
export interface IModelRepository {
  list(): Promise<Model[]>;
  update(id: string, payload: UpdateModelPayload): Promise<Model>;
  /**
   * Apply many partial updates in one server transaction.
   * All-or-nothing: a single bad id or constraint failure rejects the
   * whole batch. Returns the updated rows in input order.
   */
  bulkUpdate(updates: BulkUpdateEntry[]): Promise<Model[]>;
}

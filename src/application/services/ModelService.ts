import type { IModelRepository } from '@/application/ports/IModelRepository';
import type { BulkUpdateEntry, Model, UpdateModelPayload } from '@/domain/types/model.types';

/**
 * Manages user models via /api/user-models.
 *
 * Models are created automatically when a provider is registered or refreshed.
 * There is no standalone create or delete — those operations cascade from the provider.
 */
export class ModelService {
  constructor(private readonly modelRepository: IModelRepository) {}

  list(): Promise<Model[]> {
    return this.modelRepository.list();
  }

  update(id: string, payload: UpdateModelPayload): Promise<Model> {
    return this.modelRepository.update(id, payload);
  }

  /** Applies many partial updates in a single server transaction. */
  bulkUpdate(updates: BulkUpdateEntry[]): Promise<Model[]> {
    return this.modelRepository.bulkUpdate(updates);
  }
}

import type { IUserProviderRepository } from '@/application/ports/IProviderRepository';
import type { UserProvider, RegisterProviderPayload, ProviderWithModels } from '@/domain/types/provider.types';
import type { RefreshModelsResult } from '@/domain/types/model.types';

/** Manages the user's registered providers via the /api/user-providers endpoints. */
export class ProviderService {
  constructor(private readonly providerRepository: IUserProviderRepository) {}

  /** Returns all providers the user has connected. */
  list(): Promise<UserProvider[]> {
    return this.providerRepository.list();
  }

  /**
   * Registers a provider and auto-discovers its models in one transaction.
   * @returns The new provider record alongside its auto-discovered models.
   */
  register(payload: RegisterProviderPayload): Promise<ProviderWithModels> {
    return this.providerRepository.register(payload);
  }

  /**
   * Reconciles the stored model list against what the provider currently returns upstream.
   * New models start `enabled=false`; previously archived models that reappear are flagged.
   */
  refreshModels(providerId: string): Promise<RefreshModelsResult> {
    return this.providerRepository.refreshModels(providerId);
  }

  /** Enables or disables a registered provider. */
  toggle(id: string, enabled: boolean): Promise<UserProvider> {
    return this.providerRepository.toggle(id, enabled);
  }

  /** Deletes a provider and cascades to all its user_models. */
  delete(id: string): Promise<void> {
    return this.providerRepository.delete(id);
  }
}

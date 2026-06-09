import type { AxiosInstance } from 'axios';
import type { IUserProviderRepository } from '@/application/ports/IProviderRepository';
import type { RegisterProviderPayload, UserProvider, ProviderWithModels } from '@/domain/types/provider.types';
import type { RefreshModelsResult } from '@/domain/types/model.types';
import { mapModel, type ApiModelResponse } from './mappers/mapModel';

interface ApiUserProviderResponse {
  id: string;
  llm_provider_id: string;
  /** Backend R3.5+ renamed `provider_name` → `provider_api_name`. */
  provider_api_name: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

interface ApiProviderWithModelsResponse {
  provider: ApiUserProviderResponse;
  models: ApiModelResponse[];
}

interface ApiRefreshModelsResponse {
  created:    ApiModelResponse[];
  archived:   ApiModelResponse[];
  unarchived: ApiModelResponse[];
  models:     ApiModelResponse[];
}

function mapUserProvider(raw: ApiUserProviderResponse): UserProvider {
  return {
    id:            raw.id,
    llmProviderId: raw.llm_provider_id,
    providerName:  raw.provider_api_name,
    enabled:       raw.enabled,
    metadata:      raw.metadata ?? {},
  };
}

/** Manages user_providers: register, refresh models, delete. */
export class ProviderRepository implements IUserProviderRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<UserProvider[]> {
    const { data } = await this.http.get<ApiUserProviderResponse[]>('/user-providers');
    return data.map(mapUserProvider);
  }

  async register(payload: RegisterProviderPayload): Promise<ProviderWithModels> {
    const { data } = await this.http.post<ApiProviderWithModelsResponse>('/user-providers', {
      llm_provider_id: payload.llmProviderId,
      api_key:         payload.apiKey,
    });
    return {
      provider: mapUserProvider(data.provider),
      models:   data.models.map(mapModel),
    };
  }

  async refreshModels(providerId: string): Promise<RefreshModelsResult> {
    const { data } = await this.http.post<ApiRefreshModelsResponse>(
      `/user-providers/${providerId}/refresh-models`
    );
    return {
      created:    data.created.map(mapModel),
      archived:   data.archived.map(mapModel),
      unarchived: data.unarchived.map(mapModel),
      models:     data.models.map(mapModel),
    };
  }

  async toggle(id: string, enabled: boolean): Promise<UserProvider> {
    const { data } = await this.http.patch<ApiUserProviderResponse>(
      `/user-providers/${id}`,
      { enabled }
    );
    return mapUserProvider(data);
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/user-providers/${id}`);
  }
}

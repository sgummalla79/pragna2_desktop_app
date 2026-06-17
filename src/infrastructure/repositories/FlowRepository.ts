import type { AxiosInstance } from 'axios';
import type {
  IFlowRepository,
  SaveFromYamlResult,
} from '@/application/ports/IFlowRepository';
import type {
  CreateFlowPayload,
  Flow,
  UpdateFlowPayload,
  UpdateFlowSlashExposurePayload,
} from '@/domain/types/flow.types';
import type { YamlValidationResult } from '@/domain/types/flowYaml.types';
import { mapFlow, type ApiFlowResponse } from './mappers/mapFlow';

/**
 * Axios-backed flow repository (`/api/flows/*`).
 *
 * Call sites are resource-relative; the shared client supplies the `/api`
 * baseURL and (in the desktop app) routes through the Tauri native HTTP adapter.
 */
export class FlowRepository implements IFlowRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<Flow[]> {
    const { data } = await this.http.get<ApiFlowResponse[]>('/flows');
    return data.map(mapFlow);
  }

  async get(id: string): Promise<Flow> {
    const { data } = await this.http.get<ApiFlowResponse>(`/flows/${id}`);
    return mapFlow(data);
  }

  async create(payload: CreateFlowPayload): Promise<Flow> {
    const { data } = await this.http.post<ApiFlowResponse>('/flows', {
      api_name: payload.apiName,
      display_name: payload.displayName,
      description: payload.description,
      metadata: payload.metadata ?? {},
      ...(payload.definition !== undefined ? { definition: payload.definition } : {}),
    });
    return mapFlow(data);
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/flows/${id}`);
  }

  async validateYaml(definition: string): Promise<YamlValidationResult> {
    const { data } = await this.http.post<YamlValidationResult>(
      '/flows/validate-yaml',
      { definition },
    );
    return data;
  }

  async saveFromYaml(definition: string): Promise<SaveFromYamlResult> {
    const response = await this.http.post<ApiFlowResponse>('/flows/from-yaml', {
      definition,
    });
    return { flow: mapFlow(response.data), created: response.status === 201 };
  }

  async saveFromYamlById(
    flowId: string,
    definition: string,
  ): Promise<SaveFromYamlResult> {
    // By-id save is always an update (200 OK, never 201).
    const response = await this.http.put<ApiFlowResponse>(
      `/flows/${flowId}/from-yaml`,
      { definition },
    );
    return { flow: mapFlow(response.data), created: false };
  }

  async updateFlow(flowId: string, payload: UpdateFlowPayload): Promise<Flow> {
    const body: Record<string, unknown> = {};
    if (payload.displayName !== undefined) body.display_name = payload.displayName;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.enabled !== undefined) body.enabled = payload.enabled;
    const { data } = await this.http.patch<ApiFlowResponse>(`/flows/${flowId}`, body);
    return mapFlow(data);
  }

  async updateSlashExposure(
    flowId: string,
    payload: UpdateFlowSlashExposurePayload,
  ): Promise<Flow> {
    const body: Record<string, unknown> = {};
    if (payload.slashApiName !== undefined) body.slash_api_name = payload.slashApiName;
    if (payload.exposedAsSlash !== undefined) {
      body.exposed_as_slash = payload.exposedAsSlash;
    }
    if (payload.clearSlashApiName) body.clear_slash_api_name = true;
    const { data } = await this.http.patch<ApiFlowResponse>(
      `/flows/${flowId}/slash-exposure`,
      body,
    );
    return mapFlow(data);
  }
}

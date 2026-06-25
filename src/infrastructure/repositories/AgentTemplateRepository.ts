/**
 * Axios-backed implementation of {@link IAgentTemplateRepository}.
 *
 * All endpoint paths are relative to the axios `baseURL` (which already
 * includes `/api`). Errors propagate as `AxiosError` for the view layer to map
 * to a catalog code — there is no expected-404 state to collapse here.
 */

import type { AxiosInstance } from 'axios';
import type { IAgentTemplateRepository } from '@/application/ports/IAgentTemplateRepository';
import type {
  ActivatedAgentTemplate,
  AgentTemplate,
} from '@/domain/types/agentTemplate.types';
import {
  type ApiActivateAgentTemplateResponse,
  type ApiAgentTemplateResponse,
  mapActivatedAgentTemplate,
  mapAgentTemplate,
} from './mappers/mapAgentTemplate';

/** Browses + activates system agent templates via /api/agents/templates. */
export class AgentTemplateRepository implements IAgentTemplateRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<AgentTemplate[]> {
    const { data } = await this.http.get<ApiAgentTemplateResponse[]>(
      '/agents/templates',
    );
    return data.map(mapAgentTemplate);
  }

  async get(key: string): Promise<AgentTemplate> {
    const { data } = await this.http.get<ApiAgentTemplateResponse>(
      `/agents/templates/${key}`,
    );
    return mapAgentTemplate(data);
  }

  async activate(key: string): Promise<ActivatedAgentTemplate> {
    const { data } = await this.http.post<ApiActivateAgentTemplateResponse>(
      `/agents/templates/${key}/activate`,
    );
    return mapActivatedAgentTemplate(data);
  }
}

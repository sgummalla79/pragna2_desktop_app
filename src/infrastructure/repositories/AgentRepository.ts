/**
 * Axios-backed implementation of {@link IAgentRepository}.
 *
 * All endpoint paths are relative to the axios `baseURL` (which already
 * includes `/api`). The only collapsed error is `getDefault`'s 404 → null
 * ("no default yet"); everything else propagates as an `AxiosError` for the
 * view layer to map to a catalog code.
 */

import axios, { type AxiosInstance } from 'axios';
import type { IAgentRepository } from '@/application/ports/IAgentRepository';
import type {
  Agent,
  CreateAgentPayload,
  DefaultAgentTemplate,
  UpdateAgentPayload,
} from '@/domain/types/agent.types';
import type {
  AgentConnector,
  AttachAgentConnectorPayload,
  UpdateAgentConnectorPayload,
} from '@/domain/types/agentConnector.types';
import {
  type ApiAgentResponse,
  type ApiDefaultAgentTemplateResponse,
  mapAgent,
  mapDefaultAgentTemplate,
} from './mappers/mapAgent';
import {
  type ApiAgentConnectorResponse,
  mapAgentConnector,
} from './mappers/mapAgentConnector';

/** HTTP status meaning "no default agent exists yet" — an expected state. */
const HTTP_NOT_FOUND = 404;

/** Manages standalone agents and their connector bindings via /api/agents. */
export class AgentRepository implements IAgentRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(includeArchived = false): Promise<Agent[]> {
    const { data } = await this.http.get<ApiAgentResponse[]>('/agents', {
      params: includeArchived ? { include_archived: true } : undefined,
    });
    return data.map(mapAgent);
  }

  async get(id: string): Promise<Agent> {
    const { data } = await this.http.get<ApiAgentResponse>(`/agents/${id}`);
    return mapAgent(data);
  }

  async getDefault(): Promise<Agent | null> {
    try {
      const { data } = await this.http.get<ApiAgentResponse>('/agents/default');
      return mapAgent(data);
    } catch (err) {
      // 404 = the user hasn't created a default agent yet. That's an
      // expected state (the FE shows the create-default banner), NOT an
      // error — collapse it to null so the query resolves successfully.
      if (axios.isAxiosError(err) && err.response?.status === HTTP_NOT_FOUND) {
        return null;
      }
      throw err;
    }
  }

  async getDefaultTemplate(): Promise<DefaultAgentTemplate> {
    const { data } = await this.http.get<ApiDefaultAgentTemplateResponse>(
      '/agents/default-template',
    );
    return mapDefaultAgentTemplate(data);
  }

  async create(payload: CreateAgentPayload): Promise<Agent> {
    const { data } = await this.http.post<ApiAgentResponse>('/agents', {
      api_name: payload.apiName,
      display_name: payload.displayName,
      description: payload.description ?? null,
      system_prompt: payload.systemPrompt ?? '',
      tools: payload.tools ?? [],
      is_default: payload.isDefault ?? false,
      metadata: payload.metadata ?? {},
    });
    return mapAgent(data);
  }

  async update(id: string, payload: UpdateAgentPayload): Promise<Agent> {
    // Only send the fields the caller set — the BE applies exclude_unset
    // semantics, so omitting a key leaves it unchanged.
    const body: Record<string, unknown> = {};
    if (payload.displayName !== undefined) body.display_name = payload.displayName;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.systemPrompt !== undefined) body.system_prompt = payload.systemPrompt;
    if (payload.tools !== undefined) body.tools = payload.tools;
    if (payload.status !== undefined) body.status = payload.status;
    if (payload.metadata !== undefined) body.metadata = payload.metadata;
    const { data } = await this.http.patch<ApiAgentResponse>(
      `/agents/${id}`,
      body,
    );
    return mapAgent(data);
  }

  async setDefault(id: string): Promise<Agent> {
    const { data } = await this.http.post<ApiAgentResponse>(
      `/agents/${id}/set-default`,
    );
    return mapAgent(data);
  }

  async archive(id: string): Promise<void> {
    await this.http.delete(`/agents/${id}`);
  }

  // ── MCP connector attachments (sub-resource) ──────────────────────────────

  async listConnectors(agentId: string): Promise<AgentConnector[]> {
    const { data } = await this.http.get<ApiAgentConnectorResponse[]>(
      `/agents/${agentId}/connectors`,
    );
    return data.map(mapAgentConnector);
  }

  async attachConnector(
    agentId: string,
    payload: AttachAgentConnectorPayload,
  ): Promise<AgentConnector> {
    const { data } = await this.http.post<ApiAgentConnectorResponse>(
      `/agents/${agentId}/connectors`,
      {
        mcp_connector_id: payload.mcpConnectorId,
        selected_tools: payload.selectedTools ?? null,
      },
    );
    return mapAgentConnector(data);
  }

  async updateConnector(
    agentId: string,
    bindingId: string,
    payload: UpdateAgentConnectorPayload,
  ): Promise<AgentConnector> {
    const { data } = await this.http.patch<ApiAgentConnectorResponse>(
      `/agents/${agentId}/connectors/${bindingId}`,
      { selected_tools: payload.selectedTools },
    );
    return mapAgentConnector(data);
  }

  async detachConnector(agentId: string, bindingId: string): Promise<void> {
    await this.http.delete(`/agents/${agentId}/connectors/${bindingId}`);
  }
}

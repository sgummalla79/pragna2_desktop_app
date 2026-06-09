/**
 * Axios-backed implementation of `IMcpConnectorRepository`.
 *
 * Maps domain payloads ↔ snake_case API shapes via
 * `mappers/mapMcpConnector.ts`. Errors propagate as axios errors; the
 * TanStack Query hook layer catches + surfaces them via the error catalog.
 */

import type { AxiosInstance } from 'axios';
import type { IMcpConnectorRepository } from '@/application/ports/IMcpConnectorRepository';
import type {
  CreateMcpConnectorPayload,
  McpConnector,
  RefreshToolsResult,
  RegisteredMcpConnector,
  StartOAuthPayload,
  StartOAuthResult,
  UpdateMcpConnectorPayload,
} from '@/domain/types/mcp.types';
import {
  type ApiMcpConnectorResponse,
  type ApiRefreshToolsResponse,
  type ApiRegisteredMcpConnectorResponse,
  mapMcpConnector,
  mapRegisteredMcpConnector,
  toApiCreatePayload,
  toApiUpdatePayload,
} from './mappers/mapMcpConnector';

/** Manages mcp_connectors: list, register, update, archive, refresh, oauth. */
export class McpConnectorRepository implements IMcpConnectorRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<McpConnector[]> {
    const { data } = await this.http.get<ApiMcpConnectorResponse[]>(
      '/mcp-connectors',
    );
    return data.map(mapMcpConnector);
  }

  async register(
    payload: CreateMcpConnectorPayload,
  ): Promise<RegisteredMcpConnector> {
    const { data } = await this.http.post<ApiRegisteredMcpConnectorResponse>(
      '/mcp-connectors',
      toApiCreatePayload(payload),
    );
    return mapRegisteredMcpConnector(data);
  }

  async update(
    id: string,
    payload: UpdateMcpConnectorPayload,
  ): Promise<McpConnector> {
    const { data } = await this.http.patch<ApiMcpConnectorResponse>(
      `/mcp-connectors/${id}`,
      toApiUpdatePayload(payload),
    );
    return mapMcpConnector(data);
  }

  async archive(id: string): Promise<void> {
    await this.http.delete(`/mcp-connectors/${id}`);
  }

  async refreshTools(id: string): Promise<RefreshToolsResult> {
    const { data } = await this.http.post<ApiRefreshToolsResponse>(
      `/mcp-connectors/${id}/refresh-tools`,
    );
    return {
      added: data.added,
      unchanged: data.unchanged,
      archived: data.archived,
    };
  }

  async startOAuth(
    id: string,
    payload: StartOAuthPayload,
  ): Promise<StartOAuthResult> {
    const body: Record<string, unknown> = {};
    if (payload.clientId !== undefined) body.client_id = payload.clientId;
    if (payload.clientSecret !== undefined) {
      body.client_secret = payload.clientSecret;
    }
    const { data } = await this.http.post<{
      authorization_url: string | null;
      requires_manual_client: boolean;
    }>(`/mcp-connectors/${id}/oauth-authorization`, body);
    return {
      authorizationUrl: data.authorization_url ?? null,
      requiresManualClient: data.requires_manual_client,
    };
  }
}

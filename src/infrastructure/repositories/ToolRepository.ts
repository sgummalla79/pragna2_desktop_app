/**
 * Axios-backed implementation of `IToolRepository`.
 */

import type { AxiosInstance } from 'axios';
import type { IToolRepository } from '@/application/ports/IToolRepository';
import type { Tool, UpdateToolPayload } from '@/domain/types/tool.types';
import { type ApiToolResponse, mapTool } from './mappers/mapTool';

/** Manages tools: list the flat inventory, toggle the per-user enabled flag. */
export class ToolRepository implements IToolRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(): Promise<Tool[]> {
    const { data } = await this.http.get<ApiToolResponse[]>('/tools');
    return data.map(mapTool);
  }

  async setEnabled(id: string, payload: UpdateToolPayload): Promise<Tool> {
    const { data } = await this.http.patch<ApiToolResponse>(`/tools/${id}`, {
      enabled: payload.enabled,
    });
    return mapTool(data);
  }
}

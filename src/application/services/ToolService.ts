import type { IToolRepository } from '@/application/ports/IToolRepository';
import type { Tool, UpdateToolPayload } from '@/domain/types/tool.types';

/**
 * Manages the user's tools via the `/api/tools/*` endpoints.
 * Thin facade over the repository.
 */
export class ToolService {
  constructor(private readonly repo: IToolRepository) {}

  /** Flat list across global + per-user rows. */
  list(): Promise<Tool[]> {
    return this.repo.list();
  }

  /** Toggle the per-user `enabled` flag (BE returns 403 for
   *  system-managed rows, 404 for unowned / global rows). */
  setEnabled(id: string, payload: UpdateToolPayload): Promise<Tool> {
    return this.repo.setEnabled(id, payload);
  }
}

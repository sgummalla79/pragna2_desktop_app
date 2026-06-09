/**
 * Port for the tools repository.
 *
 * Application layer depends on this interface; concrete implementation
 * (axios-backed) lives in `src/infrastructure/repositories/ToolRepository.ts`.
 */

import type { Tool, UpdateToolPayload } from '@/domain/types/tool.types';

export interface IToolRepository {
  /** Flat list of every tool the authenticated user can see — global
   *  rows (e.g. seeded `ask_user`) AND per-user rows (MCP-discovered).
   *  Includes disabled and not-yet-toggled-on rows so the FE can
   *  render the manage-tools surface with full state. Maps to
   *  `GET /api/tools`. */
  list(): Promise<Tool[]>;

  /** Flip the per-user `enabled` flag. The BE returns 403 for
   *  system-managed rows (e.g. seeded `ask_user`) and 404 for rows
   *  owned by other users or for global rows. Maps to
   *  `PATCH /api/tools/{id}`. */
  setEnabled(id: string, payload: UpdateToolPayload): Promise<Tool>;
}

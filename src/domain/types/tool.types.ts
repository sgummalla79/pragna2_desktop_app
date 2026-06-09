/**
 * Domain types for the `/api/tools` endpoints.
 *
 * Flat view across every tool the authenticated user can see — global
 * builtin rows (e.g. seeded `ask_user`) and per-user MCP-connector rows. Used
 * by the MCP-connector card to render the per-tool toggle list.
 */

export type ToolType = 'builtin' | 'mcp';

/** One row from `GET /api/tools`. */
export interface Tool {
  id: string;
  /** Null for global / system-managed rows (e.g. seeded `ask_user`).
   *  Set for per-user rows (today: MCP-discovered). */
  userId: string | null;
  /** Set when `toolType === 'mcp'` (the owning MCP connector); null
   *  otherwise. MCP tools live in the BE `mcp_connector_tools` table; this is
   *  its `mcp_connector_id` FK. */
  mcpConnectorId: string | null;
  /** Namespaced name the LLM sees and that an agent's `tools`
   *  references (e.g. `ask_user`, `mcp.my-linear.create_issue`). */
  apiName: string;
  displayName: string;
  description: string;
  toolType: ToolType;
  /** BuiltinHandlerRegistry key for `toolType='builtin'`; null otherwise. */
  handlerFamily: string | null;
  /** True for operator-controlled rows (seeded `ask_user`). The
   *  per-user enable toggle is forbidden against these (BE returns 403). */
  systemManaged: boolean;
  /** True = bound to the default chat agent without explicit opt-in.
   *  Today only true for the seeded `ask_user`. */
  autoBindToDefaultAgent: boolean;
  /** Per-row master toggle. */
  enabled: boolean;
  /** ISO-8601 timestamps from the BE. */
  createdAt: string;
  modifiedAt: string;
}

/** Body for `PATCH /api/tools/{id}` — only the enable toggle is supported
 *  (other fields on the tool row are server-controlled). */
export interface UpdateToolPayload {
  enabled: boolean;
}

/**
 * Centralised error catalog.
 *
 * Every user-facing error and every loggable error condition in the application
 * is defined here. Use the code for log correlation, the message for UI display.
 *
 * Prefixes
 *   AUTH  – authentication / session
 *   NET   – network / HTTP layer
 */

export const ERRORS = {
  // ── Authentication ────────────────────────────────────────────────────────
  AUTH_001: { code: 'AUTH_001', message: 'No active session. Please sign in.', severity: 'warn' },
  AUTH_002: { code: 'AUTH_002', message: 'Unable to read your profile from the sign-in token.', severity: 'error' },
  AUTH_003: { code: 'AUTH_003', message: 'Session refresh failed. Please sign in again.', severity: 'warn' },
  AUTH_004: { code: 'AUTH_004', message: 'Popup blocked. Allow popups for this site and try again.', severity: 'warn' },
  AUTH_005: { code: 'AUTH_005', message: 'Sign-in was cancelled.', severity: 'info' },
  AUTH_006: { code: 'AUTH_006', message: 'Social sign-in failed. Please try again.', severity: 'error' },
  AUTH_007: { code: 'AUTH_007', message: 'Invalid email or password.', severity: 'warn' },
  AUTH_008: { code: 'AUTH_008', message: 'Registration failed. This email may already be in use.', severity: 'warn' },
  AUTH_009: { code: 'AUTH_009', message: 'Sign-in timed out. Please try again.', severity: 'warn' },
  AUTH_010: { code: 'AUTH_010', message: 'Token exchange failed. Please try again.', severity: 'error' },

  // ── Providers ─────────────────────────────────────────────────────────────
  PRV_001: { code: 'PRV_001', message: 'Failed to load providers.', severity: 'error' },
  PRV_002: { code: 'PRV_002', message: 'This provider is already registered.', severity: 'warn' },
  PRV_003: { code: 'PRV_003', message: 'Failed to add provider. Check your API key and try again.', severity: 'error' },
  PRV_004: { code: 'PRV_004', message: 'Failed to remove provider.', severity: 'error' },
  PRV_005: { code: 'PRV_005', message: 'Failed to load provider catalogue.', severity: 'error' },
  PRV_006: { code: 'PRV_006', message: 'Failed to refresh models.', severity: 'error' },
  PRV_007: { code: 'PRV_007', message: 'Failed to update the provider.', severity: 'error' },

  // ── Models ────────────────────────────────────────────────────────────────
  MDL_001: { code: 'MDL_001', message: 'Failed to load models.', severity: 'error' },
  MDL_002: { code: 'MDL_002', message: 'Failed to register model.', severity: 'error' },
  MDL_003: { code: 'MDL_003', message: 'Failed to remove model.', severity: 'error' },
  MDL_004: { code: 'MDL_004', message: 'Failed to save model changes. Please try again.', severity: 'error' },

  // ── Configuration (embedding key) ───────────────────────────────────────────
  CFG_001: { code: 'CFG_001', message: 'Failed to load your embedding key status.', severity: 'error' },
  CFG_002: { code: 'CFG_002', message: 'Failed to save the embedding key. Check the key and try again.', severity: 'error' },
  CFG_003: { code: 'CFG_003', message: 'Failed to clear the embedding key.', severity: 'error' },

  // ── Connectors (MCP) ─────────────────────────────────────────────────────────
  CON_001: { code: 'CON_001', message: 'Failed to load connectors.', severity: 'error' },
  CON_002: { code: 'CON_002', message: 'Failed to register the connector. Check the URL and credentials.', severity: 'error' },
  CON_003: { code: 'CON_003', message: 'Failed to update the connector.', severity: 'error' },
  CON_004: { code: 'CON_004', message: 'Failed to remove the connector.', severity: 'error' },
  CON_005: { code: 'CON_005', message: 'Failed to refresh the connector tools.', severity: 'error' },
  CON_006: { code: 'CON_006', message: 'Failed to start the connection. Please try again.', severity: 'error' },

  // ── Tools ─────────────────────────────────────────────────────────────────
  TOOL_001: { code: 'TOOL_001', message: 'Failed to load tools.', severity: 'error' },
  TOOL_002: { code: 'TOOL_002', message: 'Failed to update the tool.', severity: 'error' },

  // ── Knowledge ────────────────────────────────────────────────────────────────
  KNW_001: { code: 'KNW_001', message: 'Failed to load knowledge libraries.', severity: 'error' },
  KNW_002: { code: 'KNW_002', message: 'Failed to create the library.', severity: 'error' },
  KNW_003: { code: 'KNW_003', message: 'Failed to remove the library.', severity: 'error' },
  KNW_004: { code: 'KNW_004', message: 'Failed to load documents.', severity: 'error' },
  KNW_005: { code: 'KNW_005', message: 'Failed to add the document.', severity: 'error' },
  KNW_006: { code: 'KNW_006', message: 'Failed to upload the file.', severity: 'error' },
  KNW_007: { code: 'KNW_007', message: 'Failed to delete the document.', severity: 'error' },

  // ── Agents ────────────────────────────────────────────────────────────────
  AGT_001: { code: 'AGT_001', message: 'Failed to load agents.', severity: 'error' },
  AGT_002: { code: 'AGT_002', message: 'You already have an agent with this name.', severity: 'warn' },
  AGT_003: { code: 'AGT_003', message: 'Failed to save agent. Check the fields and try again.', severity: 'error' },
  AGT_004: { code: 'AGT_004', message: 'Failed to archive agent.', severity: 'error' },
  AGT_005: { code: 'AGT_005', message: 'Failed to set the default agent.', severity: 'error' },
  AGT_006: { code: 'AGT_006', message: "The default agent can't be archived or deactivated. Set another agent as default first.", severity: 'warn' },
  AGT_007: { code: 'AGT_007', message: 'Agent name must be lowercase letters, digits, and hyphens (e.g. my-assistant).', severity: 'warn' },

  // ── Chat / Conversations ──────────────────────────────────────────────────
  CHT_001: { code: 'CHT_001', message: 'Failed to load conversations.', severity: 'error' },
  CHT_002: { code: 'CHT_002', message: 'Failed to start a new conversation.', severity: 'error' },
  CHT_003: { code: 'CHT_003', message: 'Failed to load this conversation.', severity: 'error' },
  CHT_004: { code: 'CHT_004', message: 'The assistant run failed. Please try again.', severity: 'error' },
  CHT_005: { code: 'CHT_005', message: 'Failed to update the conversation.', severity: 'error' },
  CHT_006: { code: 'CHT_006', message: 'Failed to delete the conversation.', severity: 'error' },
  CHT_007: { code: 'CHT_007', message: 'Connect a provider and enable a chat model to start chatting.', severity: 'warn' },
  CHT_008: { code: 'CHT_008', message: 'Failed to load slash commands.', severity: 'warn' },

  // ── Streaming (chat transport) ──────────────────────────────────────────────
  STREAM_001: { code: 'STREAM_001', message: 'Lost connection to the assistant. Please try again.', severity: 'error' },

  // ── HITL episodes (human-in-the-loop) ───────────────────────────────────────
  HITL_001: { code: 'HITL_001', message: 'Failed to load the pending form.', severity: 'warn' },
  HITL_002: { code: 'HITL_002', message: 'Failed to submit your response. Please try again.', severity: 'error' },
  HITL_003: { code: 'HITL_003', message: 'Failed to start the flow. Please try again.', severity: 'error' },

  // ── Agent Flows ─────────────────────────────────────────────────────────────
  FLW_001: { code: 'FLW_001', message: 'Failed to load flows.', severity: 'error' },
  FLW_002: { code: 'FLW_002', message: 'Failed to load this flow.', severity: 'error' },
  FLW_003: { code: 'FLW_003', message: 'Failed to create the flow. Check the fields and try again.', severity: 'error' },
  FLW_004: { code: 'FLW_004', message: 'Failed to delete the flow.', severity: 'error' },
  FLW_005: { code: 'FLW_005', message: 'Failed to save the flow. Fix the validation errors and try again.', severity: 'error' },
  FLW_006: { code: 'FLW_006', message: 'Failed to update slash exposure.', severity: 'error' },
  FLW_007: { code: 'FLW_007', message: 'A flow with this name already exists.', severity: 'warn' },
  FLW_008: { code: 'FLW_008', message: 'Slash name must be lowercase letters, digits, and hyphens (e.g. my-flow).', severity: 'warn' },

  // ── Network / HTTP ────────────────────────────────────────────────────────
  NET_401: { code: 'NET_401', message: 'Your session has expired. Please sign in again.', severity: 'warn' },
  NET_403: { code: 'NET_403', message: 'You do not have permission to perform this action.', severity: 'warn' },
  NET_404: { code: 'NET_404', message: 'The requested resource was not found.', severity: 'warn' },
  NET_409: { code: 'NET_409', message: 'This resource already exists.', severity: 'warn' },
  NET_500: { code: 'NET_500', message: 'A server error occurred. Please try again later.', severity: 'error' },
} as const;

export type ErrorCode = keyof typeof ERRORS;
export type ErrorEntry = typeof ERRORS[ErrorCode];

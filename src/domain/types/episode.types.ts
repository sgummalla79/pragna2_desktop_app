/**
 * Domain types for Human-in-the-Loop (HITL) chat episodes.
 *
 * An **episode** is a flow run that can pause for human input. When a flow's
 * `ask_user` tool fires, the run emits an `on_interrupt` event and the episode
 * row flips to `awaiting_user`, carrying the form `schema` the user must fill;
 * submitting it **resumes** the run. Episodes are also how a `propose_flow`
 * suggestion (accepted in chat) is launched.
 *
 * Read operations (`list`/`get`) are plain REST; the **start** and **resume**
 * runs are SSE and stream through the chat transport (see
 * `TauriHttpAgent.runRaw`), not through this type's repository.
 */

/** Lifecycle status of an episode (backend enum, verbatim). */
export type EpisodeStatus =
  | 'active'
  | 'awaiting_user'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * One episode row (camelCase domain projection of the backend `EpisodeResponse`).
 * `interruptValue` is the verbatim persisted `interrupt(value=…)` payload; for an
 * `awaiting_user` ask_user pause it holds `{ schema: AskUserSchema }`.
 */
export interface EpisodeSnapshot {
  id: string;
  conversationId: string;
  /** The flow being run; `null` for default-agent ask_user pauses. */
  flowId: string | null;
  /** LangGraph saver thread id for this episode's checkpoint state. */
  threadId: string;
  status: EpisodeStatus;
  /** Proposal summary (flow-proposal episodes only). */
  seedSummary: string | null;
  /** User's extra context from a flow proposal. */
  seedUserInput: string | null;
  /** Persisted interrupt payload (`{ schema }` while `awaiting_user`); else null. */
  interruptValue: Record<string, unknown> | null;
  createdAt: string;
  modifiedAt: string;
  /** Set once the episode reaches a terminal state. */
  endedAt: string | null;
}

/** A page of episodes (newest first), mirroring the list endpoint envelope. */
export interface EpisodeListPage {
  episodes: EpisodeSnapshot[];
  limit: number;
  offset: number;
}

/**
 * The `ask_user` form field types the backend can emit. Kept as a string union
 * matching the backend `type` strings verbatim (this schema is a passthrough
 * defined by the server's tool, not a desktop domain entity).
 */
export type AskUserFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'number'
  | 'checkbox'
  | 'file'
  | 'date'
  | 'daterange';

/**
 * A single field in an `ask_user` form. **snake_case on purpose** — this is the
 * verbatim schema the backend persists under `interrupt_value.schema`; the form
 * declares `additionalProperties: true`, so we consume it as-sent rather than
 * lossily re-mapping it.
 */
export interface AskUserField {
  /** Stable key the submitted value is returned under (in the `form` map). */
  name: string;
  label: string;
  type: AskUserFieldType;
  required?: boolean;
  default_value?: unknown;
  /** Choices for `select` / `multiselect`. */
  options?: string[];
  /** Numeric bound, or text length bound depending on the field type. */
  min?: number;
  max?: number;
  /** Regex (text fields only). */
  pattern?: string;
  placeholder?: string;
  helper_text?: string;
}

/** The `ask_user` form schema persisted under `interrupt_value.schema`. */
export interface AskUserSchema {
  fields: AskUserField[];
  /** When true, the composer doubles as a free-text field alongside the form. */
  allow_text_input?: boolean;
  /** Custom submit-button label (default "Submit"). */
  submit_label?: string;
}

/** Body for starting a flow episode (`POST …/episodes`) — e.g. proposal accept. */
export interface CreateEpisodePayload {
  /** `flows.api_name` to invoke (must be owned + enabled). */
  flowApiName: string;
  /** The propose-flow tool call's `summary` arg. */
  seedSummary?: string | null;
  /** Free-text the user added in the proposal card. */
  seedUserInput?: string | null;
}

/** Body for resuming a paused episode (`POST …/episodes/{id}/resume`). */
export interface ResumeEpisodePayload {
  /** Submitted form values keyed by field `name`; must match the schema. */
  form: Record<string, unknown>;
  /** Free-text from the composer when `allow_text_input` is true; else "". */
  text: string;
}

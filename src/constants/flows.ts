/**
 * Constants for flow authoring — the visual editor's meta bar + YAML
 * import/export. Intrinsic validation/format literals, externalised here per the
 * no-hardcoding rule rather than inlined in component logic.
 */

/**
 * A slash-command name: a leading lowercase letter, then lowercase letters,
 * digits, and hyphens. Mirrors the backend's per-user `slash_api_name`
 * constraint. Shared by the editor meta bar and the flow-list card so both
 * validate identically.
 */
export const FLOW_SLASH_NAME_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Fallback base filename for a YAML export when the flow has no `api_name` yet.
 * Mirrors the web app's export default.
 */
export const FLOW_YAML_EXPORT_FALLBACK_NAME = 'agentic-flow';

/** File extension appended to an exported flow YAML document. */
export const FLOW_YAML_FILE_EXT = '.yaml';

/** MIME type used for the exported flow YAML blob. */
export const FLOW_YAML_MIME = 'application/x-yaml';

/** `accept` filter for the YAML-import file picker. */
export const FLOW_YAML_ACCEPT = '.yaml,.yml';

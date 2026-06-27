/**
 * Client-side mirror of the BE `AGENT_API_NAME_PATTERN` (kebab-case).
 *
 * The BE is the source of truth (422 on violation); this lets the form give
 * immediate feedback before the round-trip. Library-style literal regex — kept
 * in this constants module rather than inlined in the form logic.
 */
export const API_NAME_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Metadata sentinel that marks a BE-owned **system agent** (one activated from a
 * system template, e.g. the Nexus Kit Help & Setup Assistant). The BE stamps
 * `metadata[SYSTEM_AGENT_METADATA_KEY] = SYSTEM_AGENT_ROLE_HELP_SETUP` at
 * activation; the FE reads it to render the "System" badge and to gate
 * system-only affordances (read-only view, "Update to latest").
 *
 * Mirrors the BE `HELP_AGENT_METADATA_KEY` / `HELP_AGENT_METADATA_VALUE`
 * constants — kept here (not inlined in view logic) to satisfy the no-hardcoding
 * rule and to give the system-agent helpers a single source of truth.
 */
export const SYSTEM_AGENT_METADATA_KEY = 'nexus_kit_role';
export const SYSTEM_AGENT_ROLE_HELP_SETUP = 'help_setup_assistant';

/**
 * Client-side mirror of the BE `AGENT_API_NAME_PATTERN` (kebab-case).
 *
 * The BE is the source of truth (422 on violation); this lets the form give
 * immediate feedback before the round-trip. Library-style literal regex — kept
 * in this constants module rather than inlined in the form logic.
 */
export const API_NAME_RE = /^[a-z][a-z0-9-]*$/;

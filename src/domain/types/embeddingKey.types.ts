/**
 * Types for the per-user embedding (Voyage) key (RAG ladder Rung 2).
 *
 * The key is an OPTIONAL override for the deployment embedding key, used when
 * the agent searches an attached knowledge library. It is write-only — the API
 * never returns the key, only whether one is set.
 */

/** Whether the user has a per-user embedding key stored. */
export interface EmbeddingKeyStatus {
  /** True when a per-user key is set; false → embeddings use the deployment key. */
  hasVoyageKey: boolean;
}

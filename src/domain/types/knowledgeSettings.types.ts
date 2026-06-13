/**
 * Types for the per-user knowledge / retrieval settings (RAG ladder Rung 2).
 *
 * These tune embeddings + hybrid search for the user's Knowledge libraries.
 * They were deployment config; they are now per-user, defaulted server-side and
 * editable at `/api/auth/me/knowledge-settings`. Fields split into three
 * behavioural classes (see the backend embeddings-system doc):
 *
 * - **Locked** — `embeddingProvider` / `embeddingDimensions`: bound to
 *   infrastructure (the vector column, the single provider). Not editable.
 * - **Default-for-new** — `embeddingModel` + the chunk sizes: only affect
 *   libraries created / documents ingested *after* a change.
 * - **Live** — rerank toggle/model, the search k's, and the CAG cap: take effect
 *   on the next search / read.
 */

/** A user's fully-resolved knowledge settings (defaults + their overrides). */
export interface KnowledgeSettings {
  // Locked (display only)
  embeddingProvider: string;
  embeddingDimensions: number;
  // Default-for-new
  embeddingModel: string;
  chunkMaxTokens: number;
  chunkOverlapTokens: number;
  // Live
  rerankEnabled: boolean;
  rerankModel: string;
  searchDenseK: number;
  searchSparseK: number;
  rrfK: number;
  rerankCandidates: number;
  searchTopK: number;
  cagMaxSourceTokens: number;
}

/** The editable subset (everything except the locked pins). */
export type EditableKnowledgeSettings = Omit<
  KnowledgeSettings,
  'embeddingProvider' | 'embeddingDimensions'
>;

/** A partial update — only the supplied fields change (PATCH-merge). */
export type KnowledgeSettingsUpdate = Partial<EditableKnowledgeSettings>;

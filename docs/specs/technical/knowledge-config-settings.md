# Technical Spec: Knowledge / Configuration Settings Cleanup

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-07-01
> **Last Updated**: 2026-07-01

---

## 1. Overview

Three FE-only changes in the presentation + infrastructure-mapper layers. No new
domain use cases; the only domain change is an additive field on the
`KnowledgeLibrary` type. The system-library hide is driven by a backend
`is_system` flag surfaced through the existing boundary mapper and filtered at
the view.

## 2. Architecture & Layer Placement

- **Domain**: `KnowledgeLibrary` gains an `isSystem: boolean` field (value object shape only).
- **Application**: unchanged — the existing `useKnowledgeLibraries` query/port is reused as-is.
- **Adapters**:
  - Router: `/settings` index redirect target changed.
  - Mapper: `mapKnowledgeLibrary` reads optional `is_system` (default `false`).
  - Views: Embeddings card relocated from `ConfigurationView` to `KnowledgeView`; `KnowledgeView` filters system libraries out of the management list only.

## 3. Data Flow

```
GET /api/knowledge-libraries
  -> KnowledgeRepository.listLibraries()
  -> mapKnowledgeLibrary(raw)                 // is_system -> isSystem (?? false)
  -> useKnowledgeLibraries()                  // shared hook, UNfiltered (agents/flows need all)
  -> KnowledgeView: libraries.filter(l => !l.isSystem)   // hide system libs HERE only
  -> KnowledgeLibraryCard[]                   // never rendered for system libs
```

## 4. Module & File Layout

```
src/
  domain/types/knowledge.types.ts                         # + isSystem: boolean
  infrastructure/repositories/mappers/mapKnowledge.ts     # + is_system?, map with ?? false
  presentation/router/AppRoutes.tsx                       # index -> SETTINGS_CONFIGURATION
  presentation/views/settings/
    ConfigurationView/ConfigurationView.tsx               # drop <EmbeddingKeySection/>
    KnowledgeView/
      KnowledgeView.tsx                                   # render <EmbeddingKeySection/>, filter list
      EmbeddingKeySection.tsx        (moved from ConfigurationView/)
      KnowledgeSettingsSection.tsx   (moved from ConfigurationView/)
      VoyageInstructionsSheet.tsx    (moved from ConfigurationView/)
```

## 5. Method Specifications

### `mapKnowledge`

#### `mapKnowledgeLibrary(r: ApiKnowledgeLibraryResponse) -> KnowledgeLibrary`

| Field | Detail |
|-------|--------|
| **Purpose** | Boundary map of a raw library row to the domain shape. |
| **Inputs** | `r` — raw API row; `is_system?: boolean` optional. |
| **Output** | `KnowledgeLibrary` with `isSystem: r.is_system ?? false`. |
| **Errors** | None (pure map). |
| **Side Effects** | None. |
| **Invariants** | `isSystem` is always defined post-map, even when the BE omits the field. |

### `KnowledgeView`

#### `KnowledgeView() -> JSX`

| Field | Detail |
|-------|--------|
| **Purpose** | Render the Knowledge settings page: embeddings card + user-owned library list. |
| **Inputs** | None (reads `useKnowledgeLibraries`, `useEmbeddingKeyStatus`). |
| **Output** | The page; list derived from `userLibraries = libraries.filter(l => !l.isSystem)`. |
| **Errors** | Library query error → `ERRORS.KNW_001` message (unchanged). |
| **Side Effects** | None beyond the existing queries. |
| **Invariants** | Filtering is view-local; the shared hook still returns all libraries for agent/flow pickers. |

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|-------|-------|------------|
| Libraries query failure | Adapter (view) | Existing `ERRORS.KNW_001` alert; unchanged. |
| Missing `is_system` | Adapter (mapper) | Coerced to `false` — no error, no regression. |

## 7. Configuration & Constants

| Constant | Source | Description |
|----------|--------|-------------|
| `ROUTES.SETTINGS_CONFIGURATION` | `src/constants/routes.ts` | New index redirect target. |
| `is_system` field name | Backend contract (nexus-kit-tracker #247) | Serialized flag; not hard-coded elsewhere. |

No library name/slug is hard-coded — system detection is purely the `is_system` flag (No-Hardcoding rule).

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `mapKnowledge` default-false | unit | `is_system` omitted → `isSystem === false`. |
| `mapKnowledge` true-case | unit | `is_system: true` → `isSystem === true`. |
| `KnowledgeView` hides system libs | unit | `isSystem` library absent from the list; user library present. |
| `KnowledgeView` empty when only system | unit | Empty state shown when all libraries are system. |
| `EmbeddingKeySection.test` (relocated) | unit | Card renders on Knowledge page; status/save/instructions flows. |
| `ConfigurationView.test` (trimmed) | unit | Heading + Chat-actions remain; embeddings assertions removed. |

## 9. Dependencies & External Integrations

- Backend `is_system` on `GET /api/knowledge-libraries` (nexus-kit-tracker #247). FE is forward-compatible without it.

## 10. Open Questions / Risks

- [ ] The visible hide of "Nexus Kit Documentation" depends on the backend setting `is_system = true` on seeded rows (#247 AC#2). Verified via DB that seeded rows are still `false` at time of writing; FE ships correct and inert until backfilled.

---

_Link to Feature Spec: [features/knowledge-config-settings.md](../features/knowledge-config-settings.md)_

# Feature Spec: Knowledge / Configuration Settings Cleanup

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-07-01
> **Last Updated**: 2026-07-01

---

## 1. Overview

A cohesive cleanup of the **AI Setup** area of the Settings screen, shipped
together. It (a) moves the **Embeddings — Voyage** configuration card from the
Configuration page to the Knowledge page — next to the libraries it powers,
(b) makes **Configuration** the default page when Settings opens (previously
Providers), and (c) hides backend-seeded / **system** knowledge libraries (e.g.
"Nexus Kit Documentation") from the user's Knowledge management list so they can
no longer be edited or deleted there. The seeded libraries remain usable —
attachable to agents and flows.

## 2. Goals & Non-Goals

**Goals**
- [x] Co-locate the embedding key + retrieval-tuning card with the Knowledge libraries.
- [x] Land on Configuration when Settings opens.
- [x] Hide system-managed libraries from the Knowledge management list.

**Non-Goals**
- Server-side enforcement of read-only for system libraries (backend — nexus-kit-tracker #247).
- Marking libraries as system (the `is_system` data itself is backend-owned — #247).
- Any change to how agents/flows attach or search libraries.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | find embeddings setup where my knowledge libraries live | the RAG setup reads as one place |
| user | open Settings straight onto Configuration | I start at the primary AI-setup page |
| user | not see corpora I didn't create in my library list | I can't accidentally edit/delete a system-managed library |

## 4. Acceptance Criteria

- [x] Given I open the Knowledge page, when it renders, then the "Embeddings — Voyage" card appears there and no longer on Configuration.
- [x] Given the Knowledge no-key alert, when I read it, then it points to the on-page Embeddings section (not "Configuration → Embeddings").
- [x] Given I navigate to `/settings`, when it resolves, then Configuration is shown.
- [x] Given a library with `isSystem = true`, when the Knowledge list renders, then it is not listed (and does not count toward the empty state).
- [x] Given the same system library, when I open the agent/flow knowledge picker, then it is still available to attach.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Backend omits `is_system` (older BE) | Treated as `false`; library shown (no regression). |
| Only system libraries exist for the user | Knowledge list shows the normal empty state. |
| System library already attached to an agent/flow | Attachment continues to work; only the management list hides it. |

## 6. Out of Scope

- The backend `is_system` flag value + server-side read-only enforcement (#247).
- Web FE parity (tracked separately if confirmed).

## 7. Open Questions

- [ ] None. (Backend data dependency tracked in nexus-kit-tracker #247.)

---

_Link to Technical Spec: [technical/knowledge-config-settings.md](../technical/knowledge-config-settings.md)_

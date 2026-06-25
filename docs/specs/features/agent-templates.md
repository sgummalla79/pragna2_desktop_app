# Feature Spec: System Agent Templates (Help & Setup Assistant)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-25
> **Last Updated**: 2026-06-25
>
> Tracker: nexus-kit-tracker #213 (Desktop FE: surface + activate the Help &
> Setup Assistant agent template). BE shipped in nexus-kit-api 2.0.2.

---

## 1. Overview

The backend exposes a catalog of pre-built **system agent templates** — ready-made
assistants the user can activate into their own agents. The first is the **Nexus
Kit Help & Setup Assistant** (`key = nexus-kit-help`). This feature adds a "System
agent templates" section to the **Settings → Agents** page that lists the catalog
and lets the user **activate** a template with one click. Once activated, the
template's agent appears in the user's agents list and becomes selectable in any
chat through the existing in-chat agent picker.

## 2. Goals & Non-Goals

**Goals**
- [x] List the system agent templates from `GET /api/agents/templates`.
- [x] Activate a template via `POST /api/agents/templates/{key}/activate`
      (idempotent: 201 created / 200 already existed).
- [x] After activation, surface success and — when the template's knowledge base
      was **not** seeded — show the BE-provided `knowledge_note`.
- [x] Make the activated agent immediately usable: it joins the agents list and is
      selectable in chat via the existing agent switcher.
- [x] Be data-driven (no hard-coded template key/name) so future system templates
      surface automatically.

**Non-Goals**
- A new mid-conversation agent-switch UI. Switching to the activated help agent
  **reuses** the already-shipped `AgentPicker` / `useSetConversationAgent`
  (agent-switcher feature). No new switch UI is built here.
- A dedicated Help button / app-chrome entry point (considered; not chosen).
- Editing or de-activating templates, or any template authoring (BE-owned).
- Auto-creating or auto-opening a conversation pinned to the help agent.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | see the available ready-made assistants | I can adopt one without authoring it |
| user | activate the Help & Setup Assistant | I get guided help setting up Nexus Kit |
| user | understand when its knowledge wasn't seeded | I know it runs from its built-in overview |
| user | switch a chat to the help agent | I can ask it questions in context |

## 4. Acceptance Criteria

- [x] Given the Agents settings page, when templates load, then a "System agent
      templates" section lists each template's display name, handle, and
      description.
- [x] Given an `activatable` template, when I click **Activate**, then the BE is
      called and a success toast appears (`"<name> activated."`, or
      `"<name> is already activated."` on an idempotent 200).
- [x] Given activation returns `knowledge_seeded = false` with a `knowledge_note`,
      then that note is surfaced to me.
- [x] Given a template that is already activated (`activatable = false`), then it
      shows an **Activated** badge and **no** Activate button.
- [x] Given activation succeeds, then the agents list above refreshes and the new
      agent is present (and selectable in chat).
- [x] Given activation fails, then an error toast shows the BE detail or the
      `AGT_009` fallback message.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Templates query is loading | Quiet "Loading templates…" line (section never blocks the page) |
| Templates query fails | `AGT_008` alert text; the rest of the Agents page is unaffected |
| No templates returned | Section renders nothing (it is supplemental) |
| Activate in flight | That row's button shows "Activating…" and is disabled |
| Idempotent re-activate (200) | Success toast says "already activated"; list/templates refresh |
| Knowledge not seeded | `knowledge_note` surfaced via an info toast; agent still usable |
| Activate fails (network/4xx/5xx) | `AGT_009` (or BE `detail`) error toast; no list change |

## 6. Out of Scope

Template authoring/editing, a Help entry point in app chrome, auto-opening a chat
with the activated agent, and any change to the conversation agent-switch UI
(reused as-is).

## 7. Open Questions

- [ ] Whether to later add a one-click "Start a chat with this assistant" shortcut
      (deferred; the existing picker covers switching today).

---

_Link to Technical Spec: [technical/agent-templates.md](../technical/agent-templates.md)_

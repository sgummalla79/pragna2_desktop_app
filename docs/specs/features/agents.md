# Feature Spec: Agents

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

The **Agents** settings page lets a user create and manage their **standalone
agents** — user-owned assistants defined by a handle, display name, description,
system prompt, a set of tools, and a status. Exactly one agent is the user's
**default** (the one chat will load once chat ships). From an agent's editor the
user can additionally **attach MCP connectors** (optionally narrowed to specific
tools) and **attach knowledge libraries**, wiring the agent to the Connectors and
Knowledge features already in the app. This is the `/settings/agents` route.

> Scope note: these are *standalone* agents (`/api/agents`). They are distinct
> from the agents inlined onto a flow's nodes in the Agent Flows editor (a
> separate, later feature). There is no model/temperature selection on a
> standalone agent — that is intentional and matches the backend contract.

## 2. Goals & Non-Goals

**Goals**
- [ ] List the user's agents, clearly marking the default.
- [ ] Create an agent (handle, display name, description, system prompt, tools, status).
- [ ] Edit an existing agent (handle is immutable after create).
- [ ] Set any active agent as the default (atomic swap — prior default is demoted).
- [ ] Archive (soft-delete) a non-default agent.
- [ ] Onboarding: when no default exists, offer a prefilled "create default agent"
      flow seeded from the backend's default-template.
- [ ] In the editor (edit mode only), attach/detach **MCP connectors** with an
      optional per-tool selection, and attach/detach **knowledge libraries**.

**Non-Goals**
- Model / temperature / sampling-parameter selection (not part of the agent contract).
- Avatar/custom-icon upload (uses the shared `EntityIcon`).
- Running/chatting with the agent (chat is a later feature).
- Flow agents (the inline agents authored in the Agent Flows editor).
- Editing the agent handle after creation.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | create an assistant with a system prompt and tools | it behaves the way I need |
| user | mark one agent as my default | chat loads it automatically (later) |
| user | attach an MCP connector to an agent and pick which tools | the agent can use only the tools I choose |
| user | attach a knowledge library to an agent | the agent can ground answers in my documents |
| user | archive an agent I no longer use | my list stays relevant |
| new user | be guided to create a sensible default agent | I can get started without a blank slate |

## 4. Acceptance Criteria

- [ ] Given I open `/settings/agents`, when agents exist, then they are listed with
      the default visibly badged.
- [ ] Given no default agent exists, when the page loads, then a "create default
      agent" affordance is shown, prefilled from `GET /api/agents/default-template`.
- [ ] Given I submit the create form with a valid kebab-case handle, when I save,
      then the agent is created and appears in the list.
- [ ] Given I enter a handle that is not kebab-case, when I try to save, then I see
      a clear validation message (`AGT_007`) and the request is not sent.
- [ ] Given a handle that already exists, when I save, then I see a duplicate-name
      message (`AGT_002`).
- [ ] Given I edit an agent, then the handle field is read-only; display name,
      description, system prompt, tools, and status are editable.
- [ ] Given I set another agent as default, then it becomes default and the previous
      default is no longer marked default, without a manual refresh.
- [ ] Given I try to archive or deactivate the default agent, then it is blocked with
      a clear message (`AGT_006`).
- [ ] Given I am editing an existing agent, when I attach a connector, then it appears
      as a binding immediately (no full-form save needed); I can narrow it to specific
      tools or leave it as "all enabled tools".
- [ ] Given I am editing an existing agent, when I attach/detach a knowledge library,
      then the binding updates immediately.
- [ ] Given I am **creating** an agent (it does not exist yet), then the connector and
      knowledge sections are disabled/hidden with a hint that they are available after
      the agent is saved.
- [ ] All screens are responsive and usable from narrow to wide widths.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| No default agent yet (`GET /agents/default` → 404) | Treated as "no default" (not an error); show create-default affordance |
| Duplicate handle (409) | Show `AGT_002` ("you already have an agent with this name") |
| Invalid handle (422) | Show `AGT_007`; client-side regex blocks before submit where possible |
| Archive/deactivate the default (400) | Show `AGT_006`; require setting another default first |
| Load agents fails | Show `AGT_001` |
| Save (create/update) fails | Show `AGT_003` |
| Set-default fails | Show `AGT_005` |
| Archive fails | Show `AGT_004` |
| Attach connector before the agent exists | Section is gated (create mode) — not possible |
| Connector/library already attached | Hidden from the attach picker (can't double-attach) |
| Detaching a connector/library | Confirm, then remove the binding; underlying connector/library is untouched |

## 6. Out of Scope

Model selection, agent execution/chat, avatars, flow agents, handle renaming, and
bulk operations. These are either later features or intentionally excluded by the
backend contract.

## 7. Open Questions

- [x] **Resolved:** The onboarding "create default agent" affordance is retained as
      helpful onboarding but enforces nothing (the web app's chat-gate is N/A — chat
      is the next feature after this).
- [x] **Resolved:** Tool entry stays a free-form chip input this round. Upgrading it
      to an autocomplete/picker sourced from `/api/tools` is tracked as
      [TD-010](../../TODO.md#td-010--agent-tool-entry-autocomplete-against-apitools).
- [ ] Model / temperature selection on standalone agents is intentionally excluded
      (not in the `/api/agents` contract). Tracked as a future enhancement:
      [TD-011](../../TODO.md#td-011--model--temperature-selection-on-standalone-agents).

---

_Link to Technical Spec: [technical/agents.md](../technical/agents.md)_

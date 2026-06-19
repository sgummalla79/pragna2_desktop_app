# Feature Spec: In-chat Agent Switcher

> **Status**: In Review
> **Author**: Suman Gummalla
> **Created**: 2026-06-18
> **Last Updated**: 2026-06-19
>
> Tracker: pragna2-tracker #147 (Desktop FE) · parent plan #144 · BE contract #145.
> Visibility rule + new-chat landing picker: BE contract #153 (single-call
> `agent_id` on `POST /conversations`).

---

## 1. Overview

Lets a user change the **active standalone agent** (Sales / Service / Marketing /
Research / …) **in the middle of an ongoing conversation**, without losing the
transcript. The conversation keeps its `thread_id`, so the full running context
carries across the switch — only the answering persona and its tools change. A
compact agent picker sits in the chat composer next to the attach-file button;
selecting an agent PATCHes the conversation's `agent_id`, and the next turn is
answered by the new agent. Each assistant turn shows a quiet "by &lt;agent&gt;"
attribution so a switched transcript stays readable on reload.

## 2. Goals & Non-Goals

**Goals**
- [ ] A picker in the chat surface shows the conversation's current active agent
      and lists the user's other `active` standalone agents.
- [ ] **The picker appears only when there is a real choice — i.e. ≥2 active
      agents.** With 0 active agents there is nothing to run; with exactly 1 there
      is nothing to switch *to*, so the control is hidden and that lone (default)
      agent is used implicitly. This rule is identical on the new-chat landing and
      inside an existing conversation.
- [ ] **The new-chat landing surface also shows the picker** (subject to the ≥2
      rule). The agent is **never unselected**: the conversation is created pinned
      to exactly the agent the picker shows — the explicit pick, or the resolved
      default when untouched — in a **single call** (`POST /conversations` carries
      `agent_id`, BE #153). Only when the user has *no* active agents is `agent_id`
      omitted so the BE seeds its own default.
- [ ] Selecting an agent switches who answers the **next** turn over the **same**
      conversation/transcript (BE PATCH `agent_id`).
- [ ] A freshly created conversation reflects the chosen agent, or — when none is
      chosen — the BE-seeded default agent (`is_default=true`).
- [ ] Per-message persona attribution: each assistant bubble shows the agent that
      produced it (`AgentBadge`), alongside the existing model badge.
- [ ] Switching is blocked while a run is in flight (consistent with the BE's
      open-episode 409).

**Non-Goals**
- Flow-bound conversations (`flow_id` set) — out of scope; a flow runs its own
  agent/model. The picker is hidden there.
- Creating / editing / archiving agents (that lives in the Agents settings area).
- Summarized / isolated context on switch — the design is **full shared
  transcript** (see #144). A summary handoff is a later optimization.
- Changing what `is_default` means or the chat default-agent gate.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | switch from my Sales agent to my Service agent mid-chat | the same conversation continues with a different persona + tools, keeping context |
| user | see which agent is currently answering | I know who I'm talking to before I send |
| user | see, after reload, which agent produced each past turn | a mixed-agent transcript stays readable |
| user | be prevented from switching while a reply is streaming | I don't hit a confusing mid-run error |

## 4. Acceptance Criteria

- [ ] Given a default-agent conversation, when I open the picker, then it shows
      the conversation's active agent selected and lists my other `active` agents.
- [ ] Given I pick a different agent, when the PATCH succeeds, then the picker
      reflects the new agent and my next message is answered by it over the same
      transcript.
- [ ] Given a brand-new conversation, when it loads, then the picker shows my
      default agent (no explicit switch needed).
- [ ] Given I have ≥2 active agents, when I open the **new-chat landing**, then the
      picker is shown (defaulting to my default agent), and picking a non-default
      agent before sending starts the conversation already pinned to it (one create
      call), so the first reply comes from that agent.
- [ ] Given I have 0 or 1 active agents, when I view either the landing or an open
      conversation, then the picker is not rendered.
- [ ] Given a run is streaming, when I look at the picker, then it is disabled.
- [ ] Given assistant turns produced by different agents, when I reload, then each
      bubble shows the correct "by &lt;agent&gt;" attribution.
- [ ] Given the conversation is flow-bound (`flowId` set), then the picker is not
      rendered.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Conversation `agentId` is `null` (legacy / pre-feature row) | Picker soft-defaults its label to the user's default agent; no crash. |
| Selected agent was archived/inactivated since the list loaded → BE 400 | Surface a clear inline/log error ("That agent is no longer available"); active agent in UI rolls back to the server truth (invalidate). |
| `agent_id` names an agent not owned → BE 404 | Surface a clear error; no state change. |
| Switch attempted mid-run | Picker disabled in UI; if somehow fired, BE 409 is surfaced and state is reconciled. |
| Only one active agent exists (the lone default) | Picker is **hidden** — nothing to switch to; that agent is used implicitly. Same on the landing and in-conversation. |
| No active agents exist | Picker is hidden (the chat gate already requires a default agent to exist before sending is enabled). |
| Landing: user picks a non-default agent, then `create` fails | The agent choice is held in landing state; the user stays on the landing and can retry (same loud-failure path as model/thinking choices). |
| Agents list still loading | Picker renders nothing until loaded (matches `ModelPicker`); composer remains usable. |
| Message has no `agentId` (older rows) | `AgentBadge` renders nothing (graceful, like `ModelBadge`). |

## 6. Out of Scope

Flow-bound conversations; agent CRUD; context summarization on switch; web-FE
parity (tracked separately at #146 — same fix likely applies, logged for hand-off).

## 7. Open Questions

- [ ] Should the badge show "by Sales · Claude Haiku 4.5" (agent + model) or just
      the agent? Initial cut: render `AgentBadge` next to the existing `ModelBadge`
      (both quiet, muted) and refine spacing in review.

---

_Link to Technical Spec: [technical/agent-switcher.md](../technical/agent-switcher.md)_

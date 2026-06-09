# Feature Spec: Chat Slash Commands (flow dispatch)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

**Slash commands** let a user invoke one of their slash-exposed **Agent Flows**
directly from the chat composer. Typing `/` at the start of a word opens a
suggestion popover of the flows the user has exposed; accepting one inserts
`/{slash-name} ` into the draft. When that turn is sent, it is dispatched to the
flow agent (`POST /api/pragna/flows/{name}`) instead of the default chat agent —
the reply streams back over the same native transport as normal chat.

This is the chat half of the **Chat ↔ Flows integration**; it builds on the
Agent Flows settings area (which authors + exposes the flows) and the core
streaming chat feature (see `chat.md`). HITL episodes (ask_user forms, flow
proposals) remain a separate, deferred piece (`TD-014`).

## 2. Goals & Non-Goals

**Goals**
- [ ] Discover the user's slash-exposed flows for the composer (`GET /api/pragna/flows`).
- [ ] Show a `/` suggestion popover (prefix filter, keyboard + pointer nav) in
      both the landing and an open conversation.
- [ ] Dispatch a `/{name} …` turn to the flow endpoint, with the default chat
      URL restored automatically after the run.
- [ ] Keep the slash prefix in the persisted user message so the history shows
      what was invoked.

**Non-Goals**
- HITL ask_user forms + flow proposals + episode resume (`TD-014`).
- A slash menu for non-flow commands (e.g. `/clear`); only flow dispatch.
- Persisting a per-conversation "active flow" — dispatch is per-turn, re-parsed
  from the message text.

## 3. User Flows

**Invoke a flow**
1. In the composer, the user types `/`. A popover lists their slash-exposed flows.
2. They filter by typing (`/res…`), move the highlight with ↑/↓, and accept with
   Enter or Tab (or click). The draft becomes `/research ` with the caret after
   the trailing space.
3. They type the rest of the prompt and send. The turn runs against the flow
   agent; the reply streams in. The next turn reverts to normal chat.

**From the landing**
- The popover works on the landing composer too. The drafted `/research …` text
  is carried into the new conversation and dispatched as its first turn.

## 4. Acceptance Criteria

- [ ] With at least one slash-exposed flow, typing `/` at a word start opens the
      popover; typing filters by prefix on the slash name (case-insensitive,
      capped at 8 items).
- [ ] ↑/↓ cycle the highlight, Enter/Tab accept, Escape dismisses; while the
      popover is open these keys do **not** submit or insert a newline.
- [ ] Accepting inserts `/{slash-name} ` and places the caret after the space.
- [ ] Sending `/{name} prompt` (name is an exposed flow) streams the reply from
      the flow agent; the user bubble shows the full text incl. the slash prefix.
- [ ] An unknown `/foo …` prefix is sent verbatim to the default chat agent (no
      dispatch, no error).
- [ ] After a flow turn, the following turn uses the default chat agent again.
- [ ] Newly exposed / renamed flows appear in the popover without a manual
      refresh (the discovery cache is invalidated by the settings mutations).
- [ ] The composer + popover remain usable from narrow → wide widths.

## 5. Gating & Edge Cases

- **No exposed flows / discovery fails:** no popover; typing `/` does nothing
      special and the text sends normally. The failure is logged (CHT_008), not
      surfaced as a blocking error.
- **Slash vs. model/thinking overrides:** a slash dispatch ignores the per-turn
      `?user_model_id` / `?thinking_enabled` overrides — a flow runs against its
      own configured model. Slash routing wins over the override URL.
- **Pasted text** like `/foo bar` (whitespace after the name) does not open the
      popover.
- **Stop / resume / 404 from the flow endpoint** behave exactly as core chat
      (Stop aborts the client stream; backend continues + persists).

## 6. UI / Theming

- Theme tokens only — popover uses `bg-popover` / `bg-accent` / `border-border`;
  the slash name is monospace, the description muted. Icons unchanged (lucide).
- The popover anchors above the composer (`relative` composer container) and
  scrolls internally past 8 items; the highlighted row scrolls into view.

## 7. Deferred Scope

HITL episodes — ask_user forms (`HITLFormCard`), flow proposals
(`FlowProposalCard`), and episode resume — remain deferred (`TD-014`).

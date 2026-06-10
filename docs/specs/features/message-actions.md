# Feature Spec: Chat Message Actions (edit / branch / regenerate / continue)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

Per-message actions on a chat turn, revealed on hover: **edit** a user message
(and re-run from there), **branch** the conversation from a user message into a
new fork, **regenerate** an assistant reply (optionally with a different model),
**continue** an assistant reply that was cut off at the model's length limit, and
**copy** an assistant reply. Edit and regenerate are built on a single
truncate-then-resend primitive; branch forks a new conversation.

This also wires the **Configuration → Chat actions** toggles (`branchEnabled`,
`regenWithModelEnabled`) that previously had no consumer (`TD-006`).

## 2. Goals & Non-Goals

**Goals**
- [ ] Edit a prior user message → truncate at it → re-send the edited text.
- [ ] Branch from a user message → fork a new conversation → re-send there.
- [ ] Regenerate an assistant reply → truncate at it → re-run the prior user turn.
- [ ] Regenerate with a different model (dropdown), for non-flow conversations.
- [ ] Continue a length-truncated last assistant reply.
- [ ] Copy an assistant reply.
- [ ] Honor the Configuration toggles: gate Branch + regenerate-with-model.

**Non-Goals**
- Editing/regenerating tool or system turns.
- Multi-message selection / bulk actions.
- A separate "edit assistant message" affordance (only user turns are editable).

## 3. User Flow

- **Hover a turn** → an action row fades in (always visible while editing).
- **User turn:** Edit (✎) opens an inline textarea (Save & submit / Cancel);
  Branch (↗, if enabled) forks and navigates to the new conversation.
- **Assistant turn:** Regenerate (↻); a chevron opens a model list (if enabled +
  models available); Copy (📋). When the *last* assistant reply ended at the
  length limit, a **Continue** button shows below it.

## 4. Acceptance Criteria

- [ ] Editing a user message truncates the conversation there and streams a fresh
      reply to the edited text.
- [ ] Branch creates a new conversation (fork) and lands on it with the
      branch-point message re-sent.
- [ ] Regenerate replaces the assistant reply by re-running the prior user turn;
      regenerate-with-model runs that turn against the chosen model (this run only).
- [ ] Continue appears only on the last assistant turn when its finish reason was
      `length`, and resumes the response.
- [ ] Copy puts the assistant text on the clipboard.
- [ ] With **Branch** off in Configuration, no Branch button; with
      **regenerate-with-model** off (or a flow conversation), no model dropdown.
- [ ] Actions are hidden until hover/focus and don't disrupt the transcript layout.

## 5. Gating & Edge Cases

- **Flow / slash conversations:** regenerate-with-model is hidden (a flow runs its
  own configured model).
- **Truncate fails:** the re-send is skipped; the error is logged, the transcript
  is unchanged.
- **No prior user turn** for an assistant message: regenerate is a no-op.
- **Mid-run:** action rows don't show on a streaming turn.

## 6. UI / Theming

- Theme tokens only. Icon-only buttons (lucide), hover-revealed via the turn's
  `group`. Inline edit reuses the shared Textarea + Button primitives.

## 7. Deferred

- Wiring the HITL `file` ask_user field to attachments; assistant-message editing.

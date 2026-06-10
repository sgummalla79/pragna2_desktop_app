# Feature Spec: HITL Episodes (human-in-the-loop forms)

> **Status**: Implemented — ask_user pause/resume (Phase A) + flow proposals (Phase B).
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

Some agent flows pause mid-run to ask the user for input — an `ask_user` step.
When that happens the run **interrupts**, the chat renders an inline **form**
built from the schema the flow emitted, and submitting it **resumes** the run.
The reply streams in live, and if the resumed run pauses again, a new form
appears. This is the chat half of HITL; it pairs with Agent Flows + slash
dispatch (a flow reached via `/slash` can pause exactly the same way).

**Phase A** covers the `ask_user` pause → form → resume loop for any flow that
interrupts. **Phase B (flow proposals)** lets the agent suggest one of the user's
flows via a `propose_flow_<api_name>` tool call, which renders an inline proposal
card; accepting it starts that flow as an episode (which may itself pause into a
form). Both are now implemented.

## 2. Goals & Non-Goals

**Goals**
- [ ] Detect when a run pauses for human input and render a form from the
      flow's `ask_user` schema.
- [ ] Support all the schema's field types: text, textarea, select, multiselect,
      number, checkbox, date, daterange. (File is unsupported — see §5.)
- [ ] Validate per-field client-side (friendly messages) before submit; the
      server re-validates.
- [ ] Resume the paused run on submit and **stream the continuation live**; a
      second pause re-shows a form.
- [ ] Re-show the form when the user reopens a conversation that's paused.
- [ ] Render a proposal card for `propose_flow_<api_name>` tool calls; accepting
      starts that flow as an episode (Phase B).

**Non-Goals**
- File-upload fields (depends on attachments, `TD-012`).
- Cancelling a paused episode from the UI (`TD-014` follow-up).

## 3. User Flows

**Pause → form → resume**
1. The user runs a flow (e.g. `/research …`, or a default-agent turn that calls
   a flow) that reaches an `ask_user` step.
2. The run pauses; an inline form appears at the bottom of the transcript with
   the flow's fields. The composer is disabled with a "complete the form" hint.
3. The user fills the form (inline validation guides them) and submits.
4. The run resumes; the reply streams in. If it pauses again, a new form appears;
   otherwise the conversation returns to normal.

**Reopen a paused conversation**
- Opening a conversation that's `awaiting_user` re-renders its pending form.

**Accept a flow proposal (Phase B)**
1. The agent suggests a flow via a `propose_flow_<api_name>` tool call; an inline
   proposal card renders (flow name + summary + description + optional context box).
2. The user clicks **Run flow** (gated until the tool args finish streaming). The
   flow starts as an episode and its run streams in — possibly pausing into a form.
3. **Skip** dismisses the suggestion.

## 4. Acceptance Criteria

- [ ] When a run pauses (`on_interrupt`), a form renders from the schema; the
      composer is disabled until it's submitted.
- [ ] Each field renders the correct control; required + min/max/pattern/options
      rules are enforced inline before submit; errors show only after a field is
      touched (or on a failed submit).
- [ ] Submitting resumes the run and streams the continuation **without a full
      reload** (no buffer-then-poll); a second `ask_user` re-shows a form.
- [ ] Number fields submit as numbers; daterange submits `{start,end}`.
- [ ] Stop cancels an in-flight resume cleanly.
- [ ] Reopening a paused conversation shows the pending form again.
- [ ] The form + composer remain usable from narrow → wide widths.

## 5. Gating & Edge Cases

- **File fields:** desktop has no attachment upload yet (`TD-012`); a `file`
  field renders a "not supported yet" hint. A *required* file field will block
  submit (correct, if blunt) until uploads land.
- **No episode id in the pause event:** the `on_interrupt` payload carries the
  form schema but not the episode id, so the app does one
  `GET …/episodes?limit=1` to resolve the id before it can resume. The schema
  renders immediately from the event; the id arrives a beat later.
- **Discovery failure:** if the open-episode lookup fails, no form renders
  (logged `HITL_001`); the user can retry by re-running.
- **Resume / start failure:** surfaced as an error banner (`HITL_002` resume,
  `HITL_003` start); the conversation stays put so the user can retry.

## 6. UI / Theming

- Theme tokens only. The form is a bordered card (`border-primary/30`,
  `bg-accent/40`) with a "needs your input" header, fields stacked, and a Submit
  button. Controls reuse the app's shadcn primitives; native inputs back the
  controls without a kit primitive (checkbox, multiselect list, date).
- Responsive: the card and composer reflow narrow → wide.

## 7. Deferred Scope

- **Episode cancel from the UI** (`TD-014` follow-up — the web app has it).
- **File-upload fields** (`TD-012` attachments).
- **Live-verification items** (need a running backend): that the resume SSE
  opens with `RUN_STARTED` (the stream parser expects the standard envelope),
  and how the user's form-submission turn is echoed in the resumed stream.

> **Note (flow proposals):** desktop sends the matched flow's **bare `api_name`**
> to the create endpoint (which looks up by `api_name`). The web app sends the
> *prefixed* tool name and so appears to 404 on accept — a web-app bug to fix; see
> `docs/web-app-parity.md` §1b.

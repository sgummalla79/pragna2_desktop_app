# Technical Spec: Chat Message Actions

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Architecture

Two backend primitives + a presentational action row, orchestrated by
`ChatSessionView`. Edit + regenerate share **truncate-then-resend**; branch forks
a new conversation; continue is a plain send of a fixed prompt.

```
hover turn → MessageActions (edit/branch | regenerate/regen-with-model/copy)
edit/regenerate → useTruncateFromMessage → POST …/messages/truncate-from {message_id}
               → onSuccess: send(text) | send(priorUserContent) | sendWithModel(...)
branch        → useBranchConversation → POST …/branch {message_id} → new conv
               → writePendingInitialMessage(fork.id,{text}) → navigate(/chat/{fork.id})
continue      → send(CONTINUE_PROMPT)   // when finishReason==='length' on last assistant
```

## 2. Conversation layer

- **`IConversationRepository` / `ConversationRepository`** — `truncateFrom(id,
  messageId)` → `POST /api/conversations/{id}/messages/truncate-from`
  `{ message_id }` (204); `branch(id, messageId)` → `POST /api/conversations/{id}/
  branch` `{ message_id }` → `ConversationResponse` (mapped). Plus `ConversationService`
  delegations.
- **`useConversationMutations`** — `useTruncateFromMessage` (invalidates
  `['conversations', id, 'messages']`) and `useBranchConversation` (invalidates the
  sidebar list).

## 3. Chat session

- **`useChatSession.sendWithModel(text, userModelId)`** — thin wrapper over
  `sendWithOverrides(text, { userModelId })` (appends `?user_model_id=` for one
  run; URL reverts on finalize). Used by regenerate-with-model.
- **`CONTINUE_PROMPT`** (`constants/chat.ts`) — the literal `'continue'` turn sent
  to resume a length-truncated reply.

## 4. UI

- **`MessageActions`** — presentational, role-discriminated. Assistant:
  Regenerate, an optional regenerate-with-model dropdown (shown iff
  `onRegenerateWithModel` + non-empty `availableModels`), Copy (clipboard, with a
  copied tick). User: Edit, Branch (gated by `showBranch`). Hidden until the
  parent `.group` is hovered/focused unless `alwaysVisible`.
- **`ChatMessage`** — new `actions: MessageActionHandlers`, `branchEnabled`,
  `availableModels`, `isLastAssistant`, `finishReason` props. User turns gain an
  inline edit mode (local `editing`/`editDraft`; Save → `actions.onEdit(id, text)`)
  and an action row; assistant turns render the action row (after the model badge)
  and, when `isLastAssistant && finishReason === 'length'`, a **Continue** button.
- **`ChatSessionView`** wires it: builds `finishReasonById` + `lastAssistantId`
  (from live messages), `availableModels` (gated by `prefs.regenWithModelEnabled`
  and `!conversation.flowId`, from `useChatModels`), `branchEnabled`
  (`prefs.branchEnabled`), and the `messageActions` handler object (truncate→send,
  branch→stash+navigate, regenerate, regenerate-with-model, continue). `finishReason`
  comes from the **persisted** log (the live AG-UI message doesn't carry it),
  refreshed when the run finalizes.

## 5. TD-006 (chat-action preferences) — now consumed

`useChatPreferences` (`pragna:chat-prefs`: `branchEnabled`, `regenWithModelEnabled`),
previously only written by Configuration, is now read by `ChatSessionView` to gate
the Branch button and the regenerate-with-model dropdown. Closes `TD-006`.

## 6. Deviations from the web app

All no-functional-impact (logged in `docs/web-app-parity.md` §4): branch handoff
stashes `{ text }` only (fork inherits flow/model server-side; desktop handoff has
no `agent` field); `sendWithModel` is a wrapper over `sendWithOverrides`;
regen-with-model gates on `!conversation.flowId` rather than the agent name;
`CONTINUE_PROMPT` is a named constant.

## 7. Deferred / notes

Assistant-message editing; wiring the HITL `file` field to attachments. Branch
semantics (which messages the fork includes) are the backend's — desktop calls the
endpoint identically to the web app.

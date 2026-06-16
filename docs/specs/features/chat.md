# Feature Spec: Chat (Phase 1 — core streaming chat)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

**Chat** is the desktop app's primary surface and the **post-login landing**. A
user types a message, the assistant streams its reply token-by-token from the
backend's default chat agent, and the conversation persists so it can be resumed
from the sidebar. This is the `/chat` route (landing) and `/chat/:id` (an open
conversation).

Phase 1 delivers **core streaming chat** only. Attachments, slash commands, HITL
forms / flow proposals, message actions (edit/branch/regenerate/continue), usage
& cost, and a dedicated chats-browser are deferred (see §7 and pragna2-tracker).

## 2. Goals & Non-Goals

**Goals**
- [ ] Land authenticated users on `/chat` with a greeting + composer.
- [ ] Send a message to the default agent and **stream** the reply live over SSE
      through the native (CORS-free) transport.
- [ ] Render assistant markdown (incl. code highlighting), inline tool-call
      badges, an extended-thinking reasoning panel, and a quiet model attribution.
- [ ] Pick the chat model (per-conversation + a first-turn landing choice) and
      toggle Anthropic extended thinking.
- [ ] Stop an in-flight response.
- [ ] Manage conversations in the sidebar: list (recent + pinned), open, rename,
      pin/unpin, delete.
- [ ] Resume a conversation (rehydrate its message history).
- [ ] Reach Settings from chat, and chat from Settings.

**Non-Goals (Phase 1)**
- File attachments + PDF viewer; slash commands + flow dispatch; HITL episodes
  (ask_user forms, flow proposals); edit / branch / regenerate / continue;
  conversation usage & cost; KaTeX math + diagram rendering.

> **All of the Phase-1 non-goals above have since shipped** — see §7.

## 3. User Flows

**First message (from landing)**
1. User lands on `/chat`, sees "Good morning, <name>" + the composer.
2. Picks a model (defaults to the first chat-eligible model) and optionally
   toggles Thinking, then types and sends.
3. The conversation is created eagerly; the app navigates to `/chat/{id}` and the
   reply streams in immediately.

**Continuing / resuming**
- Subsequent replies in an open conversation stream in place.
- Clicking a sidebar conversation opens `/chat/{id}` and rehydrates its history.

**Managing conversations**
- Hovering a sidebar row reveals pin, rename (inline), and delete (confirmed).
- Deleting the open conversation returns to the landing.

## 4. Acceptance Criteria

- [ ] An authenticated user is redirected to `/chat` after login.
- [ ] With a connected provider + a chat-eligible model + a default agent, sending
      a message streams a reply token-by-token; the model attribution shows the
      producing model; Stop halts the stream.
- [ ] When extended thinking is on and the model supports it, a collapsible
      **Reasoning** panel renders (open while streaming).
- [ ] When the agent calls a tool, a tool-call badge renders inline with its
      (streaming) args and, when available, its result.
- [ ] The sidebar lists pinned then recent conversations; rename, pin/unpin, and
      delete take effect immediately.
- [ ] Reopening a conversation shows its prior messages.
- [ ] The model picker changes the conversation's model (persisted); the thinking
      toggle persists per conversation.
- [ ] All chat surfaces remain usable from narrow → wide widths.

## 5. Gating & Edge Cases

- **No chat-eligible model OR no default agent:** the composer shows an inline
  "Connect a provider and enable a chat model to start chatting." banner linking
  to Settings → Providers, and sending is disabled. (A default agent is created in
  Settings → Agents.)
- **Eager-create failure:** the user stays on the landing with their typed text
  intact and a retry-able error; nothing is navigated or stashed.
- **Refresh mid-handoff:** the first message is stashed under the new id and
  cleared once consumed, so a refresh never replays it.
- **Stop:** aborts the client stream only; the backend run continues server-side
  and its result is visible on the next open of the conversation.
- **Empty / unknown / not-owned conversation id:** renders an empty conversation
  (the backend returns 404 for not-found and not-owned alike, mapped to empty).

## 6. UI / Theming

- Theme tokens only — no styles, fonts, or sizes imported from the web app.
- Markdown is rendered with Streamdown (structure-only classes; colors resolve
  through theme tokens), including **GFM, Shiki code highlighting, KaTeX math,
  Mermaid, and inline `sketchon` diagrams**. Assistant replies stream with a
  smooth per-character reveal + per-block fade-in (claude.ai feel). Icons are
  lucide, consistent with the rest of the app.
- Responsive: a 260px sidebar rail at `md`+, collapsing to an overlay drawer
  (hamburger, clear of the macOS traffic lights) below `md`.

## 7. Deferred Scope (later phases)

Nothing from the Phase-1 non-goals remains deferred. **Shipped since Phase 1:**
slash commands + flow dispatch (pragna2-tracker TD-013, see `slash-commands.md`), HITL `ask_user`
pause/resume **and** flow proposals (pragna2-tracker TD-014, see `hitl-episodes.md`), historical
tool-call rehydration (pragna2-tracker TD-018), **attachments + viewer** (pragna2-tracker TD-012, session
view — see `attachments.md`), **message actions** edit/branch/regenerate/
continue (pragna2-tracker TD-015, see `message-actions.md` — also wires the Configuration
chat-action toggles, pragna2-tracker TD-006), the **full markdown renderer** — KaTeX math,
Mermaid + `sketchon` diagrams, smooth-streaming reveal (pragna2-tracker TD-019), with the
**keep-Streamdown** decision recorded (pragna2-tracker TD-017); now at parity with the web app's
`MarkdownMessage` (see `chat-markdown.md`). Also **per-conversation usage + cost**
(pragna2-tracker TD-016, see `conversation-usage.md`): each sidebar row shows a quiet
running-total-cost chip (hidden at `$0`, fades on hover so the row actions take the
slot) sourced from `GET /api/conversations/{id}/usage`.

**Shipped via the 2026-06-10 chat parity round:** an **account menu** in the
sidebar footer (avatar → email + Settings + Sign out — pragna2-tracker TD-022, see
`account-menu.md`), a full-width **conversation history browser** at
`/chat/history` with search + infinite scroll + relative timestamps (pragna2-tracker TD-024,
see `conversation-history.md`), and **generated-document cards** for `create_pdf`
outputs (prominent card + open-in-viewer + download; document-tool badges
suppressed — pragna2-tracker TD-025, see `generated-documents.md`). The app-wide
light/dark/system **theme toggle** lives on the new Appearance settings page
(pragna2-tracker TD-023, see `appearance.md`).

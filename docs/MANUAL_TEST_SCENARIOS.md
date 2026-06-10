# Manual Test Scenarios (not automatable)

Companion to the automated suites (Tier 1 component-integration in
`src/**/*.test.tsx`, Tier 2 Playwright in `e2e/`). The scenarios here verify
behaviours that the automated tiers **cannot** cover — either a *visual/timing*
quality an assertion can't judge (animation smoothness), an OS-level capability
the browser tier doesn't control (keychain, system browser, OS file dialogs), or
the native Tauri seam that has no macOS WebDriver (deferred — see `docs/TODO.md`
TD-028).

Each scenario lists **why it's manual**, the **prerequisites**, the **steps**,
and the **checks**. Tick the checks; if one fails, note what you saw and report
it. When a missing primitive ships (or a driver lands), promote the scenario to
an automated spec and delete it here.

> This is the desktop-owned manual doc, mirroring the web app's
> `MANUAL_TEST_SCENARIOS.md` M-format. Run `pnpm tauri dev` for the desktop
> scenarios (M7–M9 require the packaged/native shell, not browser mode).

---

## M1 — Smooth streaming reveal (single reply)

**Why manual:** the *feel* of a steady typewriter reveal is a visual/timing
quality. The e2e suite only asserts the mechanism engaged (the streaming wrapper
appears, the Stop button shows while running); it cannot judge whether the
motion looks smooth.

**Prerequisites:** a working chat model (real provider key configured).

**Steps**
1. Open a new chat.
2. Send: `Explain how a hash map works, with a short example.`
3. Watch the assistant reply as it generates.

**Checks**
- [ ] Text appears as a **steady, continuous reveal**, not in sudden chunks.
- [ ] Each paragraph / heading / list / code block **fades in** as it starts.
- [ ] The pace reads as deliberate, not a flash.
- [ ] On finish, the full text is shown with no half-revealed line.

**Tuning reference:** `src/constants/chat.ts` / `src/constants/markdown.ts`
(streaming reveal constants) and `useSmoothStreamingText`.

---

## M2 — Reduced-motion preference is respected

**Why manual:** requires toggling an OS-level accessibility setting the browser
tier doesn't control.

**Prerequisites:** chat model configured; ability to set the OS "Reduce motion"
preference (macOS: System Settings → Accessibility → Display → Reduce motion;
Windows: Settings → Accessibility → Visual effects → Animation effects off).

**Steps**
1. Turn **Reduce motion ON** at the OS level.
2. Reload the app, open a chat, send any question.

**Checks**
- [ ] The reply still streams in (text appears progressively).
- [ ] **No fade/slide** entrance animation on the blocks.
- [ ] Reduce motion OFF → reload → send again → the fade returns.

---

## M3 — Reasoning / thinking timeline

**Why manual:** the live thinking strip is a transient, streaming-only
presentation state; its cadence and collapse animation are visual qualities. The
e2e suite only asserts a reasoning panel renders for a reasoning-capable turn.

**Prerequisites:** a reasoning-capable model + thinking enabled.

**Steps**
1. Enable thinking in the composer controls.
2. Send a prompt that benefits from reasoning (e.g. a multi-step word problem).

**Checks**
- [ ] A thinking strip appears while the model reasons, then settles.
- [ ] Reasoning content is collapsible and readable after the turn.
- [ ] The final answer renders normally below the reasoning.

---

## M4 — Generated-PDF visual fidelity

**Why manual:** the e2e suite (`scenario-19/20/21`) asserts the DocumentCard
renders, the title, the download byte-fetch, and the viewer opening — but it
cannot judge whether the rendered **PDF looks right** (layout, fonts, tables).

**Prerequisites:** chat model + a `create_pdf` run (or a seeded PDF conversation).

**Steps**
1. Ask the assistant to "create a PDF" of a short multi-section document.
2. When the document card appears, click it to open the reader, then Download.

**Checks**
- [ ] The card shows the title (no `.pdf`), "Document · PDF", and Download.
- [ ] The reader renders the PDF legibly — headings, lists, tables, code.
- [ ] Download saves a valid PDF that opens in the OS viewer.

---

## M5 — Slash-flow dispatch feel + flow proposal

**Why manual:** depends on a live flow run; the e2e covers slash discovery +
dispatch authoring, but the streamed multi-agent progress and the HITL proposal
card's live behavior are timing/visual.

**Prerequisites:** chat model + at least one slash-exposed flow.

**Steps**
1. In the composer, type `/` and pick a flow; send it a task.
2. Watch the run stream; respond to any ask_user form / flow proposal.

**Checks**
- [ ] The slash popover filters as you type and dispatches the chosen flow.
- [ ] Node/agent progress streams legibly; the run settles cleanly.
- [ ] Any HITL form / proposal card is interactable and advances the run.

---

## M6 — MCP connector live discovery + OAuth 2.1 consent

**Why manual:** registering a connector by URL does a **live discovery** call,
and OAuth opens the **system browser** (loopback) — both outside the browser
tier. The e2e covers connector management against seeded rows only.

**Prerequisites:** a reachable MCP server URL (and, for OAuth, a provider that
supports it).

**Steps**
1. Settings → Connectors → Add connector → enter a real server URL → register.
2. For an OAuth connector, click Connect → complete consent in the system
   browser → return and Refresh.

**Checks**
- [ ] Discovery lists the server's tools; they appear on the card.
- [ ] OAuth opens the **system browser** (not an in-app webview).
- [ ] After consent + Refresh, the connector shows "connected".

---

## M7 — Keychain "stay signed in" across app restart (native)

**Why manual:** desktop-only native seam — the refresh token persists in the OS
keychain (`secureStore`); browser mode (and the e2e seed-token path) never
exercises it. No macOS Tauri WebDriver (TD-028).

**Prerequisites:** a packaged/`pnpm tauri dev` build; real login.

**Steps**
1. Sign in (system-browser social or email login).
2. Fully **quit** the app, then relaunch it.

**Checks**
- [ ] On relaunch the session is restored from the keychain — no re-login.
- [ ] Sign out, quit, relaunch → you land on the login screen (token cleared).

---

## M8 — System-browser social login (loopback OAuth)

**Why manual:** desktop social login runs through the **system browser** with a
loopback redirect (RFC 8252) — a native flow the browser tier can't drive.

**Prerequisites:** a `pnpm tauri dev` build; a configured social connection.

**Steps**
1. On the login screen, choose a social provider.
2. Complete consent in the system browser; let it redirect back to the app.

**Checks**
- [ ] Consent opens in the **system browser**, not in-app.
- [ ] After consent the app receives the callback and lands authenticated.
- [ ] Cancelling in the browser returns you to login without a crash.

---

## M9 — Native window resize / responsive feel + OS file dialogs

**Why manual:** native window chrome, live resize feel, and OS file/clipboard
dialogs are outside the browser tier. (Responsive layout *correctness* down to
narrow widths is gated at commit time per CLAUDE.md; this is the native *feel*.)

**Prerequisites:** a `pnpm tauri dev` build.

**Steps**
1. Resize the window from wide → narrow and back; toggle the sidebars.
2. Trigger any OS file picker (e.g. attachment upload / flow YAML import/export)
   and the clipboard.

**Checks**
- [ ] Layout reflows smoothly with no clipping/overflow at narrow widths.
- [ ] The macOS sidebar / window chrome behaves natively.
- [ ] OS file dialog opens, the chosen file is accepted, and clipboard works.

---

> **Promotion rule:** any behavior a future spec author finds automatable (a
> runtime primitive ships, or a Tauri WebDriver lands for TD-028) should move
> from here into an automated spec, and its `M<n>` entry deleted.

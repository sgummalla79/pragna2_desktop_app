# Technical Spec: Citations report — external-open References links

> **Status**: Implemented (Tier 1)
> **Author**: Suman Gummalla
> **Created**: 2026-06-27
> **Last Updated**: 2026-06-27

---

## 1. Overview

Add a platform-layer `openExternal(url)` capability and wire it into the chat
markdown renderer so assistant `http(s)` links open in the system browser instead
of navigating the Tauri webview. The renderer overrides Streamdown's default
anchor with one whose `onClick` intercepts web links and routes them through the
platform layer; non-web hrefs are left to the existing harden text-only policy.

## 2. Architecture & Layer Placement

- **Domain**: none.
- **Application**: none.
- **Adapters / Infrastructure**:
  - New `src/infrastructure/platform/opener.ts` — the *only* place that imports
    the Tauri opener plugin, per the platform-abstraction rule. Re-exported from
    `src/infrastructure/platform/index.ts`.
  - `src/presentation/views/chat/components/MarkdownMessage.tsx` — overrides the
    `a` component to intercept clicks; logs failures via the existing logger.

No other layer changes — the backend already emits the message as a normal
assistant turn (no new event/field/endpoint).

## 3. Data Flow

```
assistant markdown ([title](url))
  -> Streamdown renders <a> via ExternalMarkdownLink
  -> onClick: isExternallyOpenableUrl(href)?
       no  -> default behaviour (left as-is; non-web hrefs were already text-only)
       yes -> preventDefault -> openExternal(href)
                -> isTauriRuntime() ? plugin-opener.openUrl(url) : window.open(url, '_blank', 'noopener,noreferrer')
```

## 4. Module & File Layout

```
src/
  infrastructure/
    platform/
      opener.ts            (new) openExternal + isExternallyOpenableUrl
      opener.test.ts       (new) transport + scheme tests
      index.ts             (edit) re-export opener
  presentation/views/chat/components/
    MarkdownMessage.tsx       (edit) ExternalMarkdownLink + `a` override
    MarkdownMessage.test.tsx  (edit) click-routing + literal [n] tests
```

## 5. Method Specifications

### `infrastructure/platform/opener`

#### `isExternallyOpenableUrl(url: string) -> boolean`

| Field | Detail |
|-------|--------|
| **Purpose** | Decide whether a URL is an absolute web URL the opener will accept. |
| **Inputs** | `url` — candidate (typically an anchor `href`). |
| **Output** | `true` iff `new URL(url).protocol` ∈ `EXTERNAL_LINK_ALLOWED_SCHEMES`. |
| **Errors** | None — malformed/relative URLs return `false` (try/catch). |
| **Side Effects** | None. |
| **Invariants** | Pure; callers use it to decide whether to intercept a click. |

#### `openExternal(url: string) -> Promise<void>`

| Field | Detail |
|-------|--------|
| **Purpose** | Open a web URL in the system browser, transport chosen by runtime. |
| **Inputs** | `url` — must satisfy `isExternallyOpenableUrl`. |
| **Output** | Resolves once the URL is handed off. |
| **Errors** | `RangeError` if `url` is not an allowed web URL (no silent no-op); re-throws underlying opener/transport errors. |
| **Side Effects** | Tauri: `@tauri-apps/plugin-opener.openUrl`. Browser: `window.open(url, '_blank', 'noopener,noreferrer')`. |
| **Invariants** | Never navigates the app webview; never opens non-web schemes. |

### `presentation/.../MarkdownMessage`

#### `ExternalMarkdownLink(props: ComponentProps<'a'>)`

| Field | Detail |
|-------|--------|
| **Purpose** | Anchor renderer that routes web-link clicks to the system browser. |
| **Inputs** | Standard anchor props (`href`, `children`, …) from Streamdown. |
| **Output** | An `<a>` preserving `href` (hover/a11y) with an intercepting `onClick`. |
| **Errors** | Opener failure → `logger.fromError` (logged, not thrown to React). |
| **Side Effects** | `event.preventDefault()` + `openExternal(href)` for web hrefs. |
| **Invariants** | Non-web hrefs fall through to default (they are text-only anyway). |

## 6. Error Handling Strategy

| Error | Layer | Propagation |
|-------|-------|------------|
| `RangeError` (non-web URL) | Infra (opener) | Thrown to caller; the renderer never calls with a non-web URL (guarded by `isExternallyOpenableUrl`). |
| Underlying opener/transport error | Infra (opener) | Re-thrown; caught in `ExternalMarkdownLink.onClick` and logged via `logger.fromError` so a failed open never crashes the message. |

## 7. Configuration & Constants

| Constant | Source | Description |
|----------|--------|-------------|
| `EXTERNAL_LINK_ALLOWED_SCHEMES` | `opener.ts` (named const) | Spec-defined `URL.protocol` values (`http:`, `https:`) — required literals, named not inlined. |

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `isExternallyOpenableUrl` table | unit | http/https accepted (case-insensitive); sandbox/file/mailto/js/relative/empty rejected. |
| `openExternal` Tauri | unit | Routes through `plugin-opener.openUrl`; propagates failures. |
| `openExternal` browser | unit | `window.open` with `noopener,noreferrer`; never touches the plugin. |
| `openExternal` non-web | unit | Throws `RangeError`, dispatches to no transport. |
| MarkdownMessage click | unit | http(s) click calls `openExternal(href)` and prevents default navigation. |
| MarkdownMessage `[1]` | unit | Inline `[1]` renders literal, no anchor, opener never called. |
| MarkdownMessage sandbox | unit | Non-web link stays text-only (existing test, unchanged). |

## 9. Dependencies & External Integrations

- Reuses existing `@tauri-apps/plugin-opener` (already a dependency; used by
  auth/connector flows). No new dependency.

## 10. Open Questions / Risks

- [ ] Manual verification against a real citations report in the Tauri webview
      (and against the Docker `nexus-kit-api`) is the remaining pre-merge step —
      the issue asks to "confirm with a real citations report."
- [ ] Web-FE gets a sibling item; in a browser, links already open in-tab, so the
      external-open concern is largely Tauri-specific (see CODE_FIXES.md note).

---

_Link to Feature Spec: [features/citations-external-links.md](../features/citations-external-links.md)_

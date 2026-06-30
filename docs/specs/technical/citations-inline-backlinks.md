# Technical Spec: Citations report — inline [n] footnote backlinks

> **Status**: Implemented (Tier 3)
> **Author**: Suman Gummalla
> **Created**: 2026-06-29
> **Last Updated**: 2026-06-29
> **Feature Spec**: [features/citations-inline-backlinks.md](../features/citations-inline-backlinks.md)

---

## 1. Architecture & Approach

Assistant markdown renders through `streamdown` in `MarkdownMessage`, which we
already extend with a rebuilt rehype chain (`rehypeSketchon`) and an anchor
component override (Tier 1 external-open). Tier 3 adds one more rehype plugin and
one branch to that anchor — no new rendering surface.

The plugin runs **after** Streamdown's `defaultRehypePlugins` (so it is past the
`rehype-harden` sanitizer and the injected anchors survive). It is purely
presentational and FE-only: it leans on the backend's deterministic numbering
(marker `n` = the n-th cited source listed under `## References`), so it needs no
new backend field.

## 2. `rehypeCitationBacklinks` (`utils/rehypeCitationBacklinks.ts`)

```ts
/** rehype transform: tag References items + turn in-text [n] into backlinks. */
export function rehypeCitationBacklinks(): (tree: Root) => void
```

Algorithm:
1. **Find the references list** — `findReferencesList(root)`: the first `ol`/`ul`
   that is the next element sibling of a heading whose text is "references"
   (case-insensitive). Returns `null` if absent → the transform no-ops.
2. **Tag items** — each `<li>` gets `id="cite-ref-<n>"` (n = 1-based order).
3. **Linkify markers** — `linkify()` walks the tree in place; for every text node
   *outside* the references list and *outside* `pre`/`code`/`a`, `splitMarkers()`
   replaces each `[n]` whose `n ∈ [1, count]` with:
   ```html
   <a class="citation-backlink" data-citation-backlink="n" href="#cite-ref-n">[n]</a>
   ```
   Out-of-range / unmatched markers are left in the text run.

Helpers: `textOf` (descendant text), `listItems` (the `<li>` children),
`backlinkAnchor`, `splitMarkers`. No external deps (manual recursion rather than
`unist-util-visit-parents`, which isn't installed).

Constants (in `constants/markdown.ts`, not inlined): `CITATION_REFERENCES_HEADING`,
`CITATION_BACKLINK_ID_PREFIX` (`cite-ref-`), `CITATION_BACKLINK_CLASS`,
`CITATION_REF_FLASH_CLASS`, `CITATION_REF_FLASH_MS` (1500).

## 3. Renderer wiring (`MarkdownMessage.tsx`)

- The plugin is appended to the rehype chain (renamed `SKETCHON_REHYPE_PLUGINS`
  → `MARKDOWN_REHYPE_PLUGINS`) after `rehypeSketchon`.
- The anchor override (`ExternalMarkdownLink` → `MarkdownAnchor`) gains a branch:

```ts
const isBacklink = typeof href === 'string'
  && href.startsWith(`#${CITATION_BACKLINK_ID_PREFIX}`);
// backlink: preventDefault + scrollToCitation(); render WITHOUT target=_blank
// else: existing external-open path (openExternal) with target=_blank
```

```ts
/** Scroll to + flash the References item, scoped to THIS message. */
function scrollToCitation(anchorEl: HTMLAnchorElement, targetId: string): void
```
Resolves the target via `anchorEl.closest('.chat-markdown').querySelector('#'+id)`
— scoping to the message wrapper so a `cite-ref-n` id shared across messages
resolves to the right one. Adds `CITATION_REF_FLASH_CLASS` and removes it after
`CITATION_REF_FLASH_MS`. No-op if the target isn't found.

## 4. Styling (`index.css`)

`.chat-markdown .citation-backlink` (no underline at rest, underline on hover,
tabular numerals) and a `citation-ref-flash` keyframe (~1.5s amber, readable in
both themes; the duration mirrors `CITATION_REF_FLASH_MS`). Suppressed under
`@media (prefers-reduced-motion: reduce)`.

## 5. Error handling

No network or platform calls; nothing to swallow. `scrollToCitation` no-ops if the
target is missing. With `BrowserRouter`, a raw `#` anchor would otherwise push a
hash entry — `preventDefault` avoids that; the backlink anchor also omits
`target=_blank` so it can't spawn a window.

## 6. Testing

- `rehypeCitationBacklinks.test.ts` — id tagging + marker→anchor conversion;
  out-of-range marker left literal; no-References no-op; code skipped; references
  list itself not linkified.
- `MarkdownMessage.test.tsx` — full report: `[n]` → `a[href="#cite-ref-n"]`,
  matching `li#cite-ref-n`; click scrolls (`scrollIntoView` stubbed) + flashes +
  no `openExternal`; References `[title](url)` still routes external; and a
  report with no References keeps `[1]` literal.
- e2e (`citations-external-links.spec.ts`, vs Docker `nexus-kit-api`) — the
  seeded report's `[1]` is a `#cite-ref-1` backlink with the matching `li` id;
  clicking it stays in-page (no external open, no route change) while References
  links keep opening externally.

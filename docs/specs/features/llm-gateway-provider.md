# Feature Spec: LLM Gateway Provider

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-12
> **Last Updated**: 2026-06-15

---

## 1. Overview

Adds a provider-agnostic **LLM Gateway** option to the Providers settings page.
A user who reaches an LLM via a gateway/proxy (the gateway holds the upstream
cloud credentials and is reached with a base URL + bearer token — e.g. the
`ANTHROPIC_BEDROCK_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` setup) can now connect it.
The existing cloud providers require native IAM/API-key credentials and cannot
express this. Unlike every other provider, a user may connect **multiple**
gateways at once, each with a distinct label.

## 2. Goals & Non-Goals

**Goals**
- [x] Capture a gateway credential as **Gateway URL + Auth Token** (no Access
      Key / Secret / Region).
- [x] Let a user register **multiple** gateways concurrently, each with a
      user-supplied **label**.
- [x] Manage each gateway's discovered models independently.
- [x] Keep every other provider's single-instance behaviour unchanged.
- [x] Drive multi-instance behaviour off a backend **capability flag**
      (`allowsMultipleRegistrations`), never a provider-name check.

**Non-Goals**
- Per-registration enable/disable from the tile (handled per-registration in
  the modal; the tile pill is single-instance only).
- Gateways that speak a non-OpenAI wire protocol (Anthropic/Bedrock-shaped) —
  backend deferred (pragna2-api tech-debt #57).
- Storing the CA certificate as a file path (path is inaccessible inside the
  Docker container; the PEM content itself is stored instead).
- Drag-and-drop upload for the CA certificate. Tauri's default
  (`dragDropEnabled: true`) makes the native window intercept OS file drops
  before the webview, so DOM drop events never fire on desktop; the control is
  click-to-select only (plus paste).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | enter my gateway's base URL + auth token | I can use models behind a gateway without IAM keys |
| user | connect several gateways, each named | I can run prod and staging gateways side by side |
| user | manage the models under each gateway | I can enable just the models I need per gateway |
| user | disconnect one gateway | I can remove it without touching the others |
| user | upload (or paste) my gateway's CA certificate | I can connect to a gateway with a self-signed or private-CA cert |
| user | disable SSL verification for a gateway | I can connect during development without a CA cert |

## 4. Acceptance Criteria

- [x] Given the LLM Gateway tile, when I open it, then I see a **Gateway URL**
      field, a masked **Auth Token** field, and a required **Label** field.
- [x] Given a label is empty, when I view the connect form, then **Connect** is
      disabled.
- [x] Given I connect a gateway, when it succeeds, then it appears in the modal
      list by its label and the tile shows "N connected".
- [x] Given two gateways, when I open the modal, then both are listed and I can
      **Manage** (model grid), **Refresh**, or **Disconnect** each independently.
- [x] Given a single-instance provider (Anthropic, etc.), when I open it, then
      the form and connected panel are exactly as before (no label, one row).
- [x] Given the gateway connect form, the optional fields (**Models Endpoint**,
      **AWS Region**, **Verify SSL certificate**, **CA Certificate**) are grouped
      into a single collapsible **Optional settings** accordion shown last,
      directly above **Connect**; the accordion is collapsed by default.
- [x] Given the Optional settings group, the **Verify SSL certificate** toggle is
      on by default and sits directly above the **CA Certificate** field; turning
      it off and connecting sends `verifySsl: false` (native boolean) in the
      credential blob.
- [x] Given the **CA Certificate** field, it offers an **Upload file | Paste**
      mode toggle: **Upload file** shows a compact **Choose file…** button
      (click-to-select, filtered to `.pem/.crt/.cer/.ca-bundle`) that reads the
      file's text into the cert value and shows the chosen file name; **Paste**
      shows a textarea for the PEM text. Both modes write the same PEM string.
- [x] Given **Verify SSL certificate** is off, the **CA Certificate** control is
      disabled with an inline note (a custom CA has no effect when TLS
      verification is skipped); it re-enables when the toggle is turned back on.
- [x] Given a CA Certificate is pasted/browsed, when the user connects, the PEM
      string is stored encrypted in the backend credential blob.
- [x] Given neither CA Certificate nor SSL toggle is changed, the credential
      blob is identical to before (no new keys — full backward compatibility).

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Duplicate label for a gateway | Backend 409 → inline "already registered / label in use" error (PRV_002) |
| Disconnect the open gateway | Return to the list view (modal stays open to manage the rest) |
| Disconnect the only gateway | List view shows the connect form again (zero registrations) |
| Gateway exposes no `/v1/models` | Backend discovery 422 → inline connect error (gateway needs the deferred adapter) |
| Unsaved model edits | Modal close stays blocked by the existing dirty-guard |
| CA cert file is binary / unreadable | `FileReader` reads as text; garbled content is sent as-is — backend rejects it at discovery time with a clear TLS error |
| Verify SSL turned off after a CA cert was already entered | The CA Certificate control is disabled, but its value persists in form state, so a connect can still send both `caCert` + `verifySsl: false`. The backend prioritises the CA cert (verifies with it). Erring toward verification is safe; see Open Questions for the proposed clear-on-disable follow-up. |
| SSL toggle off + CA cert both set (e.g. stale value) | Backend prioritises CA cert: verifies with it, ignores `verifySsl: false` |

## 6. Out of Scope

- The backend gateway provider, multi-registration schema, and pricing (shipped
  separately in pragna2-api).
- Per-registration enable/disable on the tile.

## 7. Open Questions

- [ ] Visual narrow-width pass in the running app before final merge.
- [ ] Should turning **Verify SSL certificate** off also **clear** the CA
      Certificate value (not just disable the control), so a stale cert can't be
      sent with `verifySsl: false`? Current behaviour keeps the value and relies
      on the backend's CA-cert-priority rule. Deferred — needs a product call.

---

_Link to Technical Spec: [technical/llm-gateway-provider.md](../technical/llm-gateway-provider.md)_

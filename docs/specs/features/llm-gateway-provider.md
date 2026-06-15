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

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | enter my gateway's base URL + auth token | I can use models behind a gateway without IAM keys |
| user | connect several gateways, each named | I can run prod and staging gateways side by side |
| user | manage the models under each gateway | I can enable just the models I need per gateway |
| user | disconnect one gateway | I can remove it without touching the others |
| user | paste (or browse for) my gateway's CA certificate | I can connect to a gateway with a self-signed or private-CA cert |
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
- [x] Given the gateway connect form, the **Verify SSL certificate** toggle is
      on by default; turning it off and connecting sends `verifySsl: false`
      (native boolean) in the credential blob.
- [x] Given the CA Certificate field, clicking **Browse…** opens a file picker
      filtered to `.pem/.crt/.cer/.ca-bundle`; selecting a file populates the
      textarea with its text content. The PEM text can also be pasted directly.
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
| SSL toggle off + CA cert both set | Backend prioritises CA cert: verifies with it, ignores `verifySsl: false` |

## 6. Out of Scope

- The backend gateway provider, multi-registration schema, and pricing (shipped
  separately in pragna2-api).
- Per-registration enable/disable on the tile.

## 7. Open Questions

- [ ] Visual narrow-width pass in the running app before final merge.

---

_Link to Technical Spec: [technical/llm-gateway-provider.md](../technical/llm-gateway-provider.md)_

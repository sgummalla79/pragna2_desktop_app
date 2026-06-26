# Feature Spec: LLM Gateway — Anthropic/Bedrock-shaped support

> **Status**: Implemented (backend path UNVERIFIED end-to-end — no real gateway tested)
> **Author**: Suman Gummalla
> **Created**: 2026-06-12
> **Last Updated**: 2026-06-12

---

## 1. Overview

The LLM Gateway provider lets a user connect their AI to a gateway/proxy that
fronts an upstream model provider, authenticated by a single bearer token (the
gateway — not the user — holds the upstream cloud credentials). Until now only
**OpenAI-compatible** gateways worked: discovery probes `/v1/models` and
inference uses an OpenAI client. This feature adds support for
**Anthropic/Bedrock-shaped** gateways (the literal `ANTHROPIC_BEDROCK_BASE_URL` +
`ANTHROPIC_AUTH_TOKEN` deployment, e.g. the Salesforce internal Bedrock gateway),
which speak the Bedrock invoke shape and expose no standard `/v1/models`. The
user opts into that path by filling an optional **Models Endpoint** (and optional
**AWS Region**) on the gateway connect form.

## 2. Goals & Non-Goals

**Goals**
- [x] Let a user register an Anthropic/Bedrock-shaped gateway from the existing
      LLM Gateway provider UI, with no new provider tile.
- [x] Capture an optional models-discovery endpoint and optional AWS region as
      part of the gateway form, without breaking the OpenAI-compatible flow.
- [x] Keep the credential blob minimal (`{baseUrl, authToken}`) for OpenAI
      gateways — the optional fields are added only when filled.
- [x] Discover models from the configured endpoint and drive inference (incl.
      MCP tool-calling) through the Anthropic/Bedrock client on the backend.

**Non-Goals**
- A separate provider tile for "Bedrock gateway" (it stays one `gateway`
  provider, dispatched on configuration).
- Token-level streaming for the Anthropic/Bedrock path (deferred — see backend
  tech-debt.md #57).
- Verified, production-tested behavior against a live gateway (none available).

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user with a corporate Bedrock gateway | enter my gateway URL, bearer token, and the gateway's models endpoint | I can use Claude-via-Bedrock through my company's proxy without AWS keys |
| user with an OpenAI-compatible gateway (LiteLLM) | leave the optional fields blank | my gateway keeps working exactly as before |

## 4. Acceptance Criteria

- [x] Given the LLM Gateway connect form, when I fill only Gateway URL + Auth
      Token, then the serialized credential is exactly `{baseUrl, authToken}`
      (OpenAI-compatible path preserved).
- [x] Given the form, when I additionally fill the Models Endpoint, then the
      serialized credential includes `modelsUrl` (and `awsRegion` if filled),
      which switches the backend to the Anthropic/Bedrock path.
- [x] Optional fields left blank or whitespace-only are omitted from the blob.
- [x] The two optional fields never block the Connect button.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Models Endpoint blank | OpenAI-compatible path; `/v1/models` probed as before |
| Models Endpoint filled, AWS Region blank | Anthropic/Bedrock path; backend falls back to its default region |
| Models endpoint returns an unrecognised JSON shape | Backend lenient parser extracts what it can; if zero models, registration 422s (no models discovered) |
| Gateway/token invalid | Discovery call fails → registration 422s, no rows written (unchanged behavior) |

## 6. Out of Scope

- Backend inference/discovery implementation details (owned by `nexus-kit-api`;
  see its `llm-system.md` and tech-debt.md #57).
- Streaming, and live verification against a real gateway.

## 7. Open Questions

- [ ] What exact JSON shape will a real gateway's models endpoint return? The
      parser is lenient but unverified.

---

_Link to Technical Spec: [technical/llm-gateway-anthropic-bedrock.md](../technical/llm-gateway-anthropic-bedrock.md)_

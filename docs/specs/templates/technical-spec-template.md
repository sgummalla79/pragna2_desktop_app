# Technical Spec: [Feature Name]

> **Status**: Draft | In Review | Approved | Implemented
> **Author**: [Name]
> **Created**: [YYYY-MM-DD]
> **Last Updated**: [YYYY-MM-DD]

---

## 1. Overview

_One paragraph summarising the technical approach._

## 2. Architecture & Layer Placement

Describe which Clean Architecture layer(s) are touched and why:

- **Domain**: [new entities / value objects / domain errors introduced]
- **Application**: [use cases / ports / interfaces introduced]
- **Adapters**: [concrete implementations, UI changes, external calls]

## 3. Data Flow

```
[Caller] -> [UseCase::execute(input)] -> [DomainService::method()] -> [Repository::save(entity)]
```

## 4. Module & File Layout

```
src/
  domain/
    <entity>.rs
  application/
    use_cases/
      <feature_use_case>.rs
  adapters/
    <adapter>.rs
```

## 5. Method Specifications

For every public/exported function or method introduced, fill in the table below.

### `ModuleName`

#### `method_name(param: Type) -> ReturnType`

| Field        | Detail |
|--------------|--------|
| **Purpose**  | What this method does (single responsibility) |
| **Inputs**   | `param: Type` — description |
| **Output**   | `ReturnType` — description |
| **Errors**   | Error variant — when it occurs |
| **Side Effects** | None / [describe] |
| **Invariants** | Preconditions and postconditions |

_Repeat this block for every method._

## 6. Error Handling Strategy

List error types introduced and how they propagate across layer boundaries.

| Error | Layer | Propagation |
|-------|-------|------------|
| `DomainError::NotFound` | Domain | Converted to `AppError::NotFound` at use-case boundary |

## 7. Configuration & Constants

List all values that must NOT be hard-coded and where they are sourced from.

| Constant | Source | Description |
|----------|--------|-------------|
| ...      | env / config file | ... |

## 8. Testing Plan

| Test | Type | What It Verifies |
|------|------|-----------------|
| `test_happy_path` | unit | ... |
| `test_edge_case_*` | unit | ... |

## 9. Dependencies & External Integrations

_List any new crates, external services, or infrastructure changes._

## 10. Open Questions / Risks

- [ ] ...

---

_Link to Feature Spec: [features/<feature-name>.md](../features/<feature-name>.md)_

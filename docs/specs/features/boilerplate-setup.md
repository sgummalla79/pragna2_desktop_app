# Feature Spec: Boilerplate Setup

> **Status**: Implemented
> **Author**: sgummalla
> **Created**: 2026-06-08
> **Last Updated**: 2026-06-08

---

## 1. Overview

Establish the foundational project scaffold for `pragna2_desktop_app` — a cross-platform desktop application built with Tauri 2, React, and TypeScript. This is the baseline from which all product features will be developed.

## 2. Goals & Non-Goals

**Goals**
- [x] Runnable desktop window on Windows (dev mode)
- [x] React + TypeScript frontend served via Vite with hot reload
- [x] Rust backend with Clean Architecture layer structure in place
- [x] All tooling configured (pnpm, Cargo, Tauri CLI)

**Non-Goals**
- No application features beyond the default greeting screen
- No authentication, routing, or state management setup
- No CI/CD pipeline

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| developer | run `pnpm tauri dev` | see a live desktop window with hot reload |
| developer | have a Clean Architecture skeleton | add features in the correct layer from day one |

## 4. Acceptance Criteria

- [x] `pnpm tauri dev` opens a desktop window without errors.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml` passes with 0 failures.
- [x] `src-tauri/src/domain/`, `application/`, and `adapters/` directories exist.

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Missing Rust toolchain | `cargo` command not found — install via `rustup` |
| Missing Node.js | `pnpm` command not found — install via `nvm` or nodejs.org |
| Port 1420 in use | Vite fails to start — kill the conflicting process |

## 6. Out of Scope

All product features. This spec covers infrastructure only.

---

_Link to Technical Spec: [technical/boilerplate-setup.md](../technical/boilerplate-setup.md)_

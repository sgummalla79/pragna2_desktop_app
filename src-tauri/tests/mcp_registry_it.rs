//! Integration tests for the client-delegated stdio MCP host registry
//! (`McpRegistry::discover` / `McpRegistry::call`), driven against the WI-1 mock
//! fixture (pragna2-tracker #169). These exercise the real process spawn +
//! rmcp protocol + the #124 auth-classification logic — paths that had no
//! integration coverage before.
//!
//! `McpRegistry::discover/call` take an explicit `StdioLaunchConfig`, so these
//! tests never touch the OS keychain (that path is covered separately / gated).

mod common;

use common::{launch, mock_bin};
use pragna2_desktop_app_lib::domain::mcp::{DelegatedCallOutcome, McpHostError, StdioLaunchConfig};
use pragna2_desktop_app_lib::platform::mcp_registry::McpRegistry;
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

#[tokio::test]
async fn discover_lists_all_tools_from_the_mock() {
    let tools = McpRegistry::discover(&launch("multi-tool", &[]))
        .await
        .expect("discover should succeed");
    let mut names: Vec<_> = tools.iter().map(|t| t.name.clone()).collect();
    names.sort();
    assert_eq!(names, vec!["fetch", "search", "summarize"]);
}

#[tokio::test]
async fn call_returns_a_normal_result() {
    let reg = McpRegistry::default();
    let outcome = reg
        .call(
            Uuid::new_v4(),
            &launch("normal-result", &[]),
            "search",
            json!({ "query": "x" }),
        )
        .await
        .expect("call should succeed");
    match outcome {
        DelegatedCallOutcome::Result { content } => assert!(
            content.contains("ok: 7 rows"),
            "unexpected content: {content}"
        ),
        other => panic!("expected Result, got {other:?}"),
    }
}

#[tokio::test]
async fn non_auth_error_body_is_not_misclassified_as_auth() {
    // tool-error returns isError=true with a NON-auth body — must stay a Result
    // (the #122 negative guard), never AuthRequired.
    let reg = McpRegistry::default();
    let outcome = reg
        .call(
            Uuid::new_v4(),
            &launch("tool-error", &[]),
            "search",
            json!({}),
        )
        .await
        .expect("call should succeed");
    match outcome {
        DelegatedCallOutcome::Result { content } => {
            assert!(
                content.contains("no results found"),
                "unexpected: {content}"
            )
        }
        other => panic!("expected Result for a non-auth error body, got {other:?}"),
    }
}

#[tokio::test]
async fn auth_signal_401_classifies_as_auth_required() {
    let reg = McpRegistry::default();
    let outcome = reg
        .call(
            Uuid::new_v4(),
            &launch("auth-signal-401", &[]),
            "whoami",
            json!({}),
        )
        .await
        .expect("call should succeed");
    assert!(
        matches!(outcome, DelegatedCallOutcome::AuthRequired { .. }),
        "expected AuthRequired, got {outcome:?}"
    );
}

#[tokio::test]
async fn auth_invalid_grant_classifies_as_auth_required() {
    let reg = McpRegistry::default();
    let outcome = reg
        .call(
            Uuid::new_v4(),
            &launch("auth-signal-invalid-grant", &[]),
            "whoami",
            json!({}),
        )
        .await
        .expect("call should succeed");
    assert!(matches!(outcome, DelegatedCallOutcome::AuthRequired { .. }));
}

#[tokio::test]
async fn auth_error_extracts_provider_from_error_text() {
    // The mock body carries "for provider 'gus'", so the registry's PRIMARY
    // derivation (service_from_error_text) fills service=Some("gus").
    let reg = McpRegistry::default();
    let outcome = reg
        .call(
            Uuid::new_v4(),
            &launch("auth-provider-extract", &[]),
            "gus_query",
            json!({}),
        )
        .await
        .expect("call should succeed");
    match outcome {
        DelegatedCallOutcome::AuthRequired { service, reason } => {
            assert_eq!(service.as_deref(), Some("gus"));
            assert_eq!(reason, "token_expired");
        }
        other => panic!("expected AuthRequired, got {other:?}"),
    }
}

#[tokio::test]
async fn raised_auth_error_classifies_as_auth_required() {
    // The mock RAISES a protocol error containing an auth signal — the registry's
    // Err(..) branch must classify it as AuthRequired, not a hard failure.
    let reg = McpRegistry::default();
    let outcome = reg
        .call(
            Uuid::new_v4(),
            &launch("auth-raised-error", &[]),
            "whoami",
            json!({}),
        )
        .await
        .expect("call should succeed");
    assert!(matches!(outcome, DelegatedCallOutcome::AuthRequired { .. }));
}

#[tokio::test]
async fn discover_with_a_bad_command_is_a_spawn_error() {
    let cfg = StdioLaunchConfig {
        command: "definitely-not-a-real-binary-xyz".to_string(),
        args: vec![],
        env: HashMap::new(),
    };
    let err = McpRegistry::discover(&cfg)
        .await
        .expect_err("should fail to spawn");
    assert!(
        matches!(err, McpHostError::Spawn(_)),
        "expected Spawn, got {err:?}"
    );
}

#[tokio::test]
async fn warm_service_is_reused_across_calls_on_one_connector() {
    // reauth-success: call 1 auth-fails, call 2 succeeds — proves the warm service
    // is reused (per-tool call counter advances across calls on the same id).
    let reg = McpRegistry::default();
    let id = Uuid::new_v4();
    let cfg = launch("reauth-success", &[]);

    let first = reg
        .call(id, &cfg, "gus_query", json!({}))
        .await
        .expect("call 1");
    assert!(
        matches!(first, DelegatedCallOutcome::AuthRequired { .. }),
        "call 1 should be auth"
    );

    let second = reg
        .call(id, &cfg, "gus_query", json!({}))
        .await
        .expect("call 2");
    match second {
        DelegatedCallOutcome::Result { content } => assert!(content.contains("ok: 7 rows")),
        other => panic!("call 2 should be Result, got {other:?}"),
    }
    let _ = mock_bin(); // ensure helper is linked even if other tests are filtered
}

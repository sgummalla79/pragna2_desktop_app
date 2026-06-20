//! Deterministic stdio MCP mock server (Rust, `rmcp` server role).
//!
//! TEST FIXTURE ONLY. Behavior is driven by `MOCK_MCP_SPEC` (a preset path or
//! inline JSON); see `../../spec/schema.rs` + `../../spec/presets/*.json`. Kept
//! behaviorally equivalent to the Node mock (`../node/`) via the shared presets
//! and the conformance harness.
//!
//! Modes (mirrors the Node mock):
//!   mock_mcp_server [serve]             — run the stdio MCP server.
//!   mock_mcp_server auth [--provider X] — emulate the `<command> auth …` re-auth
//!                                         subprocess; exits per the spec `auth` block.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rmcp::handler::server::ServerHandler;
use rmcp::model::{
    CallToolRequestParam, CallToolResult, Content, Implementation, ListToolsResult,
    PaginatedRequestParam, ServerCapabilities, ServerInfo, Tool,
};
use rmcp::service::{RequestContext, RoleServer};
use rmcp::{ErrorData, ServiceExt};

#[path = "../../spec/schema.rs"]
mod schema;
use schema::{auth_error_text, MockMcpSpec};

/// The spec-driven MCP server. Per-tool call counts pick the Nth response.
struct MockServer {
    spec: MockMcpSpec,
    counts: Mutex<HashMap<String, usize>>,
}

impl MockServer {
    fn new(spec: MockMcpSpec) -> Self {
        Self {
            spec,
            counts: Mutex::new(HashMap::new()),
        }
    }

    /// Next 0-based call index for a tool (increments the counter).
    fn next_index(&self, name: &str) -> usize {
        let mut counts = self.counts.lock().expect("counts mutex");
        let slot = counts.entry(name.to_string()).or_insert(0);
        let current = *slot;
        *slot += 1;
        current
    }
}

impl ServerHandler for MockServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            server_info: Implementation {
                name: self
                    .spec
                    .server_name
                    .clone()
                    .unwrap_or_else(|| "mock-mcp".to_string()),
                version: "0.1.0".to_string(),
                ..Default::default()
            },
            ..Default::default()
        }
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParam>,
        _ctx: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, ErrorData> {
        let tools = self
            .spec
            .tools
            .iter()
            .map(|t| {
                let schema = t
                    .input_schema
                    .clone()
                    .unwrap_or_else(|| serde_json::json!({ "type": "object", "properties": {} }));
                let obj = schema.as_object().cloned().unwrap_or_default();
                Tool::new(
                    t.name.clone(),
                    t.description.clone().unwrap_or_default(),
                    Arc::new(obj),
                )
            })
            .collect();
        Ok(ListToolsResult::with_all_items(tools))
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParam,
        _ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let name = request.name.as_ref();
        let Some(tool) = self.spec.tools.iter().find(|t| t.name == name) else {
            return Err(ErrorData::invalid_params(
                format!("unknown tool: {name}"),
                None,
            ));
        };
        let idx = self.next_index(name).min(tool.responses.len() - 1);
        let resp = &tool.responses[idx];

        if resp.call_delay_ms > 0 {
            tokio::time::sleep(Duration::from_millis(resp.call_delay_ms)).await;
        }

        if resp.kind == "result" {
            return Ok(CallToolResult::success(vec![Content::text(
                resp.content.clone().unwrap_or_default(),
            )]));
        }

        // error | authError
        let text = if resp.kind == "authError" {
            auth_error_text(resp)
        } else {
            resp.content.clone().unwrap_or_else(|| "error".to_string())
        };
        if resp.channel.as_deref() == Some("raisedError") {
            Err(ErrorData::internal_error(text, None))
        } else {
            Ok(CallToolResult::error(vec![Content::text(text)]))
        }
    }
}

/// Load + parse the spec from `MOCK_MCP_SPEC` (file path or inline JSON).
fn load_spec() -> MockMcpSpec {
    let raw = std::env::var("MOCK_MCP_SPEC").expect("MOCK_MCP_SPEC is required");
    // Try as a file first; fall back to treating the value as inline JSON.
    let text = std::fs::read_to_string(&raw).unwrap_or(raw);
    serde_json::from_str(&text).expect("MOCK_MCP_SPEC is not valid MockMcpSpec JSON")
}

/// Parse `--flag value` (or `--flag=value`) from argv.
fn parse_flag(args: &[String], flag: &str) -> Option<String> {
    let mut it = args.iter();
    while let Some(a) = it.next() {
        if a == flag {
            return it.next().cloned();
        }
        if let Some(v) = a.strip_prefix(&format!("{flag}=")) {
            return Some(v.to_string());
        }
    }
    None
}

/// `auth` subcommand: emulate the re-auth subprocess exit behavior, then exit.
fn run_auth(spec: &MockMcpSpec, args: &[String]) -> ! {
    let provider = parse_flag(args, "--provider");
    if let Some(required) = &spec.auth.require_provider {
        if provider.as_deref() != Some(required.as_str()) {
            eprintln!("mock-mcp auth: wrong provider '{}'", provider.unwrap_or_default());
            std::process::exit(1);
        }
    }
    std::process::exit(spec.auth.exit_code);
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let spec = load_spec();

    if argv.first().map(String::as_str) == Some("auth") {
        run_auth(&spec, &argv[1..]);
    }

    if spec.startup_delay_ms > 0 {
        tokio::time::sleep(Duration::from_millis(spec.startup_delay_ms)).await;
    }

    let service = MockServer::new(spec).serve(rmcp::transport::stdio()).await?;
    service.waiting().await?;
    Ok(())
}

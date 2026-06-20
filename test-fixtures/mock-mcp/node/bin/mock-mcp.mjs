#!/usr/bin/env node
/**
 * Deterministic stdio MCP mock server (Node, official @modelcontextprotocol/sdk).
 *
 * TEST FIXTURE ONLY — never shipped. Behavior is driven entirely by a declarative
 * spec supplied via `MOCK_MCP_SPEC` (a preset path or inline JSON); see
 * `../spec/schema.ts` and `../spec/presets/*.json`. Kept behaviorally equivalent
 * to the Rust mock (`../rust/`) via the shared presets + the conformance harness.
 *
 * Modes:
 *   mock-mcp [serve]            — run the stdio MCP server (initialize/tools/list/tools/call).
 *   mock-mcp auth [--provider X] — emulate the `<command> auth --provider <svc>` re-auth
 *                                  subprocess; exits per the spec's `auth` block.
 *
 * The shebang + `bin` entry make this usable as a SINGLE executable command, which
 * matters because the host's re-auth path runs `<command> auth …` using the launch
 * `command` only (no args) — see src-tauri/src/application/mcp_host.rs::auth.
 */
import { readFileSync } from 'node:fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { validateSpec, authErrorText } from '../../spec/schema.ts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Load + validate the spec from `MOCK_MCP_SPEC` (file path or inline JSON). */
function loadSpec() {
  const raw = process.env.MOCK_MCP_SPEC;
  if (!raw) throw new Error('MOCK_MCP_SPEC is required (preset path or inline JSON)');
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(raw, 'utf8'));
  } catch {
    parsed = JSON.parse(raw); // fall back to inline JSON
  }
  return validateSpec(parsed);
}

/** Parse `--flag value` (or `--flag=value`) from argv. */
function parseFlag(argv, flag) {
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

/** `auth` subcommand: emulate the re-auth subprocess exit behavior. */
function runAuth(spec, argv) {
  const provider = parseFlag(argv, '--provider');
  const auth = spec.auth ?? {};
  if (auth.requireProvider && provider !== auth.requireProvider) {
    process.stderr.write(`mock-mcp auth: wrong provider '${provider ?? ''}'\n`);
    process.exit(1);
  }
  process.exit(auth.exitCode ?? 0);
}

/** Pick the response for the Nth (0-based) call of a tool: last entry repeats. */
function pickResponse(tool, callIndex) {
  const i = Math.min(callIndex, tool.responses.length - 1);
  return tool.responses[i];
}

async function serve(spec) {
  if (spec.startupDelayMs) await sleep(spec.startupDelayMs);

  const server = new Server(
    { name: spec.serverName ?? 'mock-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: spec.tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
    })),
  }));

  const callCounts = new Map();

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = spec.tools.find((t) => t.name === req.params.name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `unknown tool: ${req.params.name}`);
    }
    const n = callCounts.get(tool.name) ?? 0;
    callCounts.set(tool.name, n + 1);
    const resp = pickResponse(tool, n);

    if (resp.callDelayMs) await sleep(resp.callDelayMs);

    if (resp.kind === 'result') {
      return { content: [{ type: 'text', text: resp.content ?? '' }], isError: false };
    }
    // error | authError
    const text = resp.kind === 'authError' ? authErrorText(resp) : (resp.content ?? 'error');
    if (resp.channel === 'raisedError') {
      throw new McpError(ErrorCode.InternalError, text);
    }
    return { content: [{ type: 'text', text }], isError: true };
  });

  await server.connect(new StdioServerTransport());
}

async function main() {
  const argv = process.argv.slice(2);
  const spec = loadSpec();
  if (argv[0] === 'auth') return runAuth(spec, argv.slice(1));
  return serve(spec); // default + explicit `serve`
}

main().catch((e) => {
  process.stderr.write(`mock-mcp fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
});

/**
 * Conformance normalizer — acts as an MCP CLIENT (official SDK) that spawns a
 * mock server command, runs initialize → tools/list → tools/call for each
 * conformance preset, and prints a normalized JSON snapshot of the wire behavior.
 *
 * Running it against BOTH the Node mock and the Rust mock and diffing the output
 * is the Node↔Rust behavioral-equivalence check (see `equivalence.mjs`).
 *
 * Usage:
 *   node conformance.mjs --command <cmd> [--args a,b,c]
 *   # e.g. node conformance.mjs --command ./bin/mock-mcp.mjs
 *   #      node conformance.mjs --command ../rust/target/debug/mock_mcp_server
 *
 * Delay presets (startup-delay/call-delay) are intentionally EXCLUDED — they
 * exist for the host's timeout tests (WI-2), not for wire conformance.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = dirname(fileURLToPath(import.meta.url));
const presetsDir = resolve(here, '../spec/presets');

/** Presets whose FIRST tool call has deterministic, prompt wire behavior. */
const CONFORMANCE_PRESETS = [
  'normal-result',
  'tool-error',
  'auth-signal-401',
  'auth-signal-invalid-grant',
  'auth-provider-extract',
  'auth-raised-error',
  'multi-tool',
];

function parseFlag(argv, flag) {
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

/** Run one preset against the server command; return a normalized snapshot. */
async function runPreset(command, baseArgs, preset) {
  const transport = new StdioClientTransport({
    command,
    args: baseArgs,
    env: { ...process.env, MOCK_MCP_SPEC: resolve(presetsDir, `${preset}.json`) },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'conformance', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);
  try {
    const listed = await client.listTools();
    const toolNames = listed.tools.map((t) => t.name).sort();
    const first = listed.tools[0];
    let call;
    try {
      const res = await client.callTool({ name: first.name, arguments: {} });
      const text = (res.content ?? [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');
      call = { isError: Boolean(res.isError), text };
    } catch (e) {
      // Normalize the JSON-RPC error prefix(es) so Node and Rust compare equal —
      // the Node SDK doubles the "MCP error -32603:" prefix, the Rust SDK emits it
      // once. We only care that the same core error text crosses the wire.
      const raw = e instanceof Error ? e.message : String(e);
      call = { raisedError: raw.replace(/MCP error -?\d+:\s*/g, '') };
    }
    return { preset, tools: toolNames, firstTool: first.name, call };
  } finally {
    await client.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const command = parseFlag(argv, '--command');
  if (!command) throw new Error('--command <cmd> is required');
  const argsRaw = parseFlag(argv, '--args');
  const baseArgs = argsRaw ? argsRaw.split(',').filter(Boolean) : [];

  const results = [];
  for (const preset of CONFORMANCE_PRESETS) {
    results.push(await runPreset(command, baseArgs, preset));
  }
  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
}

main().catch((e) => {
  process.stderr.write(`conformance fatal: ${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(2);
});

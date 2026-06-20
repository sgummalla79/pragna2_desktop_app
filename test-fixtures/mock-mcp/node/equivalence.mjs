/**
 * Node↔Rust behavioral-equivalence check. Runs the conformance harness against
 * BOTH the Node mock and the standalone Rust mock binary and asserts identical
 * normalized output for every conformance preset. Exits non-zero on any mismatch.
 *
 * Prereq: the Rust mock is built (`cargo build` in `../rust/`). Override its path
 * with MOCK_RUST_BIN if it lives elsewhere.
 *
 * Usage: node equivalence.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const nodeBin = resolve(here, 'bin/mock-mcp.mjs');
const rustBin =
  process.env.MOCK_RUST_BIN ?? resolve(here, '../rust/target/debug/mock_mcp_server');

function snapshot(command) {
  const out = execFileSync('node', [resolve(here, 'conformance.mjs'), '--command', command], {
    encoding: 'utf8',
  });
  return out;
}

function main() {
  if (!existsSync(rustBin)) {
    console.error(`Rust mock binary not found: ${rustBin}\nBuild it: (cd ../rust && cargo build)`);
    process.exit(3);
  }
  const nodeSnap = snapshot(nodeBin);
  const rustSnap = snapshot(rustBin);

  if (nodeSnap === rustSnap) {
    const count = JSON.parse(nodeSnap).length;
    console.log(`✔ Node↔Rust equivalence: ${count} presets produce identical wire behavior.`);
    process.exit(0);
  }

  console.error('x Node<->Rust MISMATCH:\n');
  const nodeArr = JSON.parse(nodeSnap);
  const rustArr = JSON.parse(rustSnap);
  for (let i = 0; i < Math.max(nodeArr.length, rustArr.length); i++) {
    const a = JSON.stringify(nodeArr[i]);
    const b = JSON.stringify(rustArr[i]);
    if (a !== b) {
      console.error(`preset[${i}]:\n  node: ${a}\n  rust: ${b}\n`);
    }
  }
  process.exit(1);
}

main();

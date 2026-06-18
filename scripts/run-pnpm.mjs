// Cross-platform runner for the workspace-local pnpm CLI, shared by the brand
// build scripts.
//
// Why a shell: on Windows `pnpm` resolves to `pnpm.cmd`, and `execFile(Sync)`
// cannot launch a `.cmd`/`.bat` without `shell: true` (Node blocks it since
// CVE-2024-27980). With `shell: true` the command runs through cmd.exe (Windows)
// or /bin/sh (macOS/Linux), which resolves the `.cmd` shim and the PATH. Args
// that contain whitespace are quoted so paths like `C:\Users\Jane Doe\...`
// survive on both shells.

import { execFileSync } from 'node:child_process';

/** Quote an argument that contains whitespace (paths with spaces). */
const quoteArg = (arg) => (/\s/.test(String(arg)) ? `"${arg}"` : String(arg));

/**
 * Run `pnpm <args>` synchronously, inheriting stdio. Cross-platform (Windows +
 * macOS/Linux). Throws if the command exits non-zero.
 *
 * @param {string[]} args  arguments after `pnpm` (e.g. ['exec','tauri','dev']).
 * @param {string} cwd     working directory.
 */
export function runPnpm(args, cwd) {
  execFileSync('pnpm', args.map(quoteArg), { cwd, stdio: 'inherit', shell: true });
}

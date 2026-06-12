/**
 * Platform abstraction layer — the ONLY place in the frontend that may contain
 * platform-specific code or OS-detection logic.
 *
 * Rule (see CLAUDE.md § Platform Abstraction):
 *   - All other files import `isTauriRuntime` and OS APIs from THIS module.
 *   - No other file may define its own `isTauriRuntime()` or reference
 *     platform-specific behaviour directly.
 *   - Adding a new OS or runtime variant means changing only this file.
 */

export { isTauriRuntime, isWindowsPlatform } from './runtime';
export { secureStore } from './secureStore';

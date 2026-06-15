import { describe, it, expect, afterEach } from 'vitest';
import { isTauriRuntime, isWindowsPlatform, usesWindowsChrome } from './runtime';

/**
 * Platform-predicate contract tests.
 *
 * The whole point of {@link usesWindowsChrome} is that the Windows-native chrome
 * (custom title bar + Windows sidebar/layout branches) renders ONLY on Windows
 * AND inside the Tauri runtime — so a plain browser sending a Windows UA (the
 * e2e Desktop Chrome device, or a real browser on Windows) falls through to the
 * default web chrome instead of dereferencing absent Tauri internals and
 * crashing. See docs/CODE_FIXES.md CF-011.
 *
 * Crucially this locks the invariant that the two REAL apps are unaffected by
 * the fix: both run inside Tauri, so `usesWindowsChrome()` collapses to exactly
 * `isWindowsPlatform()` there (true on Windows, false on macOS) — identical to
 * the pre-fix behaviour.
 */

const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0 Safari/537.36';
const MACOS_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0 Safari/537.36';

/** Override `navigator.userAgent` for one test (own data prop; restored in afterEach). */
function setUserAgent(ua: string): void {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

/** Simulate the Tauri runtime injecting its internals onto `window`. */
function enterTauriRuntime(): void {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
}

afterEach(() => {
  // Remove the per-test UA override so the navigator prototype default returns,
  // and clear any simulated Tauri runtime.
  delete (window.navigator as unknown as Record<string, unknown>).userAgent;
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe('isWindowsPlatform', () => {
  it('is true for a Windows user-agent (OS detection, runtime-independent)', () => {
    setUserAgent(WINDOWS_UA);
    expect(isWindowsPlatform()).toBe(true);
  });

  it('is false for a macOS user-agent', () => {
    setUserAgent(MACOS_UA);
    expect(isWindowsPlatform()).toBe(false);
  });

  it('still reports Windows by UA even without the Tauri runtime', () => {
    setUserAgent(WINDOWS_UA);
    expect(isTauriRuntime()).toBe(false);
    expect(isWindowsPlatform()).toBe(true);
  });
});

describe('usesWindowsChrome — the 4-cell OS × runtime truth table', () => {
  it('Windows UA + Tauri runtime → true (the real Windows desktop app)', () => {
    setUserAgent(WINDOWS_UA);
    enterTauriRuntime();
    expect(usesWindowsChrome()).toBe(true);
  });

  it('Windows UA + NO Tauri runtime → false (browser-fallback / e2e Desktop Chrome)', () => {
    setUserAgent(WINDOWS_UA);
    expect(usesWindowsChrome()).toBe(false);
  });

  it('macOS UA + Tauri runtime → false (the real macOS desktop app)', () => {
    setUserAgent(MACOS_UA);
    enterTauriRuntime();
    expect(usesWindowsChrome()).toBe(false);
  });

  it('macOS UA + NO Tauri runtime → false (browser-fallback on macOS)', () => {
    setUserAgent(MACOS_UA);
    expect(usesWindowsChrome()).toBe(false);
  });
});

describe('usesWindowsChrome — invariant: real apps are unchanged by the fix', () => {
  it('inside Tauri, usesWindowsChrome() equals isWindowsPlatform() on both OSes', () => {
    enterTauriRuntime();
    setUserAgent(WINDOWS_UA);
    expect(usesWindowsChrome()).toBe(isWindowsPlatform());
    setUserAgent(MACOS_UA);
    expect(usesWindowsChrome()).toBe(isWindowsPlatform());
  });
});

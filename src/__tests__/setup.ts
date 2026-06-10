/**
 * Global test setup — runs before every test file (configured via
 * `vitest.config.ts` → `setupFiles`).
 *
 * - Extends `expect` with jest-dom matchers (`toBeInTheDocument`, etc.).
 * - Polyfills `ResizeObserver` (reactflow / some primitives measure the DOM via
 *   it; jsdom doesn't implement it).
 * - Stubs `matchMedia` and `scrollIntoView`, which a few mounted components call
 *   and jsdom leaves undefined.
 * - Stubs the Pointer Capture API, which Radix primitives (DropdownMenu, Select,
 *   …) invoke on interaction; jsdom leaves these undefined.
 */
import '@testing-library/jest-dom';

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (!('IntersectionObserver' in globalThis)) {
  class IntersectionObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): [] {
      return [];
    }
  }
  globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

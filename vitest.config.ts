import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'node:path';

/**
 * Vitest config for the frontend unit suite.
 *
 * Mirrors the app's Vite resolution (the `@` alias + the `svgr` plugin, since
 * components import `*.svg?react`) so tests import modules exactly as the app
 * does. jsdom provides the DOM; `globals: true` exposes describe/it/expect.
 *
 * Coverage is **report-only** (no thresholds) — the goal is to maximise and
 * observe coverage, not to fail the build under an arbitrary bar.
 */
export default defineConfig({
  plugins: [react(), svgr()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'src-tauri/**'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/**/*.types.ts',
        'src/**/*.d.ts',
        'src/__tests__/**',
        'src/components/ui/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

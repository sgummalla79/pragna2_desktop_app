import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import path from "node:path";
import { readFileSync } from "node:fs";

// Single source of truth for the app version: the repo-root VERSION file (bumped
// before each release; sync-version.mjs propagates it to tauri.conf.json +
// Cargo.toml for the installer). Injected into the bundle as __APP_VERSION__
// (see src/vite-env.d.ts) so the version-compatibility handshake reports the
// real release, not a stale env default.
const PKG_VERSION: string = readFileSync(
  path.resolve(__dirname, "VERSION"),
  "utf-8",
).trim();

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const apiTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:8000";

// satori (bundled by @sgummalla-works/sketchon for the browser diagram renderer)
// reads `process.env.SATORI_*` / `process.env.JEST_*` without guarding, and the
// webview/browser has no `process` — so the bare access throws "process is not
// defined", crashing any chat turn that renders markdown/diagrams. Shim
// `process.env`: NODE_ENV stays correct (React's production build depends on it),
// and every other `process.env.X` resolves to a safe `undefined`, which is what
// satori's feature checks expect. App code uses `import.meta.env`, never this.
// Applied to dep pre-bundling too, since satori is a pre-bundled dep.
// See docs/CODE_FIXES.md CF-002 (the web app already carries this shim).
const processEnvShim = (mode: string): Record<string, string> => ({
  "process.env.NODE_ENV": JSON.stringify(mode),
  "process.env": "{}",
});

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => ({
  define: { ...processEnvShim(mode), __APP_VERSION__: JSON.stringify(PKG_VERSION) },
  optimizeDeps: {
    esbuildOptions: {
      define: processEnvShim(mode),
    },
  },
  plugins: [react(), tailwindcss(), svgr()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    // Mirror the source app: proxy backend (`/api`) calls so the webview
    // avoids CORS in dev. The Auth0 login path calls Auth0 directly and does
    // not go through this proxy.
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
}));

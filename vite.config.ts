import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import path from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { brandAliases, readBrandConfig } from "./branding-aliases.mjs";

// Build-time white-label overlay plugin. Three jobs, all no-ops without a
// `branding/` overlay so the default build stays byte-for-byte stock Pragna:
//   1. `virtual:brand-theme.css` — injects a git-ignored `branding/theme.css`
//      (e.g. a tweakcn export of the shadcn token blocks), imported last in
//      main.tsx so its `:root` / `.dark` overrides win by source order.
//   2. index.html `<title>` — rewritten to the resolved brand name so the
//      document/tab/window title matches APP_NAME.
//   3. favicon (browser-tab icon) — the `<link rel="icon">` href is rewritten to
//      the brand logo (inlined as a data URI) when a logo overlay exists, so the
//      tab icon matches the brand without touching the committed `public/logo.svg`.
const BRAND_THEME_VIRTUAL_ID = "virtual:brand-theme.css";
// Minimal escape for the brand name injected into the HTML <title>.
const escapeHtmlText = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const brandOverlayPlugin = (brandName: string, faviconDataUri: string | null) => {
  const resolvedId = "\0" + BRAND_THEME_VIRTUAL_ID;
  const themePath = path.resolve(__dirname, "branding/theme.css");
  return {
    name: "brand-overlay",
    resolveId(id: string) {
      return id === BRAND_THEME_VIRTUAL_ID ? resolvedId : null;
    },
    load(id: string) {
      if (id !== resolvedId) return null;
      return existsSync(themePath)
        ? readFileSync(themePath, "utf-8")
        : "/* no brand theme overlay */";
    },
    transformIndexHtml(html: string) {
      let out = html;
      // Brand name → document/tab title.
      if (brandName) {
        out = out.replace(
          /<title>[^<]*<\/title>/,
          `<title>${escapeHtmlText(brandName)}</title>`,
        );
      }
      // Brand logo → favicon (browser-tab icon), inlined as a data URI. Only the
      // `rel="icon"` link's href is rewritten; absent a logo overlay it keeps the
      // committed `public/logo.svg` default.
      if (faviconDataUri) {
        out = out.replace(
          /(<link\b[^>]*\brel="icon"[^>]*\bhref=")[^"]*(")/i,
          `$1${faviconDataUri}$2`,
        );
      }
      return out;
    },
  };
};

// Single source of truth for the app version: the repo-root VERSION file (bumped
// before each release; sync-version.mjs propagates it to tauri.conf.json +
// Cargo.toml for the installer). Injected into the bundle as __APP_VERSION__
// (see src/vite-env.d.ts) so the version-compatibility handshake reports the
// real release, not a stale env default.
const PKG_VERSION: string = readFileSync(
  path.resolve(__dirname, "VERSION"),
  "utf-8",
).trim();

const host = process.env.TAURI_DEV_HOST;
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
export default defineConfig(async ({ mode }) => {
  // Resolve build-time branding from the git-ignored `branding/` overlay. The
  // brand NAME + AGENT ANIMATION are injected as bundle constants (mirroring
  // __APP_VERSION__) so constants/api.ts reads them without env plumbing. The
  // overlay is authoritative: it wins over VITE_APP_NAME (the repo's .env ships
  // VITE_APP_NAME=Pragna as the default, which must not shadow a brander's name).
  const env = loadEnv(mode, __dirname, "");
  const brand = readBrandConfig(__dirname);
  const brandName: string =
    (brand.name ?? "").trim() || (env.VITE_APP_NAME ?? "").trim();
  // Whether a brand logo overlay exists. The self-contained OAuth loopback pages
  // keep their ORIGINAL inline mark by default and only inline the brand logo
  // when this is true, so stock (no-overlay) pages are byte-identical to before.
  const brandHasOverlayLogo = existsSync(path.resolve(__dirname, "branding/logo.svg"));
  // Raw markup of the brand logo overlay (empty when none). Injected as a build
  // constant (__BRAND_LOGO_OVERLAY_SVG__) for the self-contained OAuth pages,
  // instead of a `@brand/logo.svg?raw` import — the `?raw` query does not resolve
  // through the `@brand` regex alias in the dev server.
  const brandLogoOverlaySvg = brandHasOverlayLogo
    ? readFileSync(path.resolve(__dirname, "branding/logo.svg"), "utf-8")
    : "";
  // Brand favicon: the overlay logo inlined as an SVG data URI (base64 so any
  // characters survive the HTML attribute). Null when no logo overlay → the
  // committed public/logo.svg default tab icon is kept.
  const brandFaviconDataUri = brandHasOverlayLogo
    ? `data:image/svg+xml;base64,${Buffer.from(brandLogoOverlaySvg).toString("base64")}`
    : null;

  return {
  define: {
    ...processEnvShim(mode),
    __APP_VERSION__: JSON.stringify(PKG_VERSION),
    __BRAND_NAME__: JSON.stringify((brand.name ?? "").trim()),
    __BRAND_AGENT_ANIMATION__: JSON.stringify((brand.agentAnimation ?? "").trim()),
    __BRAND_HAS_OVERLAY_LOGO__: JSON.stringify(brandHasOverlayLogo),
    __BRAND_LOGO_OVERLAY_SVG__: JSON.stringify(brandLogoOverlaySvg),
  },
  optimizeDeps: {
    esbuildOptions: {
      define: processEnvShim(mode),
    },
  },
  plugins: [react(), tailwindcss(), svgr(), brandOverlayPlugin(brandName, brandFaviconDataUri)],

  resolve: {
    alias: [
      // `@brand/*` brand-overlay assets must precede the broad `@` alias.
      ...brandAliases(__dirname),
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
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
  };
});

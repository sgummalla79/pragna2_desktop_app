import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import path from "node:path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const apiTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:8000";

// https://vite.dev/config/
export default defineConfig(async () => ({
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

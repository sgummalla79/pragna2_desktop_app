import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
// White-label theme overlay (tweakcn export), imported AFTER index.css so its
// token overrides win by source order. Empty when no `branding/theme.css` exists.
import "virtual:brand-theme.css";
import App from "./App";
import { initTheme } from "@/presentation/store/themeStore";

// Apply the persisted theme (and wire the OS-preference listener for `system`
// mode) before the first paint so there's no light/dark flash on boot.
initTheme();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

// StrictMode is kept ON for normal dev (`pnpm dev` / `tauri dev`) and is a no-op
// in production builds. The e2e harness boots with `VITE_E2E_NO_STRICT_MODE=1`
// to disable it: StrictMode's dev-only double-invoke of effects synthetically
// unmounts the chat session on mount, whose cleanup calls `agent.abortRun()` —
// aborting and re-dispatching the first streaming turn. That makes live-chat
// e2e specs racy while testing a behaviour that never occurs in production
// (where StrictMode is off). Disabling it for e2e makes the run prod-faithful.
const Root = import.meta.env.VITE_E2E_NO_STRICT_MODE
  ? React.Fragment
  : React.StrictMode;

ReactDOM.createRoot(rootElement).render(
  <Root>
    <App />
  </Root>,
);

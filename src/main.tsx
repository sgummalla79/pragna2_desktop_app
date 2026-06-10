import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { initTheme } from "@/presentation/store/themeStore";

// Apply the persisted theme (and wire the OS-preference listener for `system`
// mode) before the first paint so there's no light/dark flash on boot.
initTheme();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

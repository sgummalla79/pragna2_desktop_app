/**
 * Branded HTML shown in the system browser once an MCP OAuth loopback redirect
 * lands. Fully self-contained (no external assets) — it renders outside the app.
 * `@fabianlars/tauri-plugin-oauth` injects its URL-capture <script> into this
 * page's <head>, so branding it does NOT interfere with capturing the auth code.
 *
 * Product-agnostic copy ("connector") — never names a specific server (CLAUDE.md
 * § No Hardcoding / the #131 product-agnostic decision). Colours mirror the
 * app's dark theme; the copper mark is the Pragna logo, inlined.
 */
export const MCP_OAUTH_LOOPBACK_SUCCESS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pragna — Connector connected</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0; display: flex; align-items: center; justify-content: center;
    background: #0b0b0c; color: #f2f3f5;
    font-family: "Open Sans", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .card {
    position: relative; width: 100%; max-width: 420px; margin: 24px;
    padding: 44px 36px 32px; text-align: center; overflow: hidden;
    background: #16181c; border: 1px solid #2a2d31; border-radius: 20px;
    box-shadow: 0 24px 70px rgba(0,0,0,.55);
  }
  .card::before {
    content: ""; position: absolute; inset: 0 0 auto 0; height: 3px;
    background: #1d9bf0;
  }
  .logo { width: 60px; height: 60px; display: block; margin: 0 auto 18px; }
  .check {
    width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
    border-radius: 999px; background: rgba(34,197,94,.15); margin-bottom: 14px;
  }
  .check svg { width: 18px; height: 18px; }
  h1 { margin: 0 0 8px; font-size: 21px; font-weight: 700; letter-spacing: -.01em; }
  p { margin: 0 auto; max-width: 300px; font-size: 14px; line-height: 1.55; color: #8b8f96; }
  .brand {
    margin-top: 24px; font-size: 11px; font-weight: 600; letter-spacing: .14em;
    text-transform: uppercase; color: #5b6066;
  }
</style>
</head>
<body>
  <div class="card">
    <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g stroke="#c97040" stroke-width="3.5">
        <polygon fill="none" stroke-linejoin="round" points="50,3 60.4,13.2 73.2,9.7 77.5,23 90.3,27.2 87,40.9 97,50 87,59.1 90.3,72.8 77.5,77 73.2,90.3 60.4,86.8 50,97 39.6,86.8 26.8,90.3 22.5,77 9.7,72.8 13,59.1 3,50 13,40.9 9.7,27.2 22.5,23 26.8,9.7 39.6,13.2"/>
        <circle cx="50" cy="50" r="33"/>
        <circle cx="50" cy="50" r="16"/>
        <circle cx="50" cy="50" r="8" fill="#c97040" fill-opacity="0.2" stroke-width="3.8"/>
      </g>
      <circle cx="50" cy="50" r="4" fill="#c97040"/>
    </svg>
    <div class="check">
      <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5"/>
      </svg>
    </div>
    <h1>Connector connected</h1>
    <p>Authorization successful. You can safely close this window and return to the app.</p>
    <div class="brand">Pragna</div>
  </div>
  <script>window.setTimeout(function(){ try { window.close(); } catch (e) {} }, 2000);</script>
</body>
</html>`;

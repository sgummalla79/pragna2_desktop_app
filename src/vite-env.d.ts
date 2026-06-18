/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

// Injected by Vite `define` from package.json — the app's own version.
declare const __APP_VERSION__: string;

// Build-time white-label values from `branding/brand.config.json`, injected by
// Vite `define` (vite.config.ts). Empty string when no overlay sets them; when
// set they take precedence over VITE_APP_NAME / VITE_AGENT_ANIMATION in-app.
declare const __BRAND_NAME__: string;
declare const __BRAND_AGENT_ANIMATION__: string;
// True only when a brand logo overlay (branding/logo.svg) exists; gates whether
// the OAuth loopback pages inline the brand logo or keep their original mark.
declare const __BRAND_HAS_OVERLAY_LOGO__: boolean;
// Raw SVG markup of the brand logo overlay (empty string when none). Injected by
// Vite so the OAuth loopback pages can inline it without a `?raw` import.
declare const __BRAND_LOGO_OVERLAY_SVG__: string;

// Build-time white-label theme overlay, supplied by `brandOverlayPlugin`
// (vite.config.ts). Resolves to `branding/theme.css` when present, else empty.
declare module 'virtual:brand-theme.css';

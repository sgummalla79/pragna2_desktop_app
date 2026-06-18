/**
 * Build-time brand assets for the self-contained loopback success pages that
 * render in the system browser (outside the app bundle, so they cannot import
 * React components or reference external files).
 */

/**
 * The original Pragna mark inlined on the loopback pages — a muted-copper,
 * simplified star. Preserved verbatim so the DEFAULT (no brand overlay) pages
 * render exactly as they did before the branding feature.
 */
const DEFAULT_LOOPBACK_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g stroke="#c97040" stroke-width="3.5">
        <polygon fill="none" stroke-linejoin="round" points="50,3 60.4,13.2 73.2,9.7 77.5,23 90.3,27.2 87,40.9 97,50 87,59.1 90.3,72.8 77.5,77 73.2,90.3 60.4,86.8 50,97 39.6,86.8 26.8,90.3 22.5,77 9.7,72.8 13,59.1 3,50 13,40.9 9.7,27.2 22.5,23 26.8,9.7 39.6,13.2"/>
        <circle cx="50" cy="50" r="33"/>
        <circle cx="50" cy="50" r="16"/>
        <circle cx="50" cy="50" r="8" fill="#c97040" fill-opacity="0.2" stroke-width="3.8"/>
      </g>
      <circle cx="50" cy="50" r="4" fill="#c97040"/>
    </svg>`;

/**
 * SVG markup inlined into the loopback pages. With a brand logo overlay
 * (`branding/logo.svg`) present, that logo is inlined; otherwise the original
 * default mark is kept, so stock (no-overlay) pages are byte-identical to before.
 */
export const BRAND_LOGO_MARKUP: string = __BRAND_HAS_OVERLAY_LOGO__
  ? __BRAND_LOGO_OVERLAY_SVG__
  : DEFAULT_LOOPBACK_LOGO;

/**
 * Minimal HTML escape for interpolating the (build-time, trusted) brand name
 * into inline HTML. Guards names containing `& < > " '` so a value like
 * `AT&T` cannot produce malformed markup.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

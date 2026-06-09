/**
 * Thin horizontal rule that separates sidebar sections.
 * Drop this between any two items in the config array.
 *
 * Uses `bg-border` (the main palette border token), NOT
 * `bg-sidebar-border`. See docs/THEME_OVERRIDES.md (#1) — many
 * TweakCN themes set sidebar-border to near-white, which reads as
 * a stark stripe in dark mode. Held constant to `border` so the
 * separator stays subtle across every palette.
 */
export function SidebarDivider() {
  return <div className="mx-2 my-1.5 h-px bg-border" />;
}

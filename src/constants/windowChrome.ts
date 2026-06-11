/**
 * Window-chrome geometry for the macOS overlay title bar + the inset, rounded
 * sidebar "boxes" (à la Claude.ai).
 *
 * The app uses `titleBarStyle: "Overlay"` + `hiddenTitle: true` (see
 * src-tauri/tauri.conf.json), so the webview fills the whole window and the
 * macOS traffic lights float over the top-left. To render each sidebar as a
 * floating rounded box inset from the window edges, the traffic lights are
 * INSET (moved in/down) so they sit inside the box's top-left "title row"
 * instead of stranded in the margin overlapping the box border.
 *
 * ⚠️ {@link TRAFFIC_LIGHT_X} / {@link TRAFFIC_LIGHT_Y} MUST stay in sync with
 * `app.windows[0].trafficLightPosition` in src-tauri/tauri.conf.json — JSON
 * cannot import this module, so the values are mirrored there with a comment
 * pointing back to this file. Change both together.
 *
 * All values are logical pixels. These are the single source of truth for the
 * chrome geometry; tune here (and the mirrored JSON for the two light values).
 */

/** Traffic-light group origin, logical px from the window's top-left.
 *  MIRROR of tauri.conf.json → app.windows[0].trafficLightPosition.
 *  Empirically, macOS positions the lights so `Y` is ~their vertical CENTER —
 *  the collapse/drawer toggle is centered on this Y (via translateY(-50%)). */
export const TRAFFIC_LIGHT_X = 22;
export const TRAFFIC_LIGHT_Y = 28;

/** Inset of each sidebar box from the window edge (left + top + bottom), px. */
export const SIDEBAR_BOX_INSET_PX = 10;

/** Gap between a sidebar box and the content area to its right, px. */
export const SIDEBAR_BOX_GAP_PX = 8;

/** Height of the title row at the top of a sidebar box occupied by the traffic
 *  lights + collapse/drawer toggle; nav content is padded below it, px. */
export const SIDEBAR_TITLE_ROW_PX = 40;

/** Chat conversation sidebar (desktop rail) width, px. Source of truth — used by
 *  ChatView's rail and to left-align the conversation title beside it. */
export const CHAT_SIDEBAR_WIDTH_PX = 260;

/** Left offset of the collapse/drawer toggle button — just right of the
 *  traffic-light group, spaced like the gap between the lights, px. */
export const TITLEBAR_TOGGLE_LEFT_PX = 86;

/** Toggle icon size. Matched to a macOS traffic-light's height so the icon's
 *  top + bottom line up with the lights (the clickable button stays larger), px. */
export const TOGGLE_ICON_PX = 14;

/** Clickable box of the collapse/drawer toggle button (matches its h-6 w-6), px. */
export const TOGGLE_BUTTON_PX = 24;

/** Gap between adjacent title-bar action buttons (collapse toggle → search).
 *  0 = the search button sits flush against the toggle's right edge, px. */
export const TITLEBAR_ACTION_GAP_PX = 0;

/** Left offset of the chat search button — immediately right of the collapse/drawer
 *  toggle, spaced by {@link TITLEBAR_ACTION_GAP_PX}, px. */
export const TITLEBAR_SEARCH_LEFT_PX =
  TITLEBAR_TOGGLE_LEFT_PX + TOGGLE_BUTTON_PX + TITLEBAR_ACTION_GAP_PX;

/** Left gap before the title-bar conversation title, after the sidebar (expanded)
 *  or the traffic lights + toggle (collapsed), px. */
export const TITLE_GAP_PX = 12;

/** Fine vertical nudge for the collapse/drawer toggle relative to the lights'
 *  center ({@link TRAFFIC_LIGHT_Y}). Positive = down. Decoupled from the lights
 *  so the toggle can be aligned on its own without moving the window controls. */
export const TITLEBAR_TOGGLE_Y_NUDGE_PX = -1.25;

/** Extra optical nudge for the fixed title-bar action icons (the search button
 *  and the mobile drawer hamburger), on top of the collapse toggle's vertical
 *  nudge. Their lucide glyphs sit a hair high inside their box, so they need ~½px
 *  more than the collapse toggle to read as centered on the lights. +down, px. */
export const TITLEBAR_ACTION_Y_NUDGE_PX = 0.5;

/** Top offset (the vertical CENTER) of the fixed title-bar action icons — the
 *  search button and the mobile drawer hamburger, which share one vertical
 *  center. Anchored to the traffic-light center ({@link TRAFFIC_LIGHT_Y}) with
 *  the shared toggle nudge ({@link TITLEBAR_TOGGLE_Y_NUDGE_PX}) plus the icons'
 *  optical nudge ({@link TITLEBAR_ACTION_Y_NUDGE_PX}). Use with
 *  `transform: translateY(-50%)` so this value is the icon's center, px. */
export const TITLEBAR_ACTION_TOP_PX =
  TRAFFIC_LIGHT_Y + TITLEBAR_TOGGLE_Y_NUDGE_PX + TITLEBAR_ACTION_Y_NUDGE_PX;

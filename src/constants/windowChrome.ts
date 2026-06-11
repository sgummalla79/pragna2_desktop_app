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

/** Left offset of the collapse/drawer toggle button — just right of the
 *  traffic-light group, spaced like the gap between the lights, px. */
export const TITLEBAR_TOGGLE_LEFT_PX = 88;

/** Toggle icon size. Matched to a macOS traffic-light's height so the icon's
 *  top + bottom line up with the lights (the clickable button stays larger), px. */
export const TOGGLE_ICON_PX = 14;

/** Fine vertical nudge for the collapse/drawer toggle relative to the lights'
 *  center ({@link TRAFFIC_LIGHT_Y}). Positive = down. Decoupled from the lights
 *  so the toggle can be aligned on its own without moving the window controls. */
export const TITLEBAR_TOGGLE_Y_NUDGE_PX = -1.25;

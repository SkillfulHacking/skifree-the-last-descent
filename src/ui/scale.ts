/**
 * Resolution factor for the menus and HUD: the layout is designed in CSS px for 1920×1080 and was
 * unscaled above it (round-3 E #3: an 11 px Location note on a 1440p screen). Above 1080p the UI
 * grows with the smaller of the two ratios (2560×1440 → 1.33, 3840×2160 → 1.6 cap), so it keeps
 * the 1080p proportions and still fits; at 1080p and below it is unchanged (×1). The player's
 * "Interface text size" multiplies on top. CSS px already include browser zoom and the OS scale.
 */
export function autoUiScale(w: number, h: number): number {
  return Math.min(1.6, Math.max(1, Math.min(w / 1920, h / 1080)));
}

/**
 * The chase's rear-view inset in CSS px (App lays it out; Hud.fitRun keeps RUN. below it). `ui` is the
 * effective UI scale (the player's size × autoUiScale). (Round 6, W-103: fitRun read the inset from the
 * DOM, where on the hand-off's first frame it still had its previous, pre-chase box.)
 */
export function rearInsetRect(W: number, ui: number): { x: number; top: number; w: number; h: number } {
  const w = Math.round(Math.min(420 * ui, W * 0.3));
  const h = Math.round(w / 2.4);
  return { x: Math.round((W - w) / 2), top: Math.round(78 * ui), w, h };
}

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

/**
 * Location (biome) labels for the menu: name, environmental difficulty and a one-line
 * description. Pure (no DOM), so the wording is unit-tested.
 */
import type { Biome } from '../world/biome';
import { capabilitiesOf } from '../world/capabilities';

/** "●●○○○" for a 1..5 rating */
export function ratingPips(level: number): string {
  const n = Math.max(1, Math.min(5, Math.round(level)));
  return '●'.repeat(n) + '○'.repeat(5 - n);
}

/** Option text in the Location selector: the location's name. */
export function locationOptionLabel(b: Biome): string {
  return b.name;
}

/** "Difficulty 1/5 · Beginner" (plain text; also used for aria/tooltips). */
export function locationRatingText(b: Biome): string {
  const r = capabilitiesOf(b).rating;
  return `Difficulty ${r.level}/5 · ${r.label}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/**
 * The note under the Location row: rating pips + label, then the description on ONE line
 * (ellipsised by CSS if it is too long; the full text is in the tooltip).
 */
export function locationNoteHtml(b: Biome): string {
  const r = capabilitiesOf(b).rating;
  return `<span class="loc-note" title="${esc(`${locationRatingText(b)} — ${b.description}`)}"><span class="loc-rating" aria-label="${esc(locationRatingText(b))}">${ratingPips(r.level)} ${esc(r.label)}</span> · ${esc(b.description)}</span>`;
}

# Whiteout Ridge — round 1 consolidation (candidate `3f7bc45`)

**Result: FAIL.** No category reached 9/10 with its owning reviewer: A 5/6, B 5/4, C 5, D 6, E 6, F 5. No reviewer raised a Critical. Each reviewer's own report is the reference; this file merges duplicates and orders the work. Defect ids continue in `../DEFECTS.md`.

| Id | Sev | Theme | Raised by | Evidence (summary) | Direction |
|---|---|---|---|---|---|
| W-038 | M (blocking) | CPU frame cost | D F-1, F F6 | The drift plume queried `heightAt` for 70 grains × ~27 drifts every frame (≈4.8 ms), even when hidden (`hazardViews.ts:158-174`) | **Fixed on the iteration branch:** heights sampled once per grain, no animation while hidden. Regression test; re-measure frames |
| W-039 | M | Storm doesn't read as a whiteout | A 1, F F4, C C-3 | Fog ceiling 0.0105: about 51% at 80 m; light only −30%/−12%; frames 05/18–22 crisp; streaks read as dots | Raise the storm fog and light drop within the visibility the game design allows; add streak/curtain contrast; keep the HUD legible |
| W-040 | M | Sky geometry artefacts | A 2 | Flat 14 km storm-wall plane with a hard bottom edge (frame 04); cloud-deck sawtooth drips (01, 05–08, 11, 19); cut-paper far ranges (09, 26) | Fade the wall's lower edge, fix the deck drips, soften the far range silhouettes |
| W-041 | M | Ridge not legible from play | A 3 | In gameplay frames the piste sits in a trough; drop, cornice and far ranges are never seen | Open sightlines on the drop side, with camera/terrain framing on the rim sections |
| W-042 | M | Victory staging | C C-1/C-2/C-4/C-5/C-6, A 4 | `rescueVictory.ts` sets no letterbox, HUD hide, victory music, fanfare or title; reveal (26) misses the station; Yeti visible before his beat; door shot faces away; flinch happens in the wide; lantern/searchlight don't glow | Use the shared victory framing; re-aim the beats; fog-hide the Yeti until 9 s; emissive lantern, visible beam; hold the reveal |
| W-043 | M | Visual/physics weather blend mismatch | A 5, C C-9 | `StormSky` follows the model's storm value while the fog follows the blended value; physics is never overridden after the cave, so the skier gets full crosswind under a clear sky; frames 16/17 show blue sky under STORM | Drive the sky from the blended value, or blend the physics the same way; recapture the storm chase |
| W-044 | M | Cave reused from Alpine | A 6, F | Frame 12 matches Alpine 07 (mouth, seams, icicles); the squall additions barely read (13–14, C C-7) | Whiteout-specific cave dressing; make the squall and roar burst read |
| W-035 | M | Weather decisions not rewarded | B F1, F F1 | Confirmed from raw data; the driver ruled out as the cause; sheltered line exists on only ~16% of the course; skid drag and headwind ignore stance | Make the costs avoidable by good play: stance-dependent headwind and skid, more sheltered options. No Yeti speed change, no wholesale weakening |
| W-045 | M | Drift hop exploit | B F2 | Drifts don't act on an airborne skier (`hazards.ts:113`): hop-every-row wins 20/24 vs 15/24 | Landing in or near a drift costs, or the mound is real terrain |
| W-046 | M | Blizzard knocks without warning | B F3, E E1 | 59–69% of knocks come from cells first seen already blowing (no caption); front/blizzard captions are dropped under the Yeti footstep caption and never retried | Caption every active cell entering range; queue or retry storm captions above footsteps |
| W-037 | M | Difficulty ladder | B F4, F F2 | Hard weather 0.65 < Normal 0.8 (`biome.ts:147`); the sim dodges every snowball, so Hard is understated; Normal ≈ Alpine Hard; Classic Normal caught at ~1.1 km | Keep difficulties distinct: Hard weather ≥ Normal; tune Normal through W-035 (avoidable costs) rather than flat weakening; gate the course matrix on outcomes |
| W-047 | M | Captions too fast; overflow | E E2 | Front caption 121 chars in 3.2 s; no wrap, clipped on 1366/1280 at 150% | Duration by length, wrapping |
| W-048 | M | Storm audio flat | E E3, F F3 | Wind bed has no weather input (`ambience.ts:191`); storm +1.1 dB; front cue not directional and shared with the blizzard | Drive the wind bed by front strength; give the front cue its own direction (wind side) |
| W-049 | M | No option to reduce whiteout | E E4 | Heavy storm 45–50% of play; no setting (`BIOMES.md:154` anticipates one) | Add a reduce-weather-effects option (visual only; physics unchanged) |
| W-050 | M | Achievements say "coming soon" | E E5, F | `achievements.ts:242`; `release.spec.ts:55` asserts the stale text | Update text and test |
| W-051 | M | Course matrix not gated | E E6 | `courses.json` records 11/18 Normal catches with no assertion | Assert outcome bands per difficulty once W-035/W-037 land |
| W-052 | m | GPU risk: ridge rocks | D F-2 | 140 × 5000-tri scans, not culled, all casting shadows, no tiering (`ridgeRocks.ts:212-221`) | Cull, limit the shadow casters, tier by quality |
| W-053 | m | Misc. perf | D F-3..F-6 | Synchronous scenery chunks; storm shaders not precompiled; six transparent layers; perf logs lack SHA/presets | As listed in REVIEW_D |
| W-054 | m | Misc. art/minor | A, B F5–F10, C, E, F | Cornice reads as a kerb; wands too thin; lamps pulse in unison (`scenery.ts:150-159` phase unused); drifts look like slabs and are drawn as continuous walls; grading jump 12–14 → 15; Relaxed knocked more than Normal; terrain step on W034-24; evidence notes overclaim; manifest SHA | Fix with the related majors; evidence notes are rewritten from what each frame shows |

## Order of work (round 2)
1. **Engine/presentation correctness:** W-038 (done, pending measurement), W-043, W-050.
2. **Readability and fairness:** W-046, W-047, W-039, W-048, W-049.
3. **Gameplay:** W-035, W-045, W-037, W-051. Measured before and after on the W-034 seeds; no Yeti speed change.
4. **Presentation:** W-042, W-040, W-041, W-044, W-052, W-054.
5. Rebuild, run the full regression, recapture (with notes written from the frames), then a fresh six-reviewer round 2 on a new frozen SHA.

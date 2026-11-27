# Whiteout Ridge, round 5: Reviewer A (Visual Art Direction & Environmental Uniqueness)

- **Reviewer:** A. I own category 1 (visual art direction) and category 2 (environmental uniqueness). Scores in other categories are low-confidence.
- **What I am:** a model reviewer judging still SwiftShader renders and source code, not a human playtester. I saw no motion and no GPU output, and heard no audio. Anything about motion (plume animation, a shading band sliding with the camera, lamp pulses) is inferred from code. Studying a still for as long as I like is far easier than glancing at it at 60–80 km/h, so "not readable in a still" is a strong negative.
- **Build:** frozen source `729e226`. The evidence manifests record `bbbef83` (`git log` shows `bbbef83` touches only the evidence harness, as CANDIDATE.md says).
- **Order of work:**
  1. Images first, before any document: every PNG in `candidate/evidence/whiteout/`, `rim_1366/`, `rim_1920/`, `a11y_low/`, `a11y_reduce_weather/` (contact sheets), and the Whiteout frames in `strip_high/` (with Alpine for comparison).
  2. Then `blind/blind_read_rim_storm.md`.
  3. Then `CANDIDATE.md`, `OWNER_DECISIONS.md`, `DEFECTS.md` (W-065, W-093, W-097), `round-4/REVIEW_A_art.md` and `round-4/CONSOLIDATED.md`, and `git diff 71c9ceb 729e226 -- src/world`.
  4. Round-4 vs round-5 comparisons on the same camera positions: side-by-side images, per-pixel luminance diffs and pixel samples (PIL, scratch in `/tmp/revA`).
  5. No browser run. Nothing in the repo modified except this file.

## Verdicts

| Owner question | Verdict |
|---|---|
| **W-065:** is the drop recognisable from the gameplay camera, in clear and in storm, with the line unmoved? | **FAIL.** In clear weather the drop is *inferred*, now with some help from lip flags and plumes. In storm it is invisible. The line is unmoved (the rim distances match round 4). |
| Does any scenery lie about traversable geometry? | **Yes, two cases.** (1) A new one: the "scoured flank" shading lands on the uphill crest-side wall ahead, not on the drop (A5-2). (2) The bright white mass at the vanishing point still reads as a solid wall across the course (A5-3). |
| Is the blizzard telegraph sheet fixed? | **The curtain code changed, but the sheet in the frames did not.** At the same camera positions the vanishing-point region differs from round 4 by a mean of 2–6 / 255. In every frame where it shows, the front is `clear`, so it was never the blizzard curtain (A5-3). |
| Does the foreground now read as distinct from Alpine? | **Partly.** It differs in palette (slate, desaturated) and has small lip dressing (flags, plumes). The composition is unchanged: a broad snow floor plus a rock-strewn slope with sparse pines on the right. Part of the new darker look is the misplaced flank shading (A5-2). |
| Is the closest approach to the lip captured? | **Clear weather only, and partly.** The rim frames sit 37–73 m from the lip (the 37–43 m ones are plausibly the closest approach). **No storm rim frame exists this round.** The tool supports storms, but only `clear` was run. In `sprint_3` the rim is still off screen (NDC x −1.08) (A5-7). |

| # | Category | Score |
|---|---|---|
| 1 | **Visual art direction** | **6** |
| 2 | **Environmental uniqueness** | **6.5** |

---

## (a) First impressions, written before any document

**`whiteout/01_clear_window`:** Overcast, cold. The snow floor rolls up to the left and over a soft hump. Beyond it is a large grey rippled plain far below, which I read as a cloud sea or a rippled lake. Thin vertical white streaks rise along the left horizon (x 100–350, y 300–390) like light shafts. A big white misty column fills the centre (x 450–800, y 200–420) and hides where the course goes. On the right is a rock-strewn slope with sparse pines. Top right: a pale sawtooth skyline card with dark inverted teeth between its points (x 1060–1366, y 60–190).

**`02`/`03`/`07`/`27`:** The same composition. In `03` a dark storm slab crosses top right; it has vertical striping at its soft left end and the pale sawtooth card cuts across it. In `27` there is a translucent glassy shard at bottom centre (x 470–640, y 680–768). The right-hand wall ahead has a darker slate band (`07` x 950–1250, y 260–350).

**`04`/`05`/`16`/`19`/`28`/`29` (storm):** Flat blue-grey. Lamps on poles and the caption carry everything. In every storm frame a large elliptical bright disc in the sky gives a faint ring (`05`, edge near x 180 and x 1200). In `28` a ghostly white angular block sits on the far-left skyline (x 35–215, y 290–350). **Nothing tells me which side is the drop.**

**`08_cornice_edge`:** An extruded slab cornice with flat vertical faces and a stepped edge (x 650–1366, y 430–600), a kerb as in round 4. A vertical fog curtain with a straight diagonal seam stands at x 430–700. Below the lip is a dark navy slope with white chunks (x 330–700, y 380–768).

**`09_valley_view`:** The deck is a rippled grey surface with dark hollows: water, not cloud. A faceted triangular seam shows in the haze (x 620–760, y 420–560). Crumpled-paper rim rubble with sharp facets runs along the bottom (x 190–1366, y 560–768).

**`11_ridge_overview`:** A trough between blade-like rock fins on the left lip and the right wall. The top of the right wall has turned dark navy compared with round 4.

**`12`–`15b` cave:** The snow lip over the cave is a free-floating white sausage with paper-triangle icicles (`12` x 285–930, y 505–565). In `15` a detached white crescent floats beside the mouth (x 400–545, y 185–225).

**`17_yeti_silhouette`:** The left hillside is warm cream (227,225,220) against the cold sky (188,202,214). It is pre-existing and identical in round 4. On Low (`a11y_low/17`) a large dark-faced drift slab fills the right (x 830–1366, y 275–450). That too is the same as round 4.

**`rim_1366/*`:** These have a blue sky with pink clouds, a different look from the overcast evidence run. In `sprint_0`/`2`/`3` the cloud sea sits beyond a soft left hump, with small pale-yellow flags and vertical plume streaks along it. The white column with a dark diagonal channel still stands at the vanishing point (`sprint_0` x 560–800, y 230–410). In `sprint_1` a dark horizontal band runs along the **right** wall ahead (x 400–800, y 290–345).

**`rim_1920/*`:** **No cloud sea is visible.** The left half is a flat milky wall (`standard_0` x 0–960, y 290–560) with vertical plume streaks hanging in it. In `standard_0` the centre has a smooth dark trapezoid face under a curling "breaking wave" (x 750–1280, y 350–550).

**`a11y_low`/`a11y_reduce_weather`:** These have the same composition at lower fidelity. Reduce Weather storms keep more horizon and slope detail than full storms, which is good. Neither shows any drop cue in storm.

**`strip_high` whiteout_00–15 vs alpine:** The hand-off reads as Whiteout: dark slate ground, cloud sea on the left, orange gap paddles, sparse trees. Alpine is bright blue-white with dense evergreen walls. In the strips the two are clearly distinct.

## (b) The blind read (`blind/blind_read_rim_storm.md`)

My impressions agree with it on every point that matters:
- **Drop:** "obvious in the clear overview shots … but only as 'the ground ends and there's a grey plain far below' … completely invisible in storm." Hazard readability 5/10.
- **Fog curtain at the vanishing point:** "looks like a flat card … unclear whether the course goes into it or whether it is a cliff" (frames 1, 4, 6, 7).
- **Plumes:** "read as light beams or sprite artefacts, not as spindrift" (1, 4, 7).
- **Basin:** "frozen sea or open water, not snow" (1, 3, 7).
- **1920:** "the left side is just milky haze where the ground ought to be, so the drop isn't readable."
- **Wands:** the reader never mentions lip flags as an edge tell. "The left pole clearly says 'don't go past here'" refers to the lamp pole in the foreground.
- **Distinctiveness:** 7/10.

The reader was not shown `03_wall_near`, so the reworked storm wall still has no blind read, as CANDIDATE.md admits.

## (c) Developer claims checked

| Claim (CANDIDATE.md / DEFECTS) | Result |
|---|---|
| "Blizzard curtains … camera-facing billboards with a far fade. **The sheet at the vanishing point is gone.**" | **False for what the player sees.** The code change is real (`hazardViews.ts`: billboards, `far` fade 70–170 m, opacity 0.28→0.2). But the sheet is unchanged in the frames. Mean absolute difference, round 4 vs round 5, same camera: `sprint_0` (560–800, 230–410) 4.9 / 255; `01` (450–800, 200–420) 5.7; `27` 2.3. In all of them the manifest front is `phase: clear`, where curtain opacity is 0. So the sheet was never the curtain. Its source is unidentified. My inference is fogged downhill terrain, from the converging dark "channel" lines, but I did not isolate it by render. |
| "The drop flank below the lip is scoured dark rock with wind streaks" | **The flank is not visible from the line, and the shading lands on the wrong side.** See A5-2. Per-pixel diffs show the darkening on the right (crest-side) wall in every gameplay frame, e.g. `07` (1100,300) went from (106,125,154) to (47,64,90). It shows on the real drop flank only in off-line `08`/`09`. |
| "Spindrift plumes rise above the lip" | **True in clear weather.** Plumes are visible along the lip in `01`, `02`, `03`, `07`, `27`, `rim_1366` 0/2/3 and `rim_1920` 1. They read as vertical light shafts, not as snow streaming off an edge (A5-5). None is visible in any storm frame. |
| "Rim wands every 24 m, 1.5 m in from the lip, 3.4 m tall … ~38 px tall at 55 m" | **Partly true.** They are visible in clear weather as small pale-yellow flag tops peeking over the convex lip (`27` around (255,353); `rim_1366/2` around (183,330), (277,350); `rim_1920/1` around (270,555), (553,543)). Only the flag and the top of the pole clear the bank, at about 8–15 px, not 38 px. The flag renders pale yellow (≈ 237,212,171), not fluorescent orange. **In storm they wash out to white specks:** `28` peak (228,232,232) against sky (188,203,214), with no hue, found only after contrast stretching. |
| Storm wall: billowing top, soft foot and ends, darker base | **Foot and ends: yes.** The underside no longer cuts a hard line in `03`. **Billowing top:** not visible in any frame, because the top is off frame or under the HUD. New: vertical striping at the soft left end (`03` x 990–1040, y 90–230). The pale sawtooth range card still sits in front and cuts teeth into it (`01` x 1060–1366, y 60–190). |
| Rimed rock; rim rocks on a fixed decimated mesh | **The rime reads as stipple, and the decimation has blunted the tors** (A5-6). |
| A4-4 (darker floor at line distances) | **Largely fixed.** Deck in `01` (300,330): round 4 (120,133,148) → (86,97,110), now darker than the shaded piste (113,135,164). Deck luminance p5 130 → 97. Side effect: the dark hollows between bright billows now read as ripples on water (A5-4). |
| "Racing line: unchanged; W-056 holds" | **Consistent with the frames.** Camera positions and rim distances in `27`/`28` match round 4 to within a metre. |
| `05_storm` note: "trail-marker lamps and rim wands the way through" | **Overclaim.** No wand is visible in `05`, even after contrast stretching. |
| `whiteout_victory/` (victory beats captured with `LENIENT=1`) | **Absent** from `candidate/evidence/`. Passed to C/E. |

---

## (d) W-065 verdict: FAIL

| Check | Round 4 | Round 5 |
|---|---|---|
| Clear: an edge drawn where the line sees it | none | pale flag tops and plume streaks along the lip in 7 of 10 clear gameplay frames. No lip silhouette, no flank face, no dark gulf next to the lip. |
| Clear: drop "inferred" vs "recognised" | inferred | inferred (blind: "the ground ends and there's a grey plain far below"). At 1920 the cloud sea is replaced by a white wall, so even the inference fails. |
| Storm: any edge cue | 0 of 5 | **0 of 4** (`05`, `16`, `28`, `29`). Wands are white specks without hue, and no plume shows. |
| Closest approach in storm | 4 frames (not closest) | **none captured** |

There is real progress in clear weather: things now stand on the lip. But nothing makes the lip read as an *edge* at a glance. The "dark band falling away" that the developer designed is painted on the opposite wall (A5-2). In storm, the location's signature weather, there is still nothing.

## (e) W-093 verdict: PARTIAL (not closed)

- **Done:**
  - Palette and deck separate Whiteout from Alpine and Fjord in every strip and gameplay frame.
  - Lip flags and plumes are Whiteout-only foreground objects.
  - The storm front is the strongest sky element of the three locations.
- **Not done:**
  - The foreground composition is unchanged.
  - The spires still read as fins, and are now blunter (A5-6).
  - The vanishing-point sheet is still the most eye-catching element of every clear frame (A5-3).
  - The pale sawtooth card is unchanged (A4-6 persists).
  - The deck now reads as water (A5-4).

---

## (f) Findings

### A5-1. MAJOR (W-065, open): the drop is inferred in clear weather and invisible in storm
- **Evidence:**
  - Section (d).
  - Blind read: hazard readability 5/10, "completely invisible in storm (5, 28, 10)".
  - `28_play_rim_storm` crop x 0–683, y 250–450 after contrast stretch: wand flags appear only as (228,232,232) specks against the (188,203,214) sky. At normal contrast they are not distinguishable.
  - No plumes in any storm frame.
  - `rim_1920/*`: no deck is visible, only a milky wall on the left.
- **Player impact:**
  - The ridge's defining promise reads as "high up" in clear weather.
  - In storm, when the wind pushes the skier toward the drop, the picture gives no warning. Only the caption does.
- **Acceptance:**
  - Storm rim frames at each course's closest approach (Sprint and Standard).
  - In each, an edge tell with measured local contrast at least 2× the round-5 value (Δluma ≥ 50 against its background) and a hue distinct from the lamps.
  - A fresh blind reader names the drop side in at least 3 of 4 storm frames and in every clear frame, including 1920×1080.

### A5-2. MAJOR (new; scenery lies): the "scoured flank" shading paints the uphill crest-side wall, not the drop, and is tied to the camera's height
- **Evidence:**
  - Code: `snowMaterial.ts` (new block, about line 396). `fBelow = cameraPosition.y - vWPos.y`. Any ground with `1 − n.y` between 0.16 and 0.26 (about 33–42°, not the "16–26°" in DEFECTS) that lies 6–22 m below the *camera* turns dark rock. The rule has no drop-side or rim mask.
  - Frames: per-pixel round-4 vs round-5 diffs at identical cameras (`/tmp/revA/diff.png`). The darkening falls on the right-hand wall ahead in `01`, `02`, `03`, `06`, `07`, `27` and `rim_1366` 0/1/2/3, and on the drop flank only in off-line `08`/`09`.

    | Frame (x,y) | Round 4 | Round 5 |
    |---|---|---|
    | `07` (1100,300) | (106,125,154) | (47,64,90) |
    | `27` (1000,300) | (125,145,171) | (68,89,115) |
    | `rim_1366/sprint_0` (1100,300) | (131,152,179) | (82,103,129) |
    | `rim_1366/sprint_1` (600,330) | (117,136,161) | (72,91,117) |

  - In `sprint_1` the result is a dark horizontal cliff band along the foot of the far wall (x 400–800, y 290–345).
- **Player impact:**
  - It shows a bare-rock cliff band on continuous snow slope on the *uphill* side, so the "dark band falling away" cue points to the wrong side of the course.
  - Because the band is defined relative to the camera's height, I infer (from code, not motion) that it slides down the wall as the skier descends.
- **Acceptance:**
  - Mask the effect to the drop side beyond the rim (e.g. `(x − rimX)·side > 0`), and key it to depth below the lip in world space, not to the camera.
  - A round-4/round-5-style diff at the same cameras shows no change on the crest-side wall.
  - A unit test asserts no scouring on the crest side of a known stretch.

### A5-3. MAJOR (A4-3 persists; claim not met): the bright white sheet at the vanishing point is unchanged and was never the blizzard curtain
- **Evidence:**
  - `rim_1366/classic_sprint_0_clear` x 560–800, y 230–410, still with the dark diagonal channel at x ≈ 620–700.
  - Also in `01`, `02`, `03`, `06`, `07`, `27`, `rim_1366/2`, `rim_1366/3`, and as the "breaking wave" in `rim_1920/standard_0` (x 750–1280, y 350–550).
  - Mean absolute difference vs round 4 at the same cameras: 2.3–5.7 / 255.
  - Every one of these frames has front `phase: clear`, where the curtain's opacity is 0.
  - Blind read: "looks like a flat card", "looks solid, like a cliff of white", "unclear whether the course goes into it or whether it is a cliff".
- **Player impact:** it is the first thing the eye lands on, it hides the course direction, and it reads as a wall across the line.
- **Acceptance:**
  - Identify the source by render isolation (toggle cloud sea, sky wall, curtains, terrain fog in turn) and record the result.
  - Then fix it so a fresh blind reader no longer describes a wall, card or cliff at the vanishing point in any clear frame.

### A5-4. minor (new side effect of the A4-4 fix): the cloud deck now reads as rippled water
- **Evidence:**
  - `09_valley_view` (the whole deck).
  - `01` x 0–650, y 240–380: dark hollows (86,97,110) between bright billows in a regular wave pattern.
  - Blind read: "frozen sea or open water, not snow" in frames 1, 3 and 7.
  - Round 4 (my blind word then was "cloud sea") was smoother.
- **Acceptance:**
  - Break up the regular ripple: larger-scale billow masses, softer and less periodic hollows, and the floor seen through gaps rather than as troughs.
  - A blind reader says "cloud" or "valley under cloud" first.

### A5-5. minor (new): the spindrift plumes read as vertical light shafts
- **Evidence:**
  - `01` x 100–350, y 300–390.
  - `27` x 250–560, y 290–370.
  - `rim_1920/standard_1` x 250–700, y 330–570, where they hang in a white void with no deck behind them.
  - Blind read: "light beams or sprite artefacts".
  - The shader leans the plume only `0.35·y²` in UV and rises straight up. The silhouette is a vertical column with a bright foot below the lip line.
- **Acceptance:** plumes stream sideways off the lip downwind (lean of at least 30°), are densest at the lip and attached to it visibly, and are not described as beams or artefacts in a blind read.

### A5-6. minor (new): decimated rim rocks have lost their silhouettes; rime renders as stipple
- **Evidence:** crops of `rim_1366/classic_sprint_2_clear` x 130–450, y 250–360, round 4 vs round 5:
  - the round-4 multi-blade tor is now a rounded lump;
  - its left silhouette (around x 180–205, y 300–340) and the far tor (around x 350–395, y 300–325) carry a white dotted fringe, which reads as noise, not as feathered rime.
  - `09` bottom band: faceted crumpled-paper forms.
- **Acceptance:** on High, decimate the rim tors and spires near the line with a grid that keeps blade silhouettes, and make the rime coherent at 1366×768 (no isolated dither speckle at silhouettes).

### A5-7. minor (W-097 / A4-8 partly met): closest-approach evidence covers clear weather only
- **Evidence:**
  - `rim_1366/manifest.json` and `rim_1920/manifest.json`: all frames `weather: clear`.
  - `tools/rim_view.mjs:56` defaults to `WX=clear,storm`, so the storm pass was turned off.
  - Rim distances: 43, 57, 63, 73 m (Sprint) and 38, 37 m (Standard).
  - `sprint_3`: rim NDC x −1.08 (off screen). `sprint_1`: −0.88.
- **Acceptance:** clear *and* storm frames at each course's minimum rim distance, each with the rim projected within |NDC x| < 0.8, recorded in the manifest.

### A5-8. minor (persisting A4-6 and W-004): the sawtooth range card sits in front of the storm wall
- **Evidence:** `01` x 1060–1366, y 60–190: dark inverted teeth where the wall shows between the card's points. `03` x 860–1000, y 90–230: the card's teeth cut the wall. `03` x 990–1040: vertical striping in the wall's soft end.
- **Acceptance:** draw the wall in front of the ranges, or soften and aerial-shade the card, with no flat sawtooth crest line in any frame.

### A5-9. minor (persisting): kerb cornice and primitive cave dressing
- **Evidence:**
  - `08` x 650–1366, y 430–600: a flat-faced stepped slab.
  - `12` x 285–930, y 505–565: a floating snow sausage with paper-triangle icicles.
  - `15_cave_setup` x 400–545, y 185–225: a detached floating crescent.
- **Acceptance:** as A4-7. The cave lip is attached to the rock with no free-floating shapes.

### A5-10. minor (pre-existing, not noted before): colour and fog artefacts
- **Evidence:**
  - `17_yeti_silhouette` (high): the left hillside is warm cream (227,225,220) in a cold scene. It is identical in round 4.
  - Every storm frame shows a large elliptical bright disc in the sky. In `05` the row 250 luminance ramps from 182 to 201 and then goes flat at x ≈ 180, which gives a visible ring (a Mach band). The same disc is in round 4.
  - Low preset `a11y_low/17` x 830–1366, y 275–450: a dark-faced drift slab (W-054 "drifts look like slabs").
- **Acceptance:** cold-balanced fog on lit slopes; the storm disc blended with no visible ring edge.

### A5-11. minor (documentation)
- DEFECTS W-065 says the scoured flank is on "16–26° slopes". The code's `1 − n.y` 0.16–0.26 means about 33–42°.
- The `05_storm` note claims rim wands are visible.
- CANDIDATE.md lists `whiteout_victory/`, which is not in `candidate/evidence/`.
- **Acceptance:** correct all three.

### A5-12. POSITIVE
- Wand flags now clear the lip in clear weather (A4-2 partly met).
- The deck floor is darker than the shaded piste at line distances (A4-4 largely met).
- The storm wall's foot no longer cuts a hard line.
- The curtain shader can no longer be seen edge-on.
- The Whiteout hand-off strip is unmistakably its own location.
- Reduce Weather storms keep more horizon and slope detail than full storms.

---

## (g) Scores

| # | Category | Score | Justification |
|---|---|---|---|
| 1 | **Visual art direction** | **6** | **Gains:** lip flags, darker deck, softer storm-wall foot. **Offsets:** a new Major in which the flagship flank shading darkens the wrong wall (A5-2); the vanishing-point sheet is untouched despite the claim (A5-3); the deck now reads as water; plumes read as artefacts; the decimation blunted the tors. Persisting: the card, the kerb cornice and the cave primitives. The gains and the regressions roughly cancel. |
| 2 | **Environmental uniqueness** | **6.5** | Whiteout is distinct in palette, deck and storm front, and it has small Whiteout-only lip dressing (the blind reader gives 7/10). Held below 7: the foreground composition is still Alpine's; the uniqueness features meant for the drop are invisible from the line, misread (plumes, deck) or on the wrong side; the drop identity vanishes in storm. |
| 3 | Skiing and hazard mechanics (lc) | 5.5 | Art side only: no visual storm edge tell; drifts and gaps are not readable in `05`/`29`. Defer to B. |
| 4 | Difficulty and fairness (lc) | — | Not examined. |
| 5 | Cinematics (lc) | 6 | `20`/`21` stills: the welcome beat does not show the skier (as CANDIDATE.md admits); the cave dressing is primitive. Defer to C. |
| 6 | Performance and stability (lc) | — | Not examined. |
| 7 | Accessibility and controls (lc) | 6 | Captions are legible. Reduce Weather is visibly lighter. The storm edge is carried only by captions. |
| 8 | Overall player experience (lc) | 6 | The chase reads strongly; the ridge fantasy is still carried by HUD and captions more than by the view. |

## (h) What I could not verify
- **Motion:** plume animation, the wind lean, whether the A5-2 band visibly slides, lamp pulses and the Reduce Flashes calm.
- **Source of the vanishing-point sheet:** I established that it is not the curtain (opacity 0 in a clear front), but did not isolate it by render.
- **GPU output:** tone mapping and haze may differ from SwiftShader.
- **The storm wall's "billowing top":** it is off frame in every capture.
- **Absolute wand flag size:** I estimated it at 8–15 px from crops; I did not measure it by projection.

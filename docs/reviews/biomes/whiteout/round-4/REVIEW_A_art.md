# Whiteout Ridge, round 4: Reviewer A (Visual Art Direction & Environmental Uniqueness)

- **Reviewer:** A. I own category 1 (Visual art direction) and category 2 (Environmental uniqueness). Scores in other categories are low-confidence.
- **Nature:** I am a model reviewer judging still SwiftShader renders and source code. I am not a human playtester. I saw no motion, no GPU output and heard no audio. "Immediately recognizable" is a judgement about a player at 60–80 km/h; I approximate it from stills I could study for as long as I liked. That is a far more generous condition than play, so "not immediate" in a still is a strong negative.
- **Build:** frozen candidate `71c9ceb`. Manifests record `0787168` (rim) and `6ff50f9` (strips); CANDIDATE.md states `git diff 71c9ceb <later> -- src` is empty. I did not re-run that check beyond reading `git log` (later commits are e2e/tool/docs by message).
- **Method:**
  1. Blind first: the eight `candidate/evidence/rim_1366/` frames and `whiteout/27_play_rim_clear.png`, `28_play_rim_storm.png`, `01_clear_window.png`, before reading any document, manifest or code. Notes in section (a), as written.
  2. Then: `CANDIDATE.md`, `DEFECTS.md` (W-065, W-093, art rows), `round-3/REVIEW_A_art.md`, `round-3/CONSOLIDATED.md`, `round-4/dev/art/README.md`.
  3. Then: all 30 `whiteout/` frames, the three `strip_high/` strips (contact sheets), the rim manifest; `git diff 46ed200 71c9ceb -- src` for `cloudSea.ts`, `cornice.ts`, `ridgeRocks.ts`, `scenery.ts`, `course.ts`, `whiteout/biome.ts`; `tests/unit/w065_r4_views.test.ts`. Pixel sampling and zoom crops with PIL (scratch only, `/tmp`).
  4. No browser run; nothing in `src/` or `tests/` modified.

## Verdicts

| Item | Verdict |
|---|---|
| **W-065** (drop immediately recognizable from the gameplay camera, line unmoved) | **FAIL** — 0 of 11 gameplay frames immediate; storm 0 of 5 |
| **W-093** (clear-weather identity only Whiteout has) | **PARTIAL — not closed.** A real Whiteout-only motif now appears in nearly every clear frame (above a sea of cloud, a storm front on the crest). The spires are unchanged, and the foreground still reads Alpine. |

| # | Category | Score |
|---|---|---|
| 1 | **Visual art direction** | **6** |
| 2 | **Environmental uniqueness** | **6.5** |

---

## (a) Blind notes, per image (written before any document, manifest or code; recorded as written)

**rim_1366/classic_sprint_0_clear.png**
Skier on a broad snow saddle. Right: a steep rocky slope rising to a very tall, pale, jagged wall/ridge at top right that looks washed-out, almost like a cut-out. Left: the snow rolls off to a lower, flat grey plain far below with distant low mountains: a cloud sea or a valley floor. The drop on the left reads as a broad plateau edge above a cloud sea, not a cliff. Ahead, at the vanishing point, there's a strange white vertical "smoke" column/curtain with a dark streak line through it. Looks like a mist waterfall. It's confusing and looks like a rendering fault.

**rim_1366/classic_sprint_0_storm.png**
Flat whiteout. A pale hillside on the right. Snow and a soft horizon on the left; a tree. Two sets of ski tracks. Caption. Nothing reads as a ridge or an edge. No tell on either side.

**rim_1366/classic_sprint_1_clear.png**
Traversing a broad bench on the side of a big slope (right) with trees and rocks. The same huge pale serrated wall above it. Ahead and left the terrain forms a bowl/basin with a red hut on a lower bench, and a long ridge line running away on the far left above a flat white plain. Reads as a valley side or a bowl, not as a ridge with a drop. The far wall looks like a translucent sheet.

**rim_1366/classic_sprint_1_storm.png**
Whiteout; slope rising right, a shallow horizon on the left. Nothing ridge-like.

**rim_1366/classic_sprint_2_clear.png**
In a shallow trough/col between a knoll on the left (dark rock fins/tors on it) and a rising rocky slope on the right. Beyond the left fins: a broad flat grey "cloud sea"/valley floor far below with low distant mountains. Ahead: a gully descending with the white mist wall again on its right. Big pale serrated wall top right. The left side reads as high ground above an inversion, so the drop is implied by the distance to the plain, but the edge itself is hidden behind a hump: no lip, no cornice.

**rim_1366/classic_sprint_2_storm.png**
A trough between two white rises; lamp poles; washed out. No drop.

**rim_1366/classic_sprint_3_clear.png**
Like 2: nearly flat snow, a gentle rise on the left to rock tors, a cloud sea lower down beyond them. Rocky steep slope on the right. Huge pale serrated wall. The bright white mist wall descends into the gully ahead (a fog curtain). Drop on the left implied (I'd say "we're high above the clouds") but no edge silhouette. Moderate ridge read.

**rim_1366/classic_sprint_3_storm.png**
Same as the other storms. Pale slope right, trees; flat soft horizon left. No cue.

**whiteout/27_play_rim_clear.png**
Same composition as 2/3: snow floor, lamp pole on the left near ground, a dark rock fin far left, cloud sea below beyond the left snow, rocky slope right, white fog curtain at the vanishing point with a dark seam. Reads "high above a cloud sea"; the edge is not drawn.

**whiteout/28_play_rim_storm.png**
Whiteout. Pale, low rises left and right; a pale rocky/ice silhouette far left. Flags and lamps ahead. No side is identifiable as the drop.

**whiteout/01_clear_window.png**
Overcast, cold palette. Broad snow ramp; cloud sea to the left and below, with a jagged rock on the left skyline; a big pale jagged wall top right; the white fog curtain fills the centre-right and hides where the course goes. Again "above the clouds", but nothing marks the edge.

### Blind summary

| | Count |
|---|---|
| Frames read immediately as a ridge with a drop | **0 of 11** |
| Clear frames where I read "high above a cloud sea / valley" after study | 5 of 6 (0, 2, 3, 27, 01). sprint_1 clear read as a bowl. |
| Storm frames with any edge cue | **0 of 5** |
| Recurrent confusing element | The bright vertical white sheet at the vanishing point (5 of 6 clear frames) |

Post-blind check against `rim_1366/manifest.json`: the rim is on the left in all eight frames (`rimAheadNdc.x` −0.48 to −1.20), 38–73 m from the skier. In `sprint_3` the rim is **outside the frame** (NDC x −1.08 clear, −1.20 storm). My "left" guesses were right where I made one.

**Compared with round 3 (same reviewer role, different instance):** the reading moved from "a frozen lake / lower snowfield" (round 3, 2 of 8 after study) to "high above a cloud sea" (5 of 6 clear frames after study, here). That is a real improvement in *altitude* reading. It is not yet a reading of a *drop at an edge*.

---

## (b) Developer claims checked

| Claim (CANDIDATE.md / DEFECTS W-065, W-093) | Result |
|---|---|
| Far ranges lowered below eye height (`ridge.farRanges 0.3`) | **Verified in code and frames.** `course.ts` multiplies `ranges` by `farRanges`; the test asserts heights 1.5–6 km past the rim are 20 m below the line. In frames the drop-side ranges sit at the horizon behind the cloud sea. Side effect: A4-5. |
| "A near-continuous band of dark rim rock along the rim" | **Not verified in the gameplay view.** Code doubles the rim-band density (every 2nd sample, 12% skipped) and lowers/widens them. In the frames I see 2–5 discrete dark clusters/blades on the left in 2, 3, 27, 01, 02, 03, 06, and **none** in sprint_0 or sprint_1 clear. Nothing reads as a band. In `11_ridge_overview` (elevated) there are two blade clusters along ~200 m of lip, not a band. |
| "A darker valley floor under the cloud sea … the dark is what reads as depth" | **True off the rim, largely lost from the line** (A4-4). `09_valley_view` floor (600,330) = (95,108,121). From the gameplay camera the floor samples (130–160, 142–173, 158–189), now *lighter* than the shaded piste foreground (108–141, 128–161, 156–186). |
| "Rim wands 2.4 m with fluorescent flag panels, ~8 px at 40–50 m, brighter in storms" | **Not visible in any gameplay frame** (A4-2). A pixel search for saturated orange (R>170, R−B>80, G<160) in the rim region (x 0–450) of all eight rim frames, 27, 28 and 01 found nothing. The orange hits were the skier, the hut, lamps and the in-piste drift-gap flags (1.1 × 0.9 m, `hazardViews.ts`). The unit test checks only geometry, not visibility. |
| The white puff over the skier was the capture tool's | **Verified.** No puff in any round-4 rim or play frame. Round-3 F6 is closed. |
| W-065 still OPEN; dev blind reads 4/10, 5/10 | **Consistent with my reading.** The developer's own status is honest. |
| W-093: "the drop side is now a signature view — peaks rising from a sea of cloud below the ridge" | **Partly.** The sea of cloud is present and Whiteout-only. "Peaks rising" from it is not what the frames show: the ranges are pale cards on the haze horizon, and their tips poke through the deck as small dark saucers (A4-5). Spires unchanged (as stated). |

---

## (c) W-065 verdict: **FAIL**

| Check | Result |
|---|---|
| Recognized immediately (drop at an edge) | 0 of 11 |
| "High above cloud/valley" after study, clear | 5 of 6 blind (and in 02, 03, 06, 07 post-blind) |
| Any edge cue in storm | 0 of 5 (`*_storm`, 28, and 29 post-blind) |
| Edge itself drawn (lip, cornice, flank face, wands, rim band) | No gameplay frame |

The owner's bar is that the drop be *immediately recognizable* from the gameplay camera. The candidate makes the player feel high, but it does not show where the ground ends. Between the near snow and the far cloud plain there is no lip silhouette, no marker and no dark gulf. In storms, which are the location's signature weather, there is nothing at all. The developer's own blind reads ("implied rather than shown") agree.

## (d) W-093 verdict: **PARTIAL (not closed)**

- **Done:** In clear weather the left side now shows a cloud sea below in 9 of 10 clear gameplay frames (rim 0/2/3, 27, 01, 02, 03, 06, 07; marginal in sprint_1). Combined with the overcast palette and the storm front on the crest (`03_wall_near`, top right), this is a vista Alpine (blue sky, dense forest bowls, `strip_high/alpine_*`) and Fjord (sea and brown cliff, `strip_high/fjord_*`) do not have. In the hand-off strips Whiteout is now the only location whose drop side is open cloud.
- **Not done:**
  - The foreground composition (rocky, tree-dotted slope on the right, broad snow floor) is still the Alpine/valley composition in every frame.
  - The spires do not read as towers (A4-10).
  - The dominant element on the crest side is still a pale sawtooth card (A4-6).
  - The bright fog sheet at the vanishing point is the most eye-catching thing in every clear frame, and it reads as a fault, not as identity (A4-3).

---

## (e) Scores

| # | Category | Score | Justification |
|---|---|---|---|
| 1 | **Visual art direction** | **6** | **Better:** the skier is no longer hidden (the puff was a tool artefact); the cloud floor reads as cloud, not as a frozen lake; the storm front in `03` is the best sky element yet. **Unchanged or worse:** the bright fog sheet / "breaking wave" with a dark seam at the vanishing point in every clear frame (A4-3); pale flat sawtooth range cards dominate the upper right (A4-6); saucer-shaped range tips along the deck horizon (A4-5); the cornice is an extruded kerb (A4-7); the edge itself is not drawn (A4-1/2). Net change is real but not enough to move a whole point. |
| 2 | **Environmental uniqueness** | **6.5** | Up from 6: a consistent Whiteout-only motif (above a sea of cloud, a storm front over the crest, cold overcast palette) now appears in almost every clear frame and separates Whiteout from both other locations in the strips. Held below 7: the foreground still reads Alpine, the spires are unchanged, and the strongest identity frame (`03`) owes it to a sky element, not to the terrain. |
| 3 | Skiing and hazard mechanics (lc) | 6 | Only the art side seen: the edge is not signalled in any frame (A4-2). The W-078 edge fix I did not evaluate. Defer to B. |
| 4 | Difficulty and fairness (lc) | — | Not examined. |
| 5 | Cinematics (lc) | 6.5 | Strips and 12–26 only, as stills: the station/victory sequence is coherent and warm against the storm; `26_v_reveal` is a good clearing shot. Defer to C. |
| 6 | Performance and stability (lc) | — | Not examined. Defer to D. |
| 7 | Accessibility and controls (lc) | 6 | No visible edge tell in storms; captions are clear and legible. |
| 8 | Overall player experience (lc) | 6.5 | The storm has weight, and the clear windows now feel high. The ridge fantasy is still carried by the HUD and captions more than by the view. |

---

## (f) Findings

### A4-1. MAJOR (W-065): the drop is still implied, not shown; nothing in storms
- **Evidence:** section (a) and the blind summary: 0/11 immediate; 0/5 storm. In the best frames (`rim_1366/classic_sprint_2_clear.png`, `27_play_rim_clear.png`, `03_wall_near.png`), the left snow rises to a soft hump at y ≈ 340–400, and the cloud plain begins directly above it. No lip line, no flank face, no gulf.
- **Player impact:** the location's defining promise (a ridge with a lethal side) is perceived as "we're high up" at best. In storm, nothing.
- **Fix direction:**
  1. Draw the edge where the line can see it. Give the convex roll-down band (piste edge → rim) its own darker, wind-scoured, icy look, so the near ground visibly *ends* in a dark line against the bright cloud beyond.
  2. Add a near-field vapour/spindrift plume streaming off the cornice into the void. It is close enough to survive the storm fog, and it moves.
  3. Put a dark aerial gulf (blue-black, *near* the lip, below eye level) between the lip and the distant cloud plain. See A4-4.
  4. Capture at the line's closest approach to the rim on each course (A4-8).

### A4-2. MAJOR (W-065, claim not verified): rim wands, flags and the rim rock band are not visible from the gameplay camera
- **Evidence:**
  - Orange-pixel search (see (b)) finds no flag panel in the rim region of any of the 11 gameplay frames.
  - The zoomed crops of `sprint_0_clear/storm` show only thin pale sticks.
  - Rim-band rocks appear as a few discrete clusters in 7 frames and none in 2.
  - `wandSpots` sets wands 6 m in from the rim on the rolled-down bank (2 m roll-down, convex); at 38–73 m from the camera they are probably below the sight line or masked by the bank. This is inferred, not rendered.
  - `w065_r4_views.test.ts` verifies the geometry only.
- **Player impact:** the edge tell that is meant to "carry through the storm" (scenery.ts emissive boost) never reaches the screen in evidence. In storms the player has no visual warning.
- **Fix direction:**
  - Place the wands on the piste side of the roll-down (at the piste edge, not 6 m in from the rim), or raise them to clear the bank.
  - Add a capture assertion that wands project into the frame and are unoccluded (a depth-pick at each wand top) and record it in the manifest.
  - Consider a continuous rope or flag line between wands.

### A4-3. MAJOR (art/readability): a bright vertical fog sheet sits at the vanishing point in every clear frame
- **Evidence:**
  - `rim_1366/classic_sprint_0_clear.png` (x ≈ 560–800, y ≈ 230–410, with a dark diagonal seam at x ≈ 630–700). Sample (700,300) = (189,201,219), the brightest large area in the frame.
  - The same in sprint_2/3 clear, 27, 01, 02, 03, 06, 07 and `11_ridge_overview`.
  - It is round-3 F7 ("breaking wave"), and the dev readers called it "a glitch" / "the most confusing element" (`dev/art/README.md`).
- **Player impact:**
  - It takes the eye before anything else.
  - It hides where the course goes.
  - It sits exactly where the drop side and the course meet, so it masks the one place the depth could read.
  - It reads as a rendering fault, not as weather.
- **Fix direction:**
  - If it is the blizzard telegraph curtain, give it noise breakup, motion-readable streaks and a soft base, and remove the hard seam.
  - Keep it out of clear-window frames unless a cell is actually telegraphing.
  - Never let it fill the vanishing point for longer than the telegraph.

### A4-4. MAJOR (contributes to A4-1; claim partly verified): aerial perspective erases the dark valley floor at gameplay distances
- **Evidence:**
  - `cloudSea.ts`: `col = mix(col, uHaze, 0.92*(1-exp(-d*0.00042)))`. At the 2–5 km where the floor is seen from the line, that is 0.53–0.81 haze.
  - Samples:

    | Frame | Floor | Shaded piste |
    |---|---|---|
    | `sprint_0_clear` | (150,330) = (158,171,188); (400,360) = (130,142,158) | (300,600) = (141,161,186), (300,700) = (116,136,161) |
    | `01_clear_window` | (300,330) = (120,133,148) | (300,600) = (113,135,164) |

  - Off the rim (`09_valley_view`) the floor is (95,108,121), the intended dark.
- **Player impact:** the "dark that reads as depth" exists only in the off-line vista. From the line, the floor is a grey plain of about the piste's value. It reads as cloud now (good), but not as a gulf.
- **Fix direction:** make the haze term weaker for the nearest kilometre past the flank, or add a separate near-gulf darkening (a vertical gradient on the flank / a dark vapour band just past the lip) that the haze does not wash out.

### A4-5. minor (art, new): the lowered range tips poke through the cloud sea as small saucer/"ship" silhouettes along its horizon
- **Evidence:** `rim_1366/classic_sprint_0_clear.png` x ≈ 300–700, y ≈ 272–278 (six flat mushroom shapes); `09_valley_view.png` x ≈ 700–860, y ≈ 118–122.
- **Player impact:** they read as boats or platforms on a lake, which pulls back toward the round-3 "frozen lake" misreading.
- **Fix direction:** fade range height into the deck (clip or haze ranges under `CLOUD_SEA` altitude), or raise a few peaks clearly *above* the deck so they read as "peaks rising from cloud" as W-093 intends.

### A4-6. minor (art, persisting W-004 / round-3 F8): the crest-side ranges are a huge pale, flat, sawtooth card
- **Evidence:** the top right of every clear frame (`sprint_1_clear` x 420–1366, y 0–280 is the clearest). In `03_wall_near` the storm front is drawn behind the card, and the card's flat silhouette cuts across it (zoom x 880–1366, y 80–280).
- **Fix direction:** aerial-perspective shading by distance, soft tops, a vertical value gradient, and rock/snow breakup.

### A4-7. minor (art, persisting W-054): the cornice reads as an extruded kerb
- **Evidence:** `08_cornice_edge.png` x 640–1366, y 420–600: a stepped, flat-faced slab with a hard dark underside band. Seen only off-line.
- **Fix direction:** irregular overhang depth along z, a softened crest, and rime/wind texture on the face.

### A4-8. minor (evidence): the rim frames still do not show the closest approach; one frame does not show the rim at all
- **Evidence:** the rim is 38–73 m from the skier; `sprint_3` rim NDC x −1.08 / −1.20 (off-screen). `sprint_1_clear` frames a basin with a hut, and the rim is in the bottom-left corner (NDC −0.88, −0.31).
- **Fix direction:** add frames at each course's minimum rim distance, and frames where the rim projects within |NDC x| < 0.7.

### A4-9. POSITIVE
- The skier-hiding puff is gone (it was a capture artefact): verified across all round-4 play frames.
- The cloud sea now reads as cloud (my blind word was "cloud sea" first, not "lake").
- The storm front in `03_wall_near` is the strongest Whiteout image in the set.
- The Whiteout hand-off strip is now visually distinct from Alpine and Fjord (open cloud on the drop side, cold overcast palette).

### A4-10. minor (W-093 remainder): the spires still read as rock fins on the snow, not towers, and vanish in storm
- **Evidence:** `11_ridge_overview` (x 95–315, y 350–530) and `02_wall_far` (x 490–590, y 335–385) show blade-shaped tors standing on the lip. No spire is visible in any storm frame.
- **Fix direction:** as round-3 F5: fewer, taller, needle spires set 5–10 m *past* the rim with visible void between spire and lip, darker at the foot.

---

## (g) What I could not verify
- **Motion:** whether the fog sheet, the deck, the spindrift or the wand emissive pulse read in play, and whether anything is noticed at 60–80 km/h.
- **Whether the wands are occluded or simply sub-pixel/culled:** inferred from geometry and the absence of pixels, not isolated by rendering.
- **1920×1080:** only one dev frame exists (`dev/rim_1920/`, not the frozen build's evidence); not reviewed.
- **GPU rendering:** tone mapping and haze may differ from SwiftShader.
- **The cause of the fog sheet:** taken from the developer's note (blizzard telegraph curtain); not confirmed in code.
- **Low/Reduce-Weather presets:** not reviewed for art.

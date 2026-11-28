# Whiteout Ridge, round 3: Reviewer A (Visual Art Direction & Environmental Uniqueness)

- **Reviewer:** A. I own category 1 (Visual art direction) and category 2 (Environmental uniqueness).
- **Nature:** I am a model reviewer judging still renders (SwiftShader) and source code. I am not a human playtester. I saw no motion, no frame pacing, no GPU output and heard no audio. "Immediately recognizable" is a perceptual judgement about a player at 60–75 km/h. I can only approximate it from a single still, which I looked at for as long as I liked. That is a far more generous condition than play, so a "not immediate" in a still is a strong negative.
- **Build:** frozen candidate `46ed200`. The rim manifests record `f7d4820` (an evidence-only commit). I checked `git diff --stat 46ed200 f7d4820 -- src tests`: it is empty, so the frames show the candidate's source.
- **Method:**
  1. I looked at the eight `rim_1366` frames blind, before reading any document, manifest or code, and wrote the notes in section (a).
  2. Then I read `CANDIDATE.md`, the W-065 row in `DEFECTS.md`, `w065/REVIEW_A_blind.md` and `round-2/REVIEW_A_art.md`.
  3. I read `cloudSea.ts`, `ridgeRocks.ts`, `cornice.ts` (wands), `course.ts` (`ridgeSide`, `rollDown`, `ridgeRimX`), `snowMaterial.ts` (valley shade) and `capabilities/environment.ts` (`RIDGE_GUARD`).
  4. I cropped, zoomed and pixel-sampled the frames. I compared them with the earlier blind set (`w065/blind/view02_X`, before the deck was darkened), `fjord/final/09d_pursuit_rim.png` and `alpine-baseline/03_mid_mountain.png`.
  5. I did not run a browser or modify `src/` or `tests/`.

## Verdict

**W-065: FAIL** against "immediately recognizable".

| Category | Score | Note |
|---|---|---|
| 1. Visual art direction | **6** | Below the gate. |
| 2. Environmental uniqueness | **6** | Below the gate. |

The darker cloud deck is a real improvement in contrast. But in the gameplay view it reads as a flat, slate-blue lower plain, a frozen lake or snowfield, not as a void. It is visible in only 2 of the 8 frames, and in none of the storm frames.

---

## (a) Blind notes, per image

I wrote these before reading any document, manifest or code. They are recorded as written.

**rim_1366/classic_sprint_0_clear.png**
- **Lethal side:** Left, probably. Beyond a snow lip on the left there is a flat grey-blue plane in the middle distance, darker than the snow, with a jagged near edge. It reads like a frozen lake, a cloud deck or a lower plateau. The right side is a rock-strewn slope going up.
- **Recognition:** After study, not immediately. Nothing says "cliff". You infer a drop because the near ground ends and something flat and lower lies beyond it.
- **Far side:** A flat grey-blue plane, about equally lake/snowfield or cloud sea, with pale haze and jagged pale ranges behind.
- **Unsafe ground shown as skiable snow:** Possibly. The flat plane has the same blue-grey as the shaded piste, and the snow on the left lip runs straight to it.
- **Readability:** Hazards and markers are readable. The skier is **not**: a large white spray puff covers the character (centre, about x 570–770, y 400–530).

**rim_1366/classic_sprint_0_storm.png**
- **Lethal side:** Neither is identifiable. The left snow rolls off into pale haze, and the right is a pale hill.
- **Recognition:** Not at all.
- **Far side:** Sky and haze, a uniform grey.
- **Unsafe ground shown as skiable snow:** Nothing is marked as unsafe at all. The left horizon is just more snow into fog.
- **Readability:** The lit pole on the right and a faint pole ahead are readable. The skier is partly hidden by the spray puff again (x 650–830, y 440–520).

**rim_1366/classic_sprint_1_clear.png**
- **Lethal side:** Left. Past the left lip, which has rocks and a lamp pole on it, a large dark grey-blue flat plane lies lower down. A dark jagged rock sits on the lip.
- **Recognition:** After brief study. This is the strongest frame. The rim line with objects standing on it, and a lower plane beyond, says "edge". It still reads more as "a plateau above a frozen lake" than "a cliff".
- **Far side:** A dark flat plane (lake, snowfield or cloud deck), then pale haze and pale jagged ranges. A pale haze or spindrift column sits in the centre, between the plane and the right slope.
- **Unsafe ground shown as skiable snow:** The plane beyond the lip has the colour and flatness of snow in shadow. A player could take it for a lower snowfield.
- **Readability:** The skier is clear, and the markers and poles are readable.

**rim_1366/classic_sprint_1_storm.png**
- **Lethal side:** Neither is identifiable. On the left there is a low rock and a flat horizon into fog.
- **Recognition:** Not at all.
- **Far side:** Fog.
- **Unsafe ground shown as skiable snow:** The left horizon is indistinguishable snow into fog. Nothing signals an edge.
- **Readability:** The skier, the orange markers and the pole are readable.

**rim_1366/std/classic_standard_0_clear.png**
- **Lethal side:** Neither. On the left are snow-laden trees and a lamp pole, with pale haze behind. On the right is a rocky tree-dotted slope going up.
- **Recognition:** Not at all. It reads as a valley or bowl.
- **Far side:** Pale haze and pale ranges. Ahead, a strange curling grey translucent shape like a breaking wave (x about 560–940, y 240–390) sits over the course.
- **Unsafe ground shown as skiable snow:** Nothing marks any edge.
- **Readability:** The skier and markers are readable. The "wave" shape reads like a solid object.

**rim_1366/std/classic_standard_0_storm.png**
- **Lethal side:** Neither.
- **Recognition:** Not at all.
- **Far side:** Fog.
- **Unsafe ground shown as skiable snow:** No edge cue.
- **Readability:** The skier, lamp poles and markers are readable.

**rim_1366/std/classic_standard_1_clear.png**
- **Lethal side:** Probably left. The left snow ends at a soft horizon, with a few trees, a lamp pole and a cluster of dark angular rocks standing on it. Beyond that there is only flat pale haze and distant soft ranges, with no ground in between.
- **Recognition:** After study, and ambiguous. It could just as well be a gentle rollover onto a broad plateau.
- **Far side:** Pale haze, the same value as the sky, with distant soft-edged ranges.
- **Unsafe ground shown as skiable snow:** The snow runs to the horizon with no edge treatment.
- **Readability:** The skier and markers are readable.

**rim_1366/std/classic_standard_1_storm.png**
- **Lethal side:** Neither.
- **Recognition:** Not at all.
- **Far side:** Fog.
- **Unsafe ground shown as skiable snow:** No edge cue. A small yellow stick at the far left is the only thing on the left horizon.
- **Readability:** The skier and lamp poles are readable.

### Blind summary

| | |
|---|---|
| Lethal side identified | 2 of 8 frames, both clear sprint frames, and only after study. A third, std_1 clear, was an ambiguous guess. |
| Immediately recognised | 0 of 8 |
| Storm frames with any cue | 0 of 4 |

Post-blind check: the manifests put the rim on the left (`rimAheadNdc.x` between −0.40 and −0.96) in all eight frames, 33–53 m from the skier. My left guesses were right. The renders closely match the earlier blind review's open build (`w065/blind`), and my notes converge on the same readings independently.

---

## (b) Scores

| # | Category | Score | Justification |
|---|---|---|---|
| 1 | **Visual art direction** | **6** | **Better:** the storm horizon step is much reduced (F9), and the deck now separates from the snow by value. **Worse or unchanged:** the deck shows as a hard, stair-stepped, flat slab (F3). The spray puff hides the skier (F6). The "breaking wave" fog shape is still there (F7). The pale sawtooth range cards are unchanged (F8). |
| 2 | **Environmental uniqueness** | **6** | Storm frames are unmistakably "whiteout". Clear frames still read as Alpine: a rock- and tree-studded slope on the right, a bowl or plateau on the left. Compare `alpine-baseline/03` with std_0 clear. Fjord's rim frame (`fjord/final/09d`) gives a signature vista. Whiteout's equivalent is a dark flat plain in 2 of 8 frames. |
| 3 | Skiing and hazard mechanics (lc) | 6 | I read only `RIDGE_GUARD`: going over the rim is relocation plus a crash, and the visible snow up to the lip is legitimately skiable. The edge is under-signalled (F4). I did not evaluate the rest. |
| 4 | Difficulty and fairness (lc) | 6 | Not examined. The line is unchanged, so W-056 is presumably intact (claim). |
| 5 | Cinematics (lc) | — / 6 | Not examined. The hand-off strip is Alpine only, and there are no Whiteout cave or victory renders yet. |
| 6 | Performance and stability (lc) | 7 | Not examined; placeholder. Defer to D. The `candidate/perf/` directory was empty when I looked. |
| 7 | Accessibility and controls (lc) | 6 | The spray puff hides the character (F6). Rim wands are about 1–2 px wide at 40–50 m (F4). |
| 8 | Overall player experience (lc) | 6 | The storm has weight. The "ridge" fantasy still is not delivered from the gameplay camera. |

---

## (c) W-065 verdict: **FAIL** against "immediately recognizable"

| Check | Result |
|---|---|
| Recognized immediately | 0 of 8 frames |
| Recognized after study | 2 of 8 (sprint 0 and 1, clear), plus 1 ambiguous (standard_1 clear) |
| Any reading in storm | 0 of 4. By design: the deck fades out at `storm` 0.35–0.8 (`cloudSea.ts`), and the spires fog out. |

**What improved since the earlier blind build (verified by pixels):**

| Sample (sprint_1 clear) | Earlier build (`w065/blind/view02_X`) | Candidate |
|---|---|---|
| Deck at (300, 340) | (163, 178, 200) | (114, 131, 158) |
| Lip snow | (169, 185, 204) | (169, 185, 204) |

The deck is now about 50 levels darker than the lip snow. It no longer dissolves into the haze, and it separates from it.

**Why it is still not a recognizable drop:**
- **It reads as a lower snowfield.** It has the same hue and value as the shaded piste the player is skiing on (F2).
- **It is a flat slab with a hard terraced edge.** There is no billow, rim light or vapour (F3).
- **The geometry keeps it far away.** It sits 330 m below the line and starts 260 m past the rim, so with the camera 2–3 m up and 33–53 m from the rim, it can only appear kilometres out, as a thin band near the horizon.
- **Nothing is visible between the lip and the deck.** There is no flank face, no dark gulf and no vapour.
- **The edge has no readable marker.** The spires read as low rock clumps on the snow. The wands are 1–2 px wide (F4, F5).
- **The drop only reads in clear weather, from one viewing angle.** I found it in 2 of 4 clear frames. In both standard-course clear frames the deck does not appear at all (trees or terrain fill the band).

---

## (d) Findings

### F1. MAJOR (W-065, uniqueness): the drop is not immediately recognizable from the gameplay camera

- **Evidence:** all eight `rim_1366` frames; the blind summary in (a).
  - The best frame is `classic_sprint_1_clear.png`, left third (x 0–620, y 260–430). The plane beyond the lip is visible, but the edge reads as "a plateau above a plain", not as a cliff.
  - In both `std/*_clear` frames the left side reads as a bowl (std_0) or a soft rollover into haze (std_1).
- **Player impact:**
  - The location's defining promise, a ridge with a lethal drop, is not perceived at speed.
  - It is also not perceived in any storm, which is the location's signature weather.
  - The HUD and captions still carry the fantasy.
- **Fix:** combine F2–F5. The single highest-value change is a visible dark gulf, a band of aerial-perspective blue-black, directly beyond the lip and below eye level. At present the plane jumps from the lip snow straight to a far deck or haze. See F2 for how.

### F2. MAJOR (consistency): the cloud deck has the hue and value of shaded piste snow, so the void reads as a lower snowfield

- **Evidence:** `classic_sprint_1_clear.png`.

  | Sample | Pixel | Colour |
  |---|---|---|
  | Deck | (300, 340) | (114, 131, 158) |
  | Deck | (500, 320) | (132, 148, 173) |
  | Piste foreground | (300, 600) | (133, 153, 179) |
  | Piste foreground | (300, 700) | (107, 126, 153) |
  | Deck, sprint_0 clear | (300, 320) | (124, 140, 166) |

  The deck and the near piste are effectively the same swatch. The deck shader's dark end, `vec3(0.34, 0.41, 0.53)`, is the snow's shade tint, and with the flat `fbm` streaks it reads as wind-streaked snow seen at a grazing angle.
- **Player impact:**
  - The one area the player must never enter is drawn in the colour of the ground they ski on.
  - In my blind notes I called it "a frozen lake / lower plateau / snowfield" each time before "cloud".
  - This works against the bar: "no unsafe edge painted as traversable".
- **Fix:**
  1. Make the deck read as cloud, not ground. Give the billow tops brighter, warmer sunlit crowns, lighter than the lip snow, with soft blue undersides and visible relief or parallax: two layers drifting at different rates, or soft particles.
  2. Separate deck and snow in hue as well as value: a cooler, more saturated blue in the gaps.
  3. Most important: add the dark gulf between lip and deck (see F1). Darken the far valley wall, or add a vapour plume (spindrift streaming off the cornice into the void). Either breaks the "continuous ground" reading and also works in storms.

### F3. MAJOR (art): the deck's near edge is a hard, stair-stepped line, a cut-paper slab

- **Evidence:**
  - `classic_sprint_0_clear.png` at x 140–660, y 280–340 (zoom in my scratch `s0c_left.png`): horizontal terraces with vertical risers along the whole upper edge.
  - `classic_sprint_1_clear.png` at x 100–620, y 265–320: the same.
  - The earlier, paler deck (`view02_X`) hid this. The darker grade exposes it.
- **Cause (unverified):** probably the alpha ramp `smoothstep(260, 760, e + (c−0.5)·300)`. Viewed at a grazing angle kilometres away, it compresses to a few pixels per terrace, possibly also cut by far terrain or LOD occlusion. I could not render to isolate it.
- **Player impact:** the deck reads as a flat graphic or a lake shoreline, not as vapour. In motion the terraces are likely to crawl, though I cannot verify that.
- **Fix:**
  - Fade alpha with view grazing angle and with screen-space distance from the deck's horizon line.
  - Add a soft depth fade against the terrain (a soft-particle-style `depthTexture` comparison).
  - Make the ragged term vertical (billow heights) rather than only horizontal.

### F4. MAJOR (hazard readability and consistency): the edge itself has no marker readable at gameplay distance

- **Evidence:**
  - `std/classic_standard_1_clear.png` at about (285, 400) and `std/classic_standard_1_storm.png` at about (290, 402): a yellow stick 1–2 px wide is the only rim wand visible. Its black-and-yellow banding and red flag cannot be resolved.
  - The wands are 6–7 cm poles, 1.9 m tall, every 36 m (`cornice.ts`).
  - The cornice is never visible: it lies beyond the convex lip.
  - The 10 m band between the piste and the rim rolls down 2 m with the piste's own snow material, with no change in texture or tone.
- **Consistency:**
  - The snow visible up to the lip is genuinely skiable: `RIDGE_GUARD.over` is 8 m past the rim. So the near snow is honest.
  - But the transition to "fatal" happens out of sight just past a line the player cannot see. The only on-screen tell is a 2 px stick.
  - In storms there is no tell at all except that stick.
- **Player impact:** a player who drifts left has no visual warning before "over the cornice". In storms this feels arbitrary.
- **Fix:**
  - Wands at 12–18 m spacing, 2–3× thicker (or with a rope or flag line between them, which reads as a continuous line at distance).
  - A wind-scoured band at the lip: darker, icy, sastrugi-textured, matching how real cornice edges look.
  - A spindrift plume streaming off the cornice, which survives the storm fog because it is near.

### F5. MINOR (art): the rim spires read as low rock clumps lying on the snow, not as towers rising out of a void

- **Evidence:**
  - `classic_sprint_1_clear.png` at x 120–200, y 380–410.
  - `std/classic_standard_1_clear.png` at x 440–560, y 370–395 (zoom `z_classic_standard_1_clear.png`). These are dark angular blocks whose tops clear the lip by about 15–25 px.
  - Their feet are hidden by the lip, but at 55–90 m from the skier, only 6–18 m above the rim (`ridgeRocks.ts`), they read as boulders resting on the snow beyond.
  - They are not visible in any storm frame.
  - Placement is one per 100 m, with 15% skipped.
- **Player impact:** they add a little "edge" in the best frame (sprint_1), but do not read as "the ground stops here".
- **Fix:**
  - Fewer, taller and thinner (needle) spires with a visible gap of void or haze between the spire and the lip, so the eye reads the spire as standing below.
  - Place some 5–10 m past the rim, so they overlap the lip line in silhouette.
  - Add a value gradient: darker at the foot, fading into the gulf.

### F6. MAJOR (readability): the spray puff hides the skier

- **Evidence:** `classic_sprint_0_clear.png` at x 570–770, y 400–530, and `classic_sprint_0_storm.png` at x 650–830, y 440–520. A large white additive sprite covers the character.
- **History:** the earlier blind review flagged the same thing (view01 and view03), and it is still present.
- **Player impact:** the player loses the character silhouette, which matters for both readability and accessibility.
- **Fix:**
  - Cap the puff's screen coverage and opacity near the camera-to-skier line.
  - Draw the skier after the spray, or reduce the additive brightness.

### F7. MINOR (art): the "breaking wave" fog shape is still present

- **Evidence:** `std/classic_standard_0_clear.png` at x 560–940, y 240–390. A curling translucent grey shape like a solid wave sits over the course.
- **History:** the same as the earlier blind review's view05, the "most confusing element in the whole set".
- **Player impact:** it hides the course beyond the bend and reads as a solid object.
- **Fix:** soften it into a spindrift veil (with noise breakup and no hard curl), or remove it in clear weather.

### F8. MINOR (art): the distant ranges are pale, unshaded sawtooth cards

- **Evidence:** every clear frame, at top right (x 800–1366, y 0–250) and left (x 0–550, y 140–250). Flat value, with sawtooth tops.
- **History:** unchanged since round 2 ("Ranges").
- **Fix:** shade the ranges with aerial perspective by distance, and add soft tops and a vertical value gradient.

### F9. POSITIVE (round-2 N1 largely addressed): the storm horizon step is much reduced

- **Evidence:** in `classic_sprint_1_storm.png`, the sky at (640, 250) is (188, 202, 214) and the far ground at (1000, 330) is (200, 209, 221).
- **Comparison:** round 2 measured sky (186, 188, 191) against ground (199, 208, 221), a step of about 30 in blue. The sky and the fogged far ground now nearly match in hue.
- **What remains:** the near ground stays much darker, (98–120, 118–142, 147–170), so a soft horizon line remains at about y 425–440. This is acceptable.

### F10. MINOR (evidence)

- `rim_1920/` and `whiteout/` (weather, vista, cave, chase, Hard snowballs, victory), both listed in `CANDIDATE.md`, did not exist when I reviewed.
- `candidate/perf/` was empty.
- `handoff_strip/` is Alpine only (sha `305bf60`).
- The rim frames all sit 33–53 m from the rim. No frame shows the closest approach on each course, so I cannot say whether the drop ever reads better.

---

## (e) What I could not verify

- **Motion:**
  - whether the deck's stair-stepped edge crawls or shimmers;
  - whether the drift of the deck and spray gives any parallax depth cue;
  - whether a player at 60–75 km/h notices anything at all. Stills are a generous proxy.
- **1920×1080:** whether higher resolution makes the wands or spires legible. No `rim_1920` renders existed.
- **The rest of the location:** weather phases, vista, the cave (W-066), the victory scene, or W-067/W-068 fixes. The `whiteout/` renders were absent.
- **Uniqueness side by side:** I could not make an evidenced Alpine/Fjord/Whiteout comparison in matching gameplay frames. I used the archived Alpine and Fjord frames instead.
- **GPU rendering:** SwiftShader only. Tone mapping and banding may differ on GPUs.
- **The cause of the deck terracing (F3):** inferred from the shader, not isolated by rendering.
- **The closest approach of the line to the rim** on each course. I took the developer statement "line unchanged" and the manifest distances (32–53 m) at face value for the frames shown.

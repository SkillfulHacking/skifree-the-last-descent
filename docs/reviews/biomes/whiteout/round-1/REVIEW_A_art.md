# Whiteout Ridge, round 1: Reviewer A (Art Director)

- **Reviewer:** A, Art Director. Owns category 1 (Visual art direction) and category 2 (Environmental uniqueness).
- **Nature:** I am a model-based reviewer, not a human playtester. I judged still frames and source code. I saw no motion, frame pacing or real GPU output.
- **Build:** `3f7bc45` (branch `pass5-whiteout`).
- **What I examined:**
  - All 26 PNGs in `round-1/evidence/` and `manifest.json`. I looked at each frame myself and cropped regions of 01, 04, 08 and 22.
  - The Alpine (`alpine-baseline/`) and Fjord (`fjord/final/`) frames for comparison: 03, 07, 09 and 11c.
  - Source: `src/world/biomes/whiteout/{biome,storm}.ts`, `views/{sky,scenery,cornice,blowingSnow,stormCave,hazardViews,rescue,rescueVictory}.ts`, the shared `world/Environment.ts`, `world/look/atmosphere.ts`, `world/look/ranges.ts` and `game/World.ts`, and the capture script `tools/whiteout_evidence.mjs`.
- **Provenance:** `manifest.json` records SHA `6d0cdfa`, not the candidate. I ran `git diff 6d0cdfa 3f7bc45 -- src` and `git diff 0f04659 3f7bc45 -- src`. Both are empty, so the frames do show candidate code.
- **Spec:** `docs/BIOMES.md` has **no Whiteout section**. Whiteout appears only in the difficulty ladder at line 272. I therefore judged against the intent in the source headers (`biome.ts:1-19`, `storm.ts`, `sky.ts:1-18`, `rescueVictory.ts:1-20`) and the shot notes in the manifest. I treated both as developer claims to verify.

## Verdict: FAIL (both owned categories are below 9)

| # | Category | Score | One-line justification |
|---|---|---|---|
| 1 | Visual art direction | **5** | The station, the Yeti, the snowball marker and the clearing sky are good. But the storm does not read as a whiteout, the sky has card and plane artefacts, and the victory's light beats have no value contrast to read against. |
| 2 | Environmental uniqueness | **6** | The weather cycle, lamps, red rescue hut and dark granite are new. But from the gameplay camera the "ridge" reads as a shallow trough, the cave is Alpine's cave re-tinted, and the storm reads as an overcast Alpine day. |
| 3 | Skiing and hazard mechanics (lc) | 6 | Not reviewed in depth. The physics weather keeps running during visual weather blends (Finding 5), and the blizzard telegraph is not visible in frame 02. |
| 4 | Difficulty and fairness (lc) | 6 | The fog cap keeps the course navigable. The visual-versus-physics storm mismatch in Finding 5 is a fairness risk. |
| 5 | Cinematics (lc) | 5 | The station victory beats are not supported by the image: no visible light, the Yeti is visible before his beat, no break in the storm, and the reveal frame lacks the station. The cave squall is not perceptible. |
| 6 | Performance and stability (lc) | 7 | Not examined. This score is a placeholder with no basis. Defer to Reviewer D. |
| 7 | Accessibility and controls (lc) | 7 | Captions, the STORM pill, lamps and the snowball beam are readable in fog (frames 04, 05, 18). Rim wands are sub-pixel (Finding 7). |
| 8 | Overall player experience (lc) | 6 | The concept is strong, but the look does not deliver the promised storm. |

## Findings

**Verified** means I checked it myself in an image, by arithmetic, or in code at the cited line. **Developer claim** means a sentence I took from comments or the manifest.

### 1. MAJOR: the storm does not look like a whiteout

**Evidence (verified):**
- **Fog arithmetic:**
  - The storm fog is `fogDensity 0.00085 × STORM_FOG.storm 11 = 0.00935`, capped at `maxFogDensity 0.0105` (`biome.ts:73`, `storm.ts:187,197`, `Environment.ts:244-248`).
  - The terrain shader applies `1 − exp(−(d/26000 + (ρd)²))` (`atmosphere.ts:92-98`).
  - At the cap, fog covers **51% at 80 m, 67% at 100 m and 92% at 150 m**. Without the cap it covers 43%, 58% and 86%.
  - "~80 m visibility" therefore means a half-fogged object at 80 m, and silhouettes stay legible to about 150 m. That is moderate fog, not a whiteout.
- **Light flattening is incomplete.** The storm cuts the sun by 78%, but the environment light by only 30% and the hemisphere light by only 12% (`Environment.ts:229-233`). The exposure stays at 0.82.
- **The screenshots confirm this:**
  - In **05_storm**, the right-hand slope keeps crisp ripple shading and individual trees out to its crest. The background holds a distinct flat grey sky with a horizon line.
  - **18_hard_snowball_fog** shows trees crisp on both banks.
  - **19_station_approach** shows the station clearly at an estimated 100 m or more.
  - **20 and 22** (victory "storm 1", fog density 0.00765) show crisp hut detail and almost no airborne snow.
- **The driven snow is white on white.** The blowing-snow grains are 3.5 cm wide (`blowingSnow.ts:111`), about 1–2 px at 10 m. They are drawn in near-white over a near-white fog (STORM_GREY 0.8/0.83/0.87, `Environment.ts:310`). In 05 I can make out only scattered dots, not the "driving snow streaks" the manifest claims.
- **The blizzard is invisible too.** 02 shows the blizzard caption, but no blizzard curtain is discernible in the frame. The curtain colour is 0.9/0.93/0.97 (`hazardViews.ts:31`).

**Why it matters:** "Whiteout" is the location's name and its signature. A player should feel the horizon vanish and the ground merge with the sky. Instead the storm reads as a grey overcast run that looks like Alpine's.

**Fix direction:**
- Separate how the storm *feels* from how navigable it is. Keep the navigation guarantee (lamps, markers, HUD), but remove contrast rather than adding distance fog:
  - collapse sky and ground to the same value;
  - kill the directional and cloud-shadow terms and the ripple shading at storm strength above 0.6;
  - lower the environment and hemisphere contrast;
  - add a dense near-field veil of layered, screen-aligned snow sheets within 5–25 m;
  - make the grains larger, more numerous and slightly darker than the fog so they read as motion.
- Then let the lamps, wands and snowball beam carry legibility. Frame 18 shows the beam approach works.

### 2. MAJOR: hard-edged sky geometry (storm wall plane, cloud-deck "drips", cut-paper ranges)

**Evidence (verified in frames; causes partly from code):**
- **The storm wall is a flat plane.** It is a single `PlaneGeometry(14000, 1500)` placed beside the course (`sky.ts:178-193, 233-236`).
  - Its shader fades the ends and the top (`sky.ts:128, 134`) but **not the bottom edge**: at `vUv.y = 0`, `body = 1`.
  - During the build the plane comes to within about 190 m of the camera. At 04's moment (`left 2.5` s) that distance is `4200·0.16·(1−0.72)` = 188 m.
  - In **04_build** the wall reads as a giant flat grey wedge with straight edges converging on the vanishing point (region x 680–1280, y 60–400). It looks like a sheet of card, not a cloud mass, and this is the telegraph moment.
  - In **03_wall_near** the wall (top right) is a dark, flat-bottomed block.
- **The cloud deck hangs sawtooth "drips" from the top of the frame.** They are visible in **01** (crop of y 80–260: dark spikes hanging at x 1090–1280), **05, 06, 07, 08, 11 and 19**. `sky.ts:99-106` claims to have fixed exactly this, but the frames still show it.
- **Distant ranges are pale cut-paper silhouettes.** They have near-vertical spikes (01 crop, x 1090 and 1170). **26_v_reveal** shows a perfectly vertical edge at about x 1190, y 160–240.
- **09_valley_view** has a semi-transparent grey smear with straight edges across the upper left (y 90–320). Diagonal polygon seams are also visible in the far haze.

**Why it matters:** these are the first things a player sees in every vista and every front. They make the sky look like stage flats.

**Fix direction:**
- Replace the wall plane with several curved, layered shells, or with a fogged volumetric impostor that has a soft bottom and soft edges. Never let one plane pass within about 1 km of the camera; fade it out before it does.
- Fade deck alpha (not just colour) to zero toward the deck edge (`sky.ts:108-110` keeps alpha at `0.6·d`).
- Low-pass the ranges' silhouette at Whiteout's haze level.

### 3. MAJOR: the ridge does not read as a ridge from the gameplay camera

**Evidence (verified):**
- `biome.ts:119-127` says the course runs along a ridge, with a corniced rim and a 520 m drop on one side and a rocky crest on the other.
- In **every gameplay frame (01–07, 16, 18, 19)** the piste sits in a trough. A low, tree-dotted bank rises on the drop side (screen left), a boulder-strewn slope rises on the crest side (screen right), and haze fills the far end.
- The drop is never seen, and neither are the cornice and the far ranges across the void.
- The drop only appears from staged free-camera poses (08, 09, 11). Even there, **09** (the "~500 m" drop) is a white void with no valley floor, no far ranges and no scale cue.
- **11** shows why: the bank on the drop side rises above the piste before it rolls over, so it hides the drop at eye height.
- Compared with **Alpine 09_pursuit**, Whiteout 01 and 07 have the same composition: lower walls, fewer trees, a greyer palette.

**Why it matters:** exposure is the core fantasy, and it is what justifies the wind. Without seeing open air on one side, the player is in a valley.

**Fix direction:**
- Lower or remove the drop-side bank near the piste so the rim sits below eye height.
- Route the racing line close enough to the rim, at intervals, that the void enters the frame.
- In clear windows, put a readable valley floor and ranges far below the horizon line, giving a scale cue such as a lake, glacier or village lights.
- Darken the far side of the void so the edge has a silhouette against it.

### 4. MAJOR: the victory "into the light" sequence has no light to read

**Evidence (verified):**
- **20_v_arrive:** the porch light and searchlight barely register, and no beam is visible.
  - The searchlight beam is additive with `uK` forced to 0.1 (`rescue.ts:449-460, 598`) over a near-white fog, so it adds almost nothing.
  - The door `PointLight(0xffb060, 20→46, 24 m)` (`rescue.ts:370, 590`) and the lantern `PointLight(4, 7 m)` (`rescue.ts:520`) cannot compete with the storm's high-key ambient light (Finding 1).
- **22_v_lantern (the named beat):** the lantern glass is pale cream with no glow halo and no light pool. The crop (x 500–760, y 280–460) shows a dark internal shape behind the glass. The lantern also sits directly on top of the vertical ski pole held in the same hand, so it reads as a lantern on a stick.
- **23_v_yeti_light:** no searchlight pool on the Yeti and no lit-versus-unlit falloff, so "the edge of the light" has no edge.
- **21_v_welcome (5.0 s):** the Yeti is plainly visible at the left (x 120–160).
  - The script says he is "waiting out in the white, unseen" until 5.2 s, and starts 26 m beyond his stop point (`rescueVictory.ts:52-60, 140-143`).
  - At the victory fog density of 0.00765, fog covers only about 4% at 26 m and about 5% at 30 m, so he can never be unseen.
  - The shot also shows neither the porch nor the "warm light on the snow" the manifest claims.
- **25_v_break (15 s):** a uniform grey sky with no visible tear.
- **26_v_reveal:** "the ridge revealed behind the station" does not include the station, and the sky has the vertical range artefact from Finding 2.

**Why it matters:** the location's emotional pay-off is warm light against a storm. In the frames it is a red hut on an overcast day.

**Fix direction:**
- Grade the finish storm darker and bluer: dusk, lower exposure, and fog density uncapped inside the cinematic (the accessibility cap protects gameplay, not cutscenes).
- Give the lantern, door and searchlight bloom or glow sprites, plus a lit volume in the falling snow and a ground decal for each light pool.
- Fog the Yeti behind a local dense volume until his beat.
- Keep the station in frame for the reveal.

### 5. MAJOR: the storm-chase frames do not show a storm; the sky and the fog disagree during weather blends

**Evidence (verified):**
- **16_storm_chase** and **17_yeti_silhouette** are recorded as front `storm`, `s = 0.84`. Both show **blue sky with sunlit pink clouds**, and 17 shows the cave in clear light with the Yeti still on the rock above the mouth. There is no "silhouette in the snow".
- **Cause:**
  - The capture jumps the physics clock into a storm right after the cave (`whiteout_evidence.mjs:209-210`).
  - Meanwhile `World.weatherFade` is still blending the visual weather from the cave squall's last value toward the live weather over 7 s (`World.ts:429-434, 585-595`; `stormCave.ts:174-176`).
  - `StormSky` reads the *model's* `f.s` whenever no override is set (`sky.ts:202`). It therefore fades the deck out (uFade about 0.05 at s = 0.84), while `Environment` still applies the low *blended* storm value, so the dome and fog are almost absent. The clear base sky shows through.
  - Physics never sees the override (`World.ts:425-428`), so during any such blend the skier gets full storm crosswind under a clear sky.
- In natural play this needs a cinematic that releases into a different weather state. Long courses have 3–11 encounters (`courses.json`), so I rate it a latent risk rather than a demonstrated one.

**Why it matters:**
- There is **no valid evidence** for the storm chase or the Yeti-in-the-storm look.
- During a blend, the sky, the fog and the physics tell three different stories.

**Fix direction:**
- Drive `StormSky` from the same blended `weather.storm` the environment uses.
- Re-capture 16 and 17 by waiting for a natural storm in the chase, not by jumping the clock.

### 6. MAJOR (uniqueness): the cave is Alpine's cave, re-tinted

**Evidence (verified):** compare **12_cave_mouth** with **alpine-baseline/07_yeti_cave**. They share:
- the same mouth silhouette;
- the same horizontal strata seams;
- the same icicle clusters at the lip;
- the same three-claw scratch, right of the mouth.

Whiteout changes the rock tint, adds a faint rime (`stormCave.ts:97-104`) and adds particles. Fjord got a unique sea cave (fjord 07: basalt columns and a tidal pool).

The squall that should sell the encounter is not perceptible. In 13 and 14 the only weather is round, soft-edged flakes, which read as dust or stars against the black interior. The "snow blasted off the brow" at the roar (14) is not visible.

**Why it matters:** this is the location's signature set piece, and it is the least distinct cave of the three.

**Fix direction:**
- Give the cave its own geometry: a wind-carved ice and rime hollow under a cornice, blue ice walls, or a rock rib with a snow-drift-choked mouth.
- Make the squall visible from outside the mouth: streaked, directional sheets that cross the opening.

### 7. MINOR: cornice and rim wands

- **08 crop (verified):** the cornice reads as an extruded kerb or ribbon. It has a constant-thickness dark underside band, and the 3 m sampling (`cornice.ts:19`) causes visible kinks. It has none of the curl, scalloping or overhang shadow of a wind cornice.
- **Rim wands:** they are 3–4 cm radius, 1.9 m tall and 36 m apart (`cornice.ts:26-28`, `cornice.ts:172`).
  - At 1280×720 with a 67° field of view, one metre spans about 544/d px.
  - At 30 m a wand is about 1.3 px wide. At 80 m (51% fog) it is sub-pixel.
  - I cannot find a wand in 05 or 08, although the manifest says 05 shows them "the way through".
  - Physics returns a skier who goes over the rim (developer claim), so the risk is readability, not death.
- **Fix:** scallop the lip with noise along z, add a soft cast shadow under the lip, and make the wands thicker or give them a fog-exempt reflective tip like the lamps.

### 8. MINOR: trail lamps are not amber and do not pulse in sequence

- **The colour.** The header claims "amber racing-line lamps that pulse slowly in sequence down the hill, which also shows the direction" (`scenery.ts:4-8`).
  - The colour is `[1.0, 0.62, 0.18]` (`scenery.ts:156`), drawn additive (line 168) over a near-white background, so it saturates to white.
  - In 01, 05 and 19 the lamps read white, with at most a warm fringe.
- **The pulse.** All lamps share one `sin(time·2.2)` (`scenery.ts:219-222`). The per-lamp `phase` array is filled (line 159) but never read, so there is no chase sequence and no direction cue.
- **Fix:**
  - Use normal alpha blending with a saturated core, or a darker halo ring, so the amber survives the grey.
  - Drive the size and opacity per vertex from `phase`.

### 9. MINOR: wind drifts look like slabs

- In 02 (x 700–770, y 400–412) and 03 (x 790–1000, y 425–460), drifts read as flat raised plates with straight hard edges and a bright, uniform top. They do not look like sculpted, wind-loaded mounds with sastrugi.
- **Fix:** add an asymmetric profile (a long windward ramp and a short, steep, shaded lee), feather the edges into the terrain, and add surface sastrugi.

### 10. MINOR: lighting continuity between the cave and the chase

- 12–14 are graded deep blue-black and dusky. One cut later, 15 shows a bright, high-key overcast at the same moment and the same place.
- The cave interior can be dark, but 12's *exterior* rock and sky are graded as dusk, while 15's are midday. The cut reads as a time jump.
- **Fix:** match the exterior exposure across the encounter, or carry the squall's darkening into 15.

### 11. MINOR: evidence and specification hygiene

- The manifest SHA (`6d0cdfa`) differs from the candidate. I verified that `src` is identical.
- `docs/BIOMES.md` has no Whiteout section to review against.
- Several shot notes describe content that is absent from their frames:
  - 05: "driving snow streaks … rim wands";
  - 13: "the squall rolling in";
  - 17: "silhouette in the snow";
  - 21: "door open, warm light";
  - 25: "storm breaking";
  - 26: "ridge revealed behind the station".

## What is good

- **The rescue station (20, 22)** has a strong, specific design: red timber, the "MOUNTAIN RESCUE · RIDGE STATION · 2,412 m" sign, icicles on the eave, a lattice mast with a windsock, a snowcat with its blade, and rescuers on the porch. It is the most distinct object in the location.
- **The Yeti model (13, 14, 23, 24):** good fur, a readable face and a strong rear silhouette with footprints in 24.
- **The snowball landing beam (18)** reads clearly through fog. This is the right language for storm readability.
- **The clearing sky (06, 07):** pink-lit broken cloud through blue gaps is the most atmospheric weather moment, apart from the deck artefacts.
- **The palette:** dark granite and cool krummholz palette distinguishes Whiteout from Alpine's warmer rock and dense forest.
- **HUD support:** the STORM / STORM IN 3 s / CLEARING pill and the captions telegraph each phase well.

## What would raise each owned score to 9

**Category 1, Visual art direction (5 → 9):**
1. A storm that reads as a whiteout through contrast collapse, a near-field veil and visible driven snow, not through distance fog (Finding 1).
2. No planar or card artefacts in the sky: a soft-bottomed volumetric storm wall, deck alpha faded at grazing angles, smoothed ranges (Finding 2).
3. Victory light beats with real value contrast: a darker finish storm, glowing lantern, visible searchlight cone and light pools, and the Yeti hidden until his beat (Finding 4).
4. Fixes for the cornice, drifts and lamps (Findings 7–9).
5. Re-captured evidence where every note matches its frame, on the candidate SHA.

**Category 2, Environmental uniqueness (6 → 9):**
1. Exposure that reads from the gameplay camera: the void and the cornice in frame at regular intervals, and a readable valley floor and ranges below the horizon in clear windows (Finding 3).
2. A Whiteout-specific cave and a perceptible squall (Finding 6).
3. A storm that is unmistakably not Alpine overcast (Finding 1). Side-by-side gameplay frames of Alpine, Fjord and Whiteout should be identifiable without the HUD.

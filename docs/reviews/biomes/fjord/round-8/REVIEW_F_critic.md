# Fjord Coast, round 8: Reviewer F (Hostile Game Critic)

- **Reviewer:** F, Hostile Game Critic
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `d1f642b` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`)
- **Date:** 2026-11-13
- **Evidence used**
  - All 36 1920×1080 PNGs in `round-8/candidate/`: the key frames viewed full size (`01`, `06`, `08`, `08c`, `08d`, `11`, `11c`, `11h`, `16`), the rest as half-size contact sheets (`scratch/review-f-r8/s1.png`–`s7.png`). Alpine baseline contact sheet `alp.png`.
  - Crops and before/after pairs (round 7 on top, round 8 below) in `scratch/review-f-r8/`: `cmp06_wall.png`, `crop06_crest.png`, `cmp01_island.png`, `cmp11c_wall.png`, `crop11c_wall.png`, `crop08c_gulls.png`, `crop15_title.png`.
  - Pixel difference round 7 → round 8 for every shot (`diff.py`: mean absolute luma difference / share of pixels changing by more than 20).
  - Source diff `7b0a5bc..d1f642b` (15 files: `cliffKit.ts`, `rockMaterial.ts`, `scanIslands.ts`, `scanModels.ts`, `snowMaterial.ts`, `harbour.ts`, `buildings.ts`, `seaCaveCinematic.ts`, `seaFraming.ts`, `App.ts`, `fjord_reveal.test.ts`, `tools/biome_evidence.mjs`, three deleted `.skm`). `round-8/DEFECTS.md` and `EVIDENCE.md` treated as claims.
  - **Headless gameplay re-run:** my round-6/7 harness unchanged (`scratch/review-f-r8/wind.test.ts`), seeds `CRITG01`–`06`, Normal Sprint, Fjord and Alpine, drivers `read`/`wrong`/`skilled` (30 runs, `critg_normal.jsonl`).
  - `npx vitest run tests/unit/pin_rescue.test.ts tests/unit/fjord_gameplay.test.ts tests/unit/fjord_art.test.ts tests/unit/fjord_reveal.test.ts`.
  - `round-8/candidate/perf/frames_{fjord,alpine}_high.json` (appeared during the review; see the caveat under Performance).
- **Not available when I wrote this** (I waited ~25 min and re-checked): `round-8/TESTS.md`, `candidate/standard/`, `candidate/res-2560/`, and all of `res-1366/` except `01` and `02`. I did not read the other round-8 reviews.

## Verdict: FAIL against the 9/10 target. My Overall (8.5) meets the public-preview threshold (≥ 8).

**Overall player experience: 8.5 / 10 (up from 8).**

In round 7 I named three things holding the Overall at 8: the hero cliff and the reveal wall (pinstripe, white slab, white streaks), the empty gull beat, and the Sprint difficulty ladder. On screen, the first two are fixed. The pinstripe across the hero wall in `06` is gone (`cmp06_wall.png`), and so is the folded white slab and its "whale" skerry. The crumpled white ribbon on the menu sea is now a proper scanned boulder island (`cmp01_island.png`). The white streaks down the headland under "YOU REACHED THE SEA" are gone (`cmp11c_wall.png`). The gull shot `08c` now has gulls in it, lifting off the boulders, with the Yeti a dark shape in the mouth behind them. That is a good piece of foreshadowing.

A player who loves the Alpine run now gets, on Sprint and Standard, a coast run that is its own place from the menu to the harbour. It is not a reskin. Every frame from `01` to `11j` has sea, islands, a sea cave or a harbour that Alpine does not have (compare `alp.png`).

It is not a 9, and I am not rounding up:
1. **The gameplay is bit-identical to round 7** (30/30 runs, max |Δt| = 0.00 s). The Fjord's "2/5" difficulty step over Alpine on Sprint is still smaller than seed noise (F-039, open).
2. **The final image of the run is still the weakest hero frame.** In `11c` the white streaks have become a flat grey curtain with a vertical smear. The snowfield above it is stepped in horizontal contour terraces, and there is a crater ring in it (`crop11c_wall.png`).
3. **The fixes expose cruder assets.** The gulls in `08c`, now close to the lens, are ball heads with single-plane blade wings (`crop08c_gulls.png`). The hero wall in `06` is now a featureless putty-grey sheet: the stripes are gone, but there is no rock structure in their place. The horn crests above it are terraced in snow/grey bands (`crop06_crest.png`).
4. **The Expedition middle reads close to Alpine.** `16` (z 5379, "beside fjord arm 1") shows a snowy valley with a grey sliver of water.
5. **New evidence of an unreadable rule.** The cornice-relocation instruction in `15` ("Keep inside the cairns along the cliff") is white hairline text on a pale sky: I measured about 1.1:1 contrast.

These are real, but none breaks the experience. The location has crossed from "good with visible blockout" to "good with polish debt". That is 8.5.

## Scores

| Category | R7 | **R8** | Justification |
|---|---:|---:|---|
| Visual art direction | 7.5 | **8** | **Gains:** the named §4 failures I cited in round 7 are gone from the hero views: pinstripe and slab (`06`, 11.5 % of pixels changed), the menu ribbon (`01`), the white streaks (`11c`). **Remaining:** a featureless grey wall and terraced horn crests (`06`); a terraced snowfield and a smeared grey curtain in the closing reveal (`11c`); primitive boxes on the plaza (`11`, `11d`); a hard cylindrical splash rim (`11h`); perched boulders (`08`); straight streaks on the menu sea (`01`). Low-moderate confidence (A's primary). |
| Environmental uniqueness | 8.5 | **8.5** | The archipelago, the sea cave above the fjord and the harbour remain this location's own. The waterfront steps a little now (`10`). Held back by the Alpine-like Expedition middle (`16`) and the start that still uses Alpine's composition with the sugarloaf blocking the sea (`02`, F-029 open). |
| Skiing and hazard mechanics | 7.5 | **7.5** | No change: the only non-art source change since round 7 is a debug hook in `App.ts:1070`. My re-run is bit-identical (30/30). The wind gate is still a real decision (the wrong side costs about +3.9 s per Normal Sprint, round-5/6/7 data). Gate deserts and plate outcrops (`04b`, `09d`) are unchanged. |
| Difficulty and fairness | 7.5 | **7.5** | Unchanged code. The Fjord is faster than Alpine on 9/24 Normal Sprint seeds (data still valid). Hard Standard is still tight. The pin-rescue test passes. |
| Cinematics | 8 | **8** | **Up:** the gull beat has gulls, framed against the mouth with the Yeti inside (`08c`); `08`, `08b`, `08d` and `11` remain strong. **Held:** the gulls are crude at that range; the closing reveal `11c` is weak (terraces, smear); the trophy still covers the presenter's head (`11g`); the splash rim (`11h`) is unchanged. The new `coastalReveal` (`seaFraming.ts:188-206`) is unevidenced because `standard/` is absent, and the tracker admits the cave is still not in the reveal (F-038). Partly C's area. |
| Performance and stability | 7 (lc) | **7 (lc)** | **Low confidence.** `perf/` (CPU-side): Fjord mean 4.00 ms against Alpine 2.19 ms, and 55 frames over 16 ms against 4 per 16 km. **However, the Fjord run (13:38:57–13:47:19) overlapped my own harness and vitest runs (load average 8.5 on 2 CPUs), so it is contaminated and not comparable.** The Alpine run overlapped them less. No errors or hangs in my runs. Fewer assets are shipped this round (three `.skm` removed). |
| Accessibility and controls | 7.5 (lc) | **7 (lc)** | **Low confidence.** **New evidence:** in `15` the relocation instruction is about 1.1:1 against the sky (`crop15_title.png`), and the caption pill does not repeat the rule. Elsewhere captions sit on legible pills (`08c`, `08d`, `09`, `11f2`), and the menu shows keyboard and pad glyphs. `TESTS.md`, most of `res-1366` and all of `res-2560` are absent. |
| **Overall player experience** | 8 | **8.5** | Two of my three round-7 blockers are fixed on screen, and the first and last impressions are cleaner. What keeps it from 9: a difficulty step lost in seed noise, a closing reveal that is still the weakest hero frame, and cruder close-up assets now exposed. |

## My measurements

### Pixel change, round 7 → round 8

| Shot | Change | Reading |
|---|---|---|
| `08c` | 46.6 / 60.5 % | New framing: gulls lifting off the boulder crowns, the mouth and the Yeti behind |
| `06` | 8.5 / 11.5 % | Pinstripe gone, slab and "whale" gone; the wall is now plain grey (`cmp06_wall.png`) |
| `11b`, `11f`, `11f2`, `11h`, `11j`, `11i` | 6–10 / 10–11 % | Waterfront rebuilt (stepped fronts, roof colours: the roofs mostly read snow-white at these angles) |
| `11c` | 4.3 / 8.1 % | White streaks gone; a grey curtain with a vertical smear in their place (`cmp11c_wall.png`) |
| `01` | 4.0 / 4.2 % | Ribbon island replaced by a boulder scan; the sea streaks are unchanged (`cmp01_island.png`) |
| `05`, `10`, `10b` | 4–5 / 4–7 % | Steep coast faces are now rock; seeps are grey |
| `07`, `07b`, `08`, `08b` | ≤ 0.6 / ≤ 0.7 % | Unchanged (perched boulders, the `07b` wedge) |

### Gameplay

- Diff of `src/physics`, `src/game`, `src/world/hazards`, `profile.ts`, `course.ts`, `src/yeti` and `coast.ts` since `7b0a5bc`: one line, a debug `__THREE` export (`src/game/App.ts:1070`).
- Re-run: 30/30 runs identical to round 7 (all victories, 1 crash in total, max |Δt| = 0.00 s). Every round-5–7 gameplay figure stands:
  - Normal Sprint, 24 seeds: F − A mean +4.6 s, but the Fjord is faster on 9/24.
  - Wrong side of the wind gate: +3.9 s.
  - Hard Standard, Fjord skilled driver: 2/4 wins, against 4/4 on Alpine.

### Tests

- The four Fjord test files together gave **25/26**: one `fjord_gameplay.test.ts` test failed. It is the one starting at line 432 ("the environment costs a hazard-blind skier more time…").
  - That run coincided with the perf capture (load average 8.5 on 2 CPUs).
  - Re-run alone, `fjord_gameplay.test.ts` passed 14/14.
  - I did not capture the failure message, so I cannot say whether it was the 60 s `testTimeout` or an assertion.
  - Treat it as a possible load-sensitive flake until `TESTS.md` shows a clean full run.

## Defects

### D1. Major: the Sprint ladder is still within seed noise (round-6 D4, round-7 D3; F-039 OPEN)

**Evidence:** the gameplay is bit-identical (30/30 runs). The Fjord is faster than Alpine on 9/24 Normal Sprint seeds, and F − A ranges from −10 to +20 s.

**Fix:** use a per-course gate and squall floor, or calibrate pace against the Alpine course built from the same seed, so that F − A > 0 on at least 22/24 seeds. Add that as a unit test.

### D2. Major: the closing reveal is still the weakest hero frame (round-7 D1 residue; F-027 not fixed, F-028 partial)

**Evidence** (`11c`, the last image before the results, under "YOU REACHED THE SEA"):
- **The white streaks are gone** (`cmp11c_wall.png`).
- **In their place:** the lower headland (about 1500–1920 × 760–960) is a flat grey sheet. It has a vertical smear at about 1530 × 800–900, the "stretched texture" failure.
- **Terraces:** the snowfield above (1100–1920 × 300–750) is cut by regular horizontal contour terraces, with a crater-like ring at about 1260 × 500 (`crop11c_wall.png`).
- **Fluted wall:** the valley wall at about 690–1000 × 120–650 is fluted in vertical organ-pipe columns.
- **No ocean/mountain payoff:** the frame shows a blown-out heightfield, not the ocean-and-mountain reveal the completion brief asks the victory to end on.

**Fix:**
1. Re-aim the settled reveal so that the sea and the archipelago fill at least 40 % of the frame, with the harbour and the run in the third (as `08` does).
2. Smooth the terrain normals and hide the contour stepping at that distance.
3. Put the cliff kit, or the scan rock material, on the headland face instead of the heightfield.

### D3. Major (accessibility, low confidence on reach): the cornice relocation rule is unreadable (new evidence)

**Evidence**
- In `15_cornice_relocation.png`, the subtitle under "BACK ON THE PISTE" reads "You went over the cornice. Keep inside the cairns along the cliff." It is thin white text over a pale sky.
- Measured on the text row (y 275–292, x 1290–1600): peak luminance 0.60 against background 0.56, about **1.07:1**.
- The caption pill says "[you tumble over the cornice — back on the piste]". It does not give the rule.
- This is the one place the game tells the player how to avoid the cornice.

**Fix:** put the subtitle on the same dark pill as the captions, at ≥ 4.5:1, or add "keep inside the cairns" to the caption.

### D4. Minor: the fixes expose crude assets (`08c` gulls, `06` wall)

**Evidence**
- `crop08c_gulls.png`: at this range the gulls are a faceted ball head, a cylinder body and two single-plane blade wings with dark tips. The upper-right gull's body hangs vertically.
- `cmp06_wall.png`: the hero wall is now plain putty-grey, without joints or ledges, apart from the snow benches.
- `crop06_crest.png`: the horn crests are banded in horizontal snow/grey terraces.

**Fix:**
- Gulls: give them a two-segment wing with a little camber and a flap cycle, or keep the camera ~4 m further back so they read at 30–60 px.
- Wall: restore rock structure at mid-distance with the scan rock normal and the macro at ~70 m, which the shader already has (`rockMaterial.ts:313-316`). The structure needs to survive the band fade.

### D5. Minor: Expedition's middle reads Alpine (new evidence)

**Evidence:** `16_expedition_arm.png` (z 5379, "beside fjord arm 1") shows a snowy valley with tree lines and scattered generic rocks. The only sea is a grey sliver at about 1280–1560 × 580–620. With the HUD hidden, this frame could be Alpine.

**Fix:** keep a sea or island sightline within the chase camera's view every ~1 km on long courses, by bending the arm closer or by lowering the near bank.

### D6. Minor: cave boulders perch on the snow (round-7 D4; F-040 OPEN)

`08` is unchanged: dark undersides, no collar. The left foreground boulder in `08` (about 420–580 × 740–860) still looks set down on the snow.

### D7. Minor: the trophy hides the presenter's head (round-7 D6; F-042 OPEN)

`11g` is unchanged in staging.

### D8. Minor: hard cylindrical splash rim (round-7 D7; F-042 OPEN)

`11h`: the crown is still a straight-walled cylinder with a hard bottom edge.

### D9. Minor: waterfront and plaza (round-7 D8; F-032 partial)

- **Improved:** the fronts step, and some buildings turn their eaves (`10`).
- **Roofs:** the new roof colours are almost invisible, because every roof carries a snow cap in `10`, `11h` and `11j`.
- **Plaza:** the untextured box row and the orange ball are unchanged (`11`, `11d`, `11g`).
- **Chips:** the repeated dark chips on the inland wall are unchanged (`11h`, `11j`).

### D10. Minor: start composition and sugarloaf (round-7 D9; F-029 OPEN)

`02` is unchanged (0.5 %).

### D11. Minor: straight streaks on the menu sea (round-7 D10)

`01` (about 880–1700 × 430–950): the parallel bright bars are unchanged. The first image a player sees.

### D12. Minor: scoured-rock outcrops are flat plates (round-7 D11)

`04b`, `09d` and `09b` are unchanged.

### D13. Minor: gate deserts, Hard Standard tightness, the gimme achievement (round-7 D12)

Unchanged code.

### D14. Minor: the hard translucent wedge in the cave outlook (round-7 D13)

`07b` is unchanged (0.4 %): the pale vertical quad over the slope at about 1430–1520 × 640–860 of the right half, and the blocky shadow.

### D15. Minor: hamlet strand reads as a bright wedge (F-041 OPEN)

`06`, about 520–740 × 755–835. It is confirmed, and it is now the brightest manufactured shape in the frame.

### D16. Minor (process): evidence incomplete, perf run contaminated

- `TESTS.md`, `standard/`, `res-2560/` and most of `res-1366/` are absent.
- My CPU load overlapped the Fjord perf capture. **Re-run `perf/` on an idle machine** before D, or anyone, reads Fjord against Alpine from it.

## What works

- **The two sweeping views are clean at last.** The hero cliff is no longer striped, and the menu sea no longer carries a paper island. The archipelago is now all boulder scans and reads as rock everywhere (`01`, `03`, `06`, `09`).
- **The gull beat is a real beat:** gulls rise off the rocks, and the Yeti is already in the dark of the mouth behind them. This is the best foreshadowing in the cave sequence.
- **`08`** (the Yeti at the iced mouth, with the fjord, islands and harbour behind) and the harbour finish, from the stockfish gag to the cannonball, remain the location's strongest material. Alpine has nothing like it.
- **The Critical stays fixed:** `pin_rescue` passes, there were 0 pins and all 30 of my runs won.

## Status of round-7 defects (my own verification)

| R7 # | Defect | Status | Evidence |
|---|---|---|---|
| D1 | Major: hero cliff and reveal wall (§4 failures) | **Partial.** Pinstripe, slab and white streaks are fixed. The `11c` terraces and smear and the `06` crest banding remain | `cmp06_wall.png`, `cmp11c_wall.png`; D2, D4 |
| D2 | Major: gull shot has no gulls | **Fixed** (crude gulls: D4) | `08c` |
| D3 | Major: Sprint ladder in seed noise | **Not fixed** | 30/30 identical runs (D1) |
| D4 | Minor: perched cave boulders | **Not fixed** | `08` (D6) |
| D5 | Minor: coastal reveal and Standard caves unevidenced | **Not verifiable.** `standard/` is absent. `coastalReveal` now steps out over the water and refuses dry poses; the unit test passes | `seaFraming.ts:188-206` |
| D6 | Minor: trophy hides head | **Not fixed** | `11g` (D7) |
| D7 | Minor: splash rim | **Not fixed** | `11h` (D8) |
| D8 | Minor: regimented waterfront | **Partial** | `10` (D9) |
| D9 | Minor: start and sugarloaf | **Not fixed** | `02` (D10) |
| D10 | Minor: menu sea streaks | **Not fixed** | `01` (D11) |
| D11 | Minor: scoured plates | **Not fixed** | `04b` (D12) |
| D12 | Minor: deserts, Hard Standard, gimme | **Not fixed** | Unchanged code |
| D13 | Minor: wedge in `07b` | **Not fixed** | `07b` (D14) |
| D14 | Minor (process): incomplete evidence | **Partial.** `EVIDENCE.md`, the manifest, `12`, `12b` and `14` are present now; `TESTS.md`, `standard/` and `res-*` are not | D16 |

## Status of tracker items in my area (my verification)

| ID | Status |
|---|---|
| F-021 (pinned skier) | **Fixed as far as I can test:** `pin_rescue` passes; 0 pins in 30 runs |
| F-022 (Hard step) | **Partial:** Sprint fixed; Hard Standard unchanged |
| F-024 (sea in Standard cave shots) | **Cannot verify** (`standard/` absent) |
| F-026 (cliff pinstripe) | **Fixed on screen** (`06`). The harness reasoning holds: `freeCam` is applied in `App.ts:822-825` after the world update, and `settle()` now hands the scenery the camera. The real shader and mesh changes (`rockMaterial.ts:312-316`, `snowMaterial.ts:86`, `cliffKit.ts:133`) would also remove stripes at the middle LOD a player can see (`09d`, `14` show none) |
| F-027 (needle walls in the reveal) | **Not fixed:** fluted columns at `11c` 690–1000 px; terraced crests in `06` |
| F-028 (white streaks on a vertical face) | **Fixed as stated, but replaced by a grey smear** (`cmp11c_wall.png`; D2) |
| F-029 (sugarloaf) | **Not fixed** |
| F-030 (scoured rock) | **Partial:** textured, still plates |
| F-032 (houses, chips, waterfront) | **Partial:** fronts stepped; chips and plaza boxes remain |
| F-035 (squall warning mid-gust) | **Not verified** (code unchanged) |
| F-036 (white slab and menu ribbon) | **Fixed** (`cmp01_island.png`, `cmp06_wall.png`; `scanIslands.ts:22-39` ships only boulder scans) |
| F-037 (gull beat) | **Fixed** (`08c`; `seaCaveCinematic.ts:162-170`) |
| F-038 (coastal reveal) | **Partial / unevidenced:** the code refuses dry or buried poses; there is no screenshot, and the cave is not in the reveal |
| F-039 (Sprint ladder) | **Not fixed** (D1) |
| F-040 (boulder collars) | **Not fixed** (D6) |
| F-041 (hamlet strand) | **Not fixed** (D15) |
| F-042 (victory details) | **Not fixed** (D7, D8, D9) |

## Public-preview gate (completion brief §10), for my area

| Item | Status | Evidence |
|---|---|---|
| Hostile-critic Overall ≥ 8 | **Met: 8.5** | Scores above |
| No critical gameplay or physics defects; no unrecoverable states | **Met as far as I tested** | 0 pins, 30/30 won; `pin_rescue` passes |
| All finite lengths completable | **Met for Sprint** (this round) and **Standard** (unchanged code, round-5 runs). Longer lengths not run by me | `critg_normal.jsonl` |
| No major regression in a signature cinematic | **Met.** The cave cinematic gained its gull beat back; the victory is unchanged or better | `08c`, `11` |
| All automated tests pass | **Not verified.** 25/26 under heavy load (one `fjord_gameplay` test failed, cause not captured); 14/14 for that file alone. `TESTS.md` absent | Tests above |
| No major performance regression | **Cannot verify.** `perf/` exists, but my load contaminated the Fjord run | D16 |
| Menus at three resolutions | **Cannot verify** (`res-2560` absent, `res-1366` partial) | |
| Art direction ≥ 8 | **Met on my reading (8)**; Reviewer A's score is the gate figure | Scores above |

**Gate result for my area:** the critic threshold is met. The gate as a whole cannot be declared met until `TESTS.md` shows a clean full run, the perf run is repeated on an idle machine, and the resolution sets are in.

**Path to 9** (full approval):
1. Put a floor under the Sprint ladder (D1).
2. Rebuild the closing reveal as a sea-and-mountain payoff (D2).
3. Make the relocation rule legible (D3).
4. Gulls that survive a close-up, and rock structure back on the hero wall (D4).
5. Snow collars on the cave boulders (D6).
6. Fix the menu-sea streaks and the sugarloaf, the first two images a player sees (D10, D11).

# Fjord Coast, round 6: Reviewer F (Hostile Game Critic)

- **Reviewer:** F, Hostile Game Critic
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `5c28419` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`)
- **Date:** 2026-11-13
- **Evidence used:**
  - All 32 1920×1080 PNGs in `round-6/candidate/` (`01`–`12`), viewed as half-size contact sheets (`scratch/review-f-r6/s1`–`s5.png`) and full-size crops. Crops: `crop07_boulders.png`, `crop07_post.png`, `crop08.png`, `crop08b.png`, `crop07b_wedge.png`, `crop11_chips.png`, `zoom09_islands.png`, and `cmp03_islands.png` (round 5 above round 6).
  - I compared them with `round-5/candidate/` and with my round-4 and round-5 notes (round 3 `final/` and the Alpine baseline).
  - Pixel differences between round 5 and round 6 (mean absolute luma / share of pixels changing by more than 20), quoted below.
  - **Headless gameplay re-run:** my round-5 harness (`scratch/review-f-r6/wind.test.ts`, copied unchanged) on seeds `CRITG01`–`12`, Normal Sprint, Fjord and Alpine, drivers `read`, `cue`, `ignore`, `wrong` and `skilled` (84 runs, `critg_normal.jsonl`).
  - `npx vitest run tests/unit/pin_rescue.test.ts tests/unit/fjord_gameplay.test.ts tests/unit/fjord_art.test.ts`: **25/25 pass.**
  - Source diff `e2ce964..5c28419` (`seaCave.ts`, `scanIslands.ts`, `scanModels.ts`, `coast.ts`, `harbourVictory.ts`, `seaFraming.ts`) and `DEFECTS.md`. I treated both as claims to check.
- **Not available when I wrote this:** `candidate/EVIDENCE.md`, `manifest*.json`, `res-1366/`, `res-2560/`, `standard/`, `perf/` and `round-6/TESTS.md` did not exist. I have not read any other round-6 review.

## Verdict: FAIL (against the 9/10 target, and below the public-preview gate)

**Overall player experience: 7.5 / 10, unchanged, but now close to 8.**

The method change worked where it was applied.
- **The islands are fixed in kind, not in degree.** The saucers and loaves are gone. `03`, `04`, `05`, `09`, `09d` and `12` now show craggy, faceted, irregular rock islands and skerries, with snow only on the tops (`cmp03_islands.png`, `zoom09_islands.png`). The player looks at this backdrop for the whole descent, so this is the largest visible gain since round 3.
- **The cave's prism field is gone.** It is replaced by scanned boulders that read as rock.

Three things still hold the Overall below 8:
- **A lone basalt column stands in front of the cave face like a monolith** (`07`, `08`, `08c`). Around the boulders lie grey, flat-shaded hex "drums" and stick-like fish bones. The Yeti's introduction is still not clean.
- **The catch shot (`11`) regressed.** The "−right" fix now frames a dark, smeared mountainside and the houses, with rock chips that appear to hang in the air. There is no sea in the frame.
- **Neither the cliff hero view nor the gameplay changed.**
  - Cliff hero view `06`: 0.1 % of pixels changed.
  - Gameplay: 60/60 overlapping runs give the same results as round 5, to the hundredth of a second. So the Sprint difficulty ladder is still smaller than seed noise.

A player who loves the Alpine run now gets a coastal run whose sea is properly a sea of rock islands. The two set pieces that bracket it (the Yeti's cave and the trophy) still carry blockout.

## Scores

| Category | R5 | **R6** | Justification |
|---|---:|---:|---|
| Visual art direction | 7 | **7.5** | **Gains:** the islands are now real rock silhouettes (03: 5.2 % of the island band changed; the shapes are new). The cave prism field and debris are gone. **Still there:** the monolith column and the untextured drums (`07`, `08`); the cliff in `06` is pixel-identical (pinstripe, needle crest, white apron); the menu sea streaks (`01`); a hard translucent wedge in `07b`; a muddy, smeared backdrop in `11`. |
| Environmental uniqueness | 8 | **8.5** | **Gain:** the scanned archipelago is the Fjord's own skyline; nothing in Alpine resembles `03` or `09`. **Still there:** the start (`02`) is Alpine's composition, with the sugarloaf in the middle of the sea view (0.8/255 change). |
| Skiing and hazard mechanics | 7.5 | **7.5** | Unchanged, bit for bit (60/60 identical runs). The wind gate is still a real decision (wrong side about +3.9 s per Normal Sprint over 24 seeds, from round 5). Gate deserts and flat scoured-rock plates (`04b`, `09c`, `12`) are unchanged. |
| Difficulty and fairness | 7.5 | **7.5** | Unchanged: the Fjord is faster than Alpine on 9/24 Normal Sprint seeds, and Hard Standard is tight. The pin rescue tests pass; 0 pins in 84 runs. Two crashes occurred in 84 runs, and every run won. |
| Cinematics | 7.5 | **7.5** | **Up:** with the prism field gone, `08b` (the Yeti leaping before the fjord and islands) is the best frame in the location. **Down:** the catch shot `11` looks inland at a dark smear, with chips hanging in the air; the monolith sits in `07`, `08` and `08c`. **Unchanged:** the trophy covers the presenter's head (`11g`, 0.6 % changed), the splash rim (`11h`, 0.3 %) and the stick gulls. On balance, flat. |
| Performance and stability | 7 (lc) | **7 (lc)** | **Low confidence.** There are no hangs or errors in my runs, and 25/25 targeted unit tests pass. `perf/` is absent. The islands add six 45 KB meshes plus per-water-level materials (`scanIslands.ts`), a modest cost that I could not measure. |
| Accessibility and controls | 7.5 (lc) | **7.5 (lc)** | **Low confidence.** The captions are legible on pills (`08c`, `08d`, `09`, `09d`, `11f2`), and the menu shows keyboard and pad glyphs (`01`). `TESTS.md` and the resolution sets are absent. |
| **Overall player experience** | 7.5 | **7.5** | Better than any earlier round: the sea finally looks right for the whole run, and the cave reads as rock. But the Yeti's introduction still has an inexplicable monolith and blockout drums, the trophy beat regressed to an inland smear, and the location's "2/5" claim still loses to seed noise on Sprint. I do not round up. |

## My measurements

### Gameplay is unchanged

`critg_normal.jsonl`: 60 runs overlap with round 5 (same seed, biome and driver), and all 60 have the same time and outcome (max |Δt| = 0.00 s).
- The `src/physics`, `src/game`, `src/world/hazards`, `profile.ts`, `course.ts` and `src/yeti` diffs since `e2ce964` are empty.
- The `coast.ts` changes (island shoal at −8 m; cliff-foot lumps off) are offshore and do not touch the course.
- **So every round-5 gameplay figure stands.** Normal Sprint over 24 seeds: F − A mean +4.6 s; Fjord faster on 9/24; wrong side +3.9 s; ignoring the wind +2.3 s. Hard Standard: Fjord skilled 2/4 against Alpine 4/4.

### Pixel change, round 5 → round 6

Mean absolute luma difference / share of pixels changing by more than 20:

| Region | Change | Reading |
|---|---|---|
| `03` island band (y 250–560) | 3.6 / 5.2 % | **Real change.** The islands are small in frame, but every one is a new shape (`cmp03_islands.png`). |
| `09` islands (900–1920 × 360–460) | 3.3 / 4.8 % | Real change |
| `04` islands | 2.6 / 4.3 % | Real change |
| `09d` islands | 6.6 / 9.5 % | Real change |
| `07` (whole frame) | 9.7 / 13.4 % | The prism field was removed |
| `08` | 23.4 / 34.2 % | New camera and new dressing |
| `08d` | 11.6 / 13.3 % | |
| `11` (catch shot) | 42.4 / 60.7 % | New camera; regressed (D3) |
| `06` cliff wall / crest | 0.3 / 0.1 % and 0.0 / 0.0 % | **Unchanged** |
| `05` islands band | 0.0 / 0.0 % | **Unchanged.** Odd for a shot full of islands; check the capture or the island streaming at that camera |
| `01` sea | 1.8 / 3.3 % | Streaks unchanged |
| `02`, `10`, `11c`, `11d`, `11i`, `12` | all < 1.3 % | Unchanged |
| `11g`, `11h`, `11j` | all < 0.6 % | Unchanged |

**Cave darkness** (share of pixels with luma < 20):

| Shot | Round 5 | Round 6 |
|---|---|---|
| `07` | 0.043 | 0.052 |
| `08` | 0.24 | 0.28 |
| `08c` | 0.151 | 0.342 |
| `08d` | 0.482 | 0.604 |

All are still readable in the shots. `08d` is now 60 % near-black, though the Yeti and the roar caption remain legible.

## Defects

### D1. Major: the Yeti's introduction still carries blockout props (round-5 D1, partial)

**Evidence**
- **`07`** (`crop07_post.png`, about 1225–1280 × 400–690). A single tall, square-ended grey column stands free in front of the cave face. It is the only survivor of the "portal colonnade" (`seaCave.ts`, around lines 423–440: up to 8 columns per side). On screen it reads as a monolith or a post, not as basalt.
- **`08`** (about 1640–1790 × 500–740). The same column, now visibly tilted, leans against the face beside the Yeti.
- **`08c`** (about 715–760 × 370–480). The same column again.
- **`07` and `08`** (`crop07_boulders.png`, `crop08.png`, about 790–870 × 690–860 in `08`). Grey, flat-shaded hex "drums" (`seaCave.ts` around line 410, "fallen drums") sit next to the textured scans. One is a lone card-like quad (`crop07_boulders`, 80–120 × 185–220). Next to real rock they read as untextured primitives.
- **`08`** (about 910–1040 × 800–830). The fish bones (thin cylinders) read as white stick figures or tiny aerials on the snow.
- **The scanned boulders sit on the snow rather than in it.** Their dark undersides show, with no drift lip and no contact darkening (`crop08.png`, upper left; `crop08b.png`). The code sinks them by only 0.35 r (`p.y = gy - r * 0.35`, with model height 0.9–1.4 r).

**Fix**
- Delete the portal colonnade where it yields fewer than 3 columns per side, or seat them flush in the face (back-offset ≥ r).
- Remove the drums, or replace them with a scanned boulder.
- Remove the fish bones, or make them legible (one skeleton by the tide pool, larger).
- Sink the boulders to about 50 % and add a snow drift collar or AO decal.

### D2. Major: the cliff hero view is untouched (round-5 D3, not fixed; F-026, F-027 and F-028 claims not borne out on screen)

**Evidence:** in `06`, the wall changed 0.1 % and the crest 0.0 %. The pinstripe banding over the face, the needle crest (640–990 × 140–330), the thin white harbour apron (520–740 × 755–830) and the faceted shard at the bottom right are all still there.

The "bare rock on steep sea-facing walls" commit (`83e5ce4`) is not visible in `11c` either (0.8 %): its vertical white streaks are unchanged.

**Fix:** as in round 5. The island result shows the method that works: replace the hero cliff's procedural face with scan-derived cliff modules, or at least fade the bedding normal and detail completely beyond about 300 m and clamp the crest octave on this camera.

### D3. Major (regression): the catch shot now looks at a dark inland mountainside (F-025, regressed)

**Evidence:** `11`, full frame.
- The background is a dark-grey, low-detail smear of the slope (0–1100 × 120–600) plus the house row.
- No sea is visible anywhere.
- Boulder chips appear to hang in the dark sky (`crop11_chips.png`, 850–1000 × 120–210).
- A drying rack stands alone on the slope.

The round-5 shot at least showed houses. This one is a worse frame for the "never face inland" rule of completion brief §6. The change is the `right → −right` sign flip in `harbourVictory.ts` (around lines 158–164).

**Fix:** choose the side from the sea direction rather than by hand. Take the sign of `right · seaDir`, so the camera looks toward the water. Then re-capture `11`.

### D4. Major: the Alpine→Fjord ladder on Sprint is smaller than seed noise (round-5 D4, not fixed)

**Evidence:** gameplay is bit-identical to round 5 (60/60 runs). The round-5 figures stand: the Fjord is faster than Alpine on 9/24 Normal Sprint seeds; F − A ranges from −10 to +20 s; the Relaxed median on `CRITH` is −2.9 s.

**Fix:** as in round 5. Use a per-course gate and squall floor, or calibrate pace against the Alpine course built from the same seed. Target: F − A > 0 on at least 22/24 seeds.

### D5. Minor: gate deserts (round-5 D5, not fixed)

Unchanged code. 10/12 fresh Sprints have a gate-free stretch over 600 m.

### D6. Minor: Hard Standard is tight (round-5 D6, not fixed)

Unchanged code. Fjord skilled wins 2/4, against 4/4 on Alpine.

### D7. Minor: the waterfront is regimented (round-5 D7, F-032 OPEN)

`11h` and `11j` changed by less than 0.3 %. The same row of identical gables remains.

### D8. Minor: the start composition is Alpine's, and the sugarloaf blocks the sea (round-5 D8, F-029 OPEN)

`02` is unchanged (0.8/255).

### D9. Minor: the trophy hides the presenter's head (round-5 D9)

`11g` is unchanged (0.6 %).

### D10. Minor: stick gulls (round-5 D10)

`08c` is unchanged (1.3 %).

### D11. Minor: the splash crown has a hard cylindrical rim (round-5 D11)

`11h` is unchanged.

### D12. Minor: ruler-straight streaks on the menu sea (round-5 D12)

`01`, 900–1700 × 650–950: still parallel bright bars (3.3 % changed).

### D13. Minor: the only Fjord achievement is a gimme (round-5 D13)

Unchanged code. The first viewpoint is at z 135–187.

### D14. Minor: the scoured-rock gate outcrops are flat plates (round-5 D14)

`04b`, `09c` and `12` are unchanged (0.6–0.9 %). This is now more glaring, because the islands nearby are proper 3D scans. Use the same scans (`namaqualand_boulders_01`) for these outcrops.

### D15. Minor: a hard translucent wedge in the cave outlook (round-5 D15, not fixed)

**Evidence:** `07b` (`crop07b_wedge.png`, full frame about 900–1130 × 200–640). A pale, hard-edged quad with a straight top and a curved side lies across the slope. Above it is visibly blocky shadow-map stepping.

**Fix:** feather or remove the quad, and raise the shadow resolution for this shot.

### D16. Minor (process): the evidence set is incomplete again at review time

`EVIDENCE.md`, the manifests, `standard/`, `res-*`, `perf/` and `TESTS.md` are absent. I cannot verify F-024 (the Standard-course cave), F-033 (perf) or the resolutions.

### D17. Minor (new): `05` shows no island change

**Evidence:** the `05` island band is pixel-identical to round 5 (0.0 %), although `03`, `04` and `09` changed.

This means one of two things: the `05` capture predates the scans, or this camera's window misses the island streaming (`ScanIslands.want(z - 2500, … + 6000)` and the asynchronous load, `this.win = [1, 0]` after a fetch). If it is the second, players at some positions see the old shoal-less sea or popping islands.

**Fix:** confirm from the manifest. If it is streaming, preload before the first frame (the commit message says "scans preloaded"; verify that this covers the menu and early-course cameras).

## What works

- **The islands.** This is the first round in which the archipelago looks like the brief: irregular, glaciated rock with snow only on the upper surfaces, varied in size and grouping (`03`, `09`, `09d`, `12`). The methodology change is vindicated.
- **The cave reads as a rock mass.** The scanned boulders are a real improvement over the prism field and the hull debris. `08b` (the Yeti mid-leap, with the fjord and islands behind) is the location's hero frame.
- **The Critical stays fixed.** 25/25 targeted tests pass, and there were no pins in my runs.
- **The wind read is still a real decision**, and the harbour finish (`10b`, `11b`, `11e`/`11f2`, `11c`) is still charming.

## Status of round-5 defects (my own verification)

| R5 # | Defect | Status | Evidence |
|---|---|---|---|
| D1 | Major: cave blockout | **Partial** | Prisms, hull and logs are gone. The monolith column, drums and perched boulders remain (D1). |
| D2 | Major: saucer islands | **Fixed** | `cmp03_islands.png`, `zoom09_islands.png`; change measured in `03`, `04`, `09`, `09d`. Caveat: `05` is unchanged (D17). |
| D3 | Major: cliff hero view | **Not fixed** | `06`: 0.1 % / 0.0 % (D2) |
| D4 | Major: Sprint ladder | **Not fixed** | Bit-identical gameplay (D4) |
| D5 | Minor: gate deserts | **Not fixed** | D5 |
| D6 | Minor: Hard Standard | **Not fixed** | D6 |
| D7 | Minor: waterfront | **Not fixed** | D7 |
| D8 | Minor: start, sugarloaf | **Not fixed** | D8 |
| D9 | Minor: trophy hides head | **Not fixed** | D9 |
| D10 | Minor: gulls | **Not fixed** | D10 |
| D11 | Minor: splash rim | **Not fixed** | D11 |
| D12 | Minor: menu sea streaks | **Not fixed** | D12 |
| D13 | Minor: gimme achievement | **Not fixed** | D13 |
| D14 | Minor: scoured plates | **Not fixed** | D14 |
| D15 | Minor: sheet edge, wedge | **Not fixed** | `07b` (D15). `12` unchanged. |
| D16 | Minor (process): missing evidence | **Not fixed** | D16 |

## Status of tracker items in my area (by my verification)

| ID | Status |
|---|---|
| F-009 (islands) | **Fixed** by the scan method (D2 above) |
| F-021 (pinned skier, C) | **Fixed as far as I can test:** `pin_rescue` passes; 0 pins in 84 runs |
| F-022 (Hard step) | **Partial:** Sprint fixed; Hard Standard unchanged |
| F-023 (cave lintel, net, prisms) | **Partial:** the prisms are gone, but the colonnade remnant, drums and bones remain |
| F-024 (sea in Standard cave shots) | **Cannot verify:** `standard/` is absent |
| F-025 (catch shot inland) | **Regressed** (D3) |
| F-026 (cliff pinstripe) | **Not fixed** (`06` unchanged) |
| F-027 (needle walls) | **Not fixed** in `06`; `11c` and `11i` unchanged |
| F-028 (white streaks on a vertical face) | **Not fixed** (`11c` unchanged, despite `83e5ce4`) |
| F-029 (sugarloaf) | **Not fixed** |
| F-030 (scoured rock) | **Partial:** textured, but still plates |
| F-031 (foam and wet line) | **Partial.** The scan islands show a faint waterline (`zoom09_islands`). The `06` cliff foam is unchanged. |
| F-032 (repeated houses and chips) | **Not fixed.** Chips also appear to float in `11` |
| F-035 (squalls entered mid-gust get no warning) | **Not verified** (code unchanged) |

## Public-preview gate (completion brief §10), for my area

| Item | Status | Evidence |
|---|---|---|
| Hostile-critic Overall ≥ 8 | **Not met: 7.5** | Scores above |
| No critical gameplay or physics defects | **Met as far as I tested** | 25/25 tests; 84/84 runs won; 0 pins |
| All finite lengths completable | **Met for Sprint and Standard** (unchanged code; round-5 runs). Longer lengths not tested by me. | `critg_normal.jsonl`; round-5 `standard.jsonl` |
| Fjord is a worthy second location, not a reskin | **Met, more clearly than before** | `03`, `09`, `08b`, `11c` |
| Difficulty ladder Alpine < Fjord | **Not reliably met on Sprint** | D4 |
| No floating decorations or artificial rock stacks (§5) | **Not met** | D1: monolith and drums. D3: chips in the air in `11`. |
| Named §4 geological failures absent | **Not met** | Islands fixed; cliff (`06`) and white vertical streaks (`11c`) remain (D2) |
| No major regression in a signature cinematic | **Not met** | The victory catch shot regressed to an inland frame (D3) |
| All automated tests pass; performance; resolutions | **Cannot verify** | `TESTS.md`, `perf/` and the resolution sets are absent |

**Gate result: not met.**

**The shortest path to 8 is now short.** None of it carries gameplay risk except the last item.
1. Remove the lone portal column, the drums and the bones, and bed the boulders (D1).
2. Point the catch shot at the sea (D3).
3. Give the hero cliff the same scan treatment that fixed the islands (D2).
4. Put a floor under the Sprint ladder (D4).

With items 1–3 done and visible in a pixel-difference check against this round, I would expect to score the Overall at 8.

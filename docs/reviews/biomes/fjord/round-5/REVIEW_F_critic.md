# Fjord Coast, round 5: Reviewer F (Hostile Game Critic)

- **Reviewer:** F, Hostile Game Critic
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `e2ce964` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`; `git diff e2ce964 -- src tests` is empty)
- **Date:** 2026-11-12
- **Evidence used:**
  - Every 1920×1080 PNG in `round-5/candidate/` (32 shots, `01`–`12`), viewed in full or as half-size contact sheets with full-size crops. I compared them with `round-4/candidate/` and with my round-4 notes (round 3 `final/` and the Alpine baseline). Sheets and crops are in `scratch/review-f-r5/`: `s1`–`s4.png`, `crop11g.png`, `crop06_wall.png`, `crop07b_top.png`, `crop07_hull.png`, `crop12_edge.png` and `cmp03_islands.png`.
  - My own headless runs, using my round-4 harness copied unchanged except for paths (`scratch/review-f-r5/wind.test.ts`, `table.py`):
    - `sprint.jsonl`: 252 runs on **12 fresh seeds `CRITH01`–`12`**, never used before. Fjord and Alpine; Relaxed, Normal and Hard; drivers `read`, `cue`, `ignore`, `wrong` and `skilled`.
    - `critg_normal.jsonl`: 60 runs re-running my round-4 seeds `CRITG01`–`12` on Normal. This separates build effects from seed effects.
    - `standard.jsonl`: 48 Standard runs on 4 seeds, Normal and Hard.
    - `place.jsonl`: a placement survey of 12 Sprint and 12 Standard courses.
  - Pixel measurements and round-4 vs round-5 image differences (inline Python, figures quoted below).
  - `npx vitest run tests/unit/pin_rescue.test.ts tests/unit/fjord_gameplay.test.ts`: 18/18 pass.
  - `DEFECTS.md` (F-021 to F-035) and the `src/` diff `8d19542..e2ce964`. I treated both as claims to check.
- **Not available when I wrote this:**
  - `candidate/EVIDENCE.md`, `manifest*.json`, `res-1366/`, `res-2560/`, `standard/`, `perf/` and `round-5/TESTS.md` did not exist.
  - So I could not tie individual shots to a camera or phase from a manifest, and the Standard-course cave shots could not be judged.
  - I have not read any other round-5 review.

## Verdict: FAIL (against the 9/10 target, and below the public-preview gate)

**Overall player experience: 7.5 / 10, unchanged from round 4.**

What round 5 fixed:
- **The round-4 Critical (pinned skier) is fixed:** the unit tests pass, and none of my 360 runs ended pinned.
- **Two of the worst cave props are gone:** the floating lintel of hex blocks and the black net.
- **The Hard Sprint step is now sane:** on Hard Sprint, Fjord wins 11/12 with the reader and 10/12 with the skilled autopilot, against Alpine's 11/12.

But the three things I named in round 4 as "the shortest path to 8" are at best half-done:
- **The Yeti's introduction (`07`, `08`, `08b`, `08d`)** is still staged in front of flat-capped hexagonal prisms standing on bare snow, plus loose planks, a log and a hovering slab.
- **The near islands and the cliff hero view are, pixel for pixel, nearly the round-4 images.**
  - Island band of `03`: mean absolute difference 1.1/255; 1.8 % of pixels change by more than 20.
  - Cliff wall in `06`: 5.0/255, with 4.3 % of pixels changing.
  - Menu sea in `01`: 0.9/255.
  - The "crag islands", "foam line", "macro fade" and "softened crest" commits do not change what a player sees in these frames.
- **The Normal Sprint difficulty ladder is seed noise.** On 24 seeds, the Fjord is faster than Alpine on 9.

A player who loves the Alpine run gets a coastal run that is different and pleasant. It is still not finished at the Yeti's introduction or in the backdrop they stare at for the whole descent.

## Scores

| Category | R4 | **R5** | Justification |
|---|---:|---:|---|
| Visual art direction | 7 | **7** | **Gains:** the lintel blocks and the net are gone (`07` vs round-4 `07`). **Still there:** the prism field and the debris; saucer islands that are effectively unchanged (`03`, `04`, `09`); a pinstripe-banded cliff with spiky crests (`06`); white streaks on vertical walls (`11c`); ruler-straight streaks on the menu sea (`01`). |
| Environmental uniqueness | 8 | **8** | Every exterior frame says "coast": `09`, `04`, `03`, `09d`, `11c`. The start (`02`) still uses Alpine's composition of centre gate, hut lower right and rope line, and a sugarloaf blocks the sea view. |
| Skiing and hazard mechanics | 7.5 | **7.5** | **The wind gate is still a real decision** (24 seeds, Normal Sprint): wrong side +3.9 s mean (+3.2 median); ignoring the wind +2.3 s; following the windsock rule beats ignoring it on 17/24. **But gates are sparse:** 10/12 fresh Sprints have a gate-free stretch over 600 m (`CRITH08` has 3 gates in 3 km). The scoured rock you steer around is still a flat plate (`04b`, `09c`, `12`). |
| Difficulty and fairness | 7.5 | **7.5** | **Fixed:** the Hard Sprint step; 0 crashes in 360 runs; no pins. **Normal Sprint ladder:** F − A mean +4.6 s, but per seed −10 to +20 s, with the Fjord faster on 9/24 seeds. Relaxed on `CRITH` has a median of **−2.9 s**. **Hard Standard:** Fjord reader 3/4 and skilled 2/4 (caught at 2.1 and 6.6 km), against Alpine 4/4 and 4/4. |
| Cinematics | 7 | **7.5** | **Gains:** `08` and `08b` are good: the Yeti is grounded at the tide pool, with the fjord, the islands and the harbour row behind. The lintel is gone from `08c` and `08d`. **Still there:** the trophy still covers the presenter's head (`11g`); the splash has a hard cylindrical rim (`11h`); the gulls have stick wings (`08c`); the column in `08d` reads as a rendered concrete pillar. |
| Performance and stability | 7 (lc) | **7 (lc)** | **Low confidence.** No errors or hangs in 360 headless runs, and the pin rescue tests pass. `perf/` was absent, so I have no frame-time evidence of my own. |
| Accessibility and controls | 7.5 (lc) | **7.5 (lc)** | **Low confidence.** Captions render on dark pills (`08c`, `08d`, `09`, `09d`, `11f2`). The menu prompts show both keyboard and controller glyphs (`01`). `TESTS.md` and the resolution sets were absent. |
| **Overall player experience** | 7.5 | **7.5** | A distinct coastal run with a real wind read, a lit cave, a funny harbour finish, and the Critical fixed. It still misses 8. The Yeti's introduction is staged on blockout dressing, the named §4 backdrop failures are on screen for the whole run, and the difficulty ladder that justifies "2/5" is weaker than the seed noise. |

## My measurements

### Wind and ladder, Sprint, 12 fresh seeds `CRITH01`–`12` (`tables_sprint.txt`)

Times are relative to the full reader, on seeds both policies won.

| Difficulty | `cue` | `ignore` | `wrong` | `skilled` | Reader wins F / A | Reader F − A, mean (median) |
|---|---|---|---|---|---|---|
| Relaxed | +0.71 (11/12 slower) | +1.03 | +1.70 (12/12) | +2.38 | 12 / 12 | **+0.11 (−2.93)** |
| Normal | +1.12 | +2.28 | +3.26 (12/12) | +6.90 | 12 / 12 | **+1.40 (−2.06)** |
| Hard | −0.85 (8 wins) | +2.27 (10 wins) | +2.93 (8 wins) | +6.46 (10 wins) | 11 / 11 | **+0.68 (−0.83)** |

**Build effect vs seed effect.** I re-ran my round-4 seeds `CRITG01`–`12` on Normal with this build:
- Alpine times are identical. Fjord `ignore` and `wrong` are identical, and the reader moved by at most 6.9 s on one seed (mean +0.6 s).
- So on Normal the build is effectively unchanged. The weak ladder on `CRITH` is the seed sample.

**Pooled over 24 seeds, Normal Sprint:**
- F − A mean +4.59 s, median +5.72 s. **The Fjord is faster than Alpine on 9/24 seeds.**
- Per-seed values range from −10.2 to +20.3 s.
- Cost against the reader: wrong +3.89 s; ignore +2.28 s; cue +1.13 s.
- Ignore minus cue: median +0.61 s; the cue rule is better on 17/24 seeds.

### Standard, 4 seeds (`standard.jsonl`)

| | Normal | Hard |
|---|---|---|
| Reader F − A | +23.5 s (+0.9 … +40.7) | +16.9 s |
| Fjord wins (reader / cue / ignore / skilled) | 4 / 4 / 4 / 4 | **3 / 3 / 2 / 2** |
| Alpine wins (reader / skilled) | 4 / 4 | 4 / 4 |
| Fjord skilled min gap | 46.9 m | **8.8 m** |

Notable Hard Standard losses on the Fjord:
- `CRITH01`: `cue`, `ignore` and `skilled` were all caught at about 6.6 km.
- `CRITH03`: the reader was caught at 7.85 km and `skilled` at **2.11 km**.

### Placement survey (`place.jsonl`)

**Sprint:**
- Gates: 3–9 per course. Air squalls: 1–7.
- **Gate-free stretches over 600 m on 10/12 courses.** `CRITH08` has three of them: 398–1116, 1116–1843 and 1843–3000.
- **The first viewpoint is at z 135–187 on 12/12 courses.**

**Standard:** 22–28 gates, with 3–6 gate-free stretches over 600 m per course.

### Pixels

**Round 4 → round 5 change** (mean absolute luma difference / share of pixels changing by more than 20):

| Region | Change |
|---|---|
| Island band of `03` | 1.1 / 1.8 % |
| `09` islands | 1.3 / 1.8 % |
| `06` cliff wall | 5.0 / 4.3 % |
| `06` crest | 3.9 / 4.7 % |
| `01` sea | 0.9 / 1.6 % |
| `11g` (whole frame) | 0.4 |
| `11h` (whole frame) | 1.5 |
| `11j` (whole frame) | 1.5 |

**Cave darkness** (share of pixels with luma < 20, R4 → R5) is unchanged. All four shots still read:
- `07`: 0.041 → 0.043
- `08`: 0.24 → 0.24
- `08c`: 0.144 → 0.151
- `08d`: 0.486 → 0.482

**Plunge water in `11j`:** RGB (100.7, 113.3, 124.1), identical to round 4. It still reads as water.

## Defects

### D1. Major: the sea-cave dressing still reads as blockout (round-4 D1, partially fixed)

**Fixed since round 4:** the lintel of column ends (`seaCave.ts`, now only icicles at the brow) and the net (`NET_PLACED = false`).

**Evidence of what remains**
- **`07`, right of the mouth (1130–1770 × 380–1040).** About 35 hexagonal prisms with flat snow caps stand straight on bare snow. There is no talus, burial or bedding into the cliff, and they still form a regular field. The density was cut by about 40 % (`causeway(... 0.55/0.45)`), but it is the same object.
- **`07` lower left** (`crop07_hull.png`, 280–1000 × 740–1060):
  - a snow-capped slab floats with no contact shadow (430–475 × 755–800);
  - a lone grey log and a scatter of hull planks lie around;
  - none of it reads as a boat.
- **`08`:** a tilted slab hovers at 520–610 × 640–710.
- **`08b`:** a slab hovers at 1030–1065 × 750–785 and a log lies at 1195–1255 × 870–930, next to the Yeti's leap.
- **`08d`:** the right-hand column (1600–1920 × 380–960) is flat-sided with an even cement-grey render, and reads as a concrete pillar.

**Why it matters:** this is the one sequence every player sees on every course, and the brief forbids "artificial rock stacks" (§5).

**Fix**
- Cut the field to 3–5 clusters of varied height, stepped up into the cliff, with a talus apron of broken drums. Give the prisms a weathered top (no flat snow lid on every one), and add contact shadows or AO.
- Remove the hull and log debris, or model one recognisable upturned boat.
- Re-capture `07` and `08`–`08d`.

### D2. Major: the near islands are effectively unchanged (round-4 D2, not fixed; tracker F-009)

**Evidence**
- `cmp03_islands.png` puts the round-4 and round-5 crops of `03` one above the other. The tops are slightly more knolly, and nothing else changes: 1.8 % of pixels differ by more than 20.
- `03`, `04`, `09`, `09d`, `05` and `01` still show snow-capped lenses with dark skirts, evenly spread at one scale.
- `01` (1320–1480 × 550–590) and `03` (1650–1850 × 445–495) also show flat white plates on the water.

**Fix:** as in round 4. Use 3–4 archetypes (skerry clusters, a stack, a headland, a whaleback); cluster them along lines; vary the scale non-uniformly; use wet rock rather than a uniform snow lid on the small ones. Then measure the change on `03` and `09`.

### D3. Major: the cliff hero view still shows named §4 failures (round-4 D3, not fixed; tracker F-026 / F-027 claimed)

**Evidence**
- **`06` wall** (`crop06_wall.png`, 500–1200 × 350–700): dense, fine horizontal banding (pinstripe or moiré) over the whole face. It is the brief's "pinstripe" failure. SwiftShader filtering may exaggerate it; the developers should confirm on GPU.
- **`06` crest** (640–990 × 140–330): needle peaks remain.
- **`06` harbour apron** (520–740 × 755–830): still a thin white plate.
- **`06` bottom right** (1640–1920 × 850–1080): a faceted shard intrudes into the frame.
- **`11c`** (1480–1850 × 790–960): vertical white streaks on a sheer wall (F-028, OPEN).
- Measured change from round 4 is 4–5 % of pixels.

**Fix**
- Fade the bedding normal and detail completely beyond about 300 m, or bake the bedding into a low-frequency albedo.
- Clamp the crest ridged octave on this camera as was done for the valley walls.
- Give the harbour a quay edge and thickness.
- Mask snow by slope on the reveal walls (no snow above about 60°).

### D4. Major (new as a separate item): the Alpine→Fjord ladder on Sprint is smaller than seed noise

**Evidence**
- On 24 seeds, Normal Sprint reader F − A has a mean of +4.6 s, but **the Fjord is faster on 9/24**, with a per-seed spread of −10 to +20 s.
- On `CRITH`, Relaxed has a median of −2.9 s.
- A player choosing "2/5" over "1/5" on a Sprint has a 3-in-8 chance of the easier course.
- I verified that this is not a regression: the same seeds give the same numbers as on round-4 code.

**Fix**
- Bound the per-seed difficulty: for example, a per-course gate/squall budget per km with a floor, so no Sprint has fewer than about 5 gates.
- Or calibrate Fjord terrain pace against the Alpine course built from the same seed.
- Target: F − A > 0 on at least 22/24 seeds on Normal.

### D5. Minor: gate deserts (round-4 D4 remainder)

**Evidence:** 10/12 fresh Sprints have a gate-free stretch over 600 m. `CRITH08` has only 3 gates, and its last 1.9 km have none.

**Fix:** set a maximum gate spacing (about 450 m), filled with a gate or a jump squall.

### D6. Minor: Hard Standard is still tight on the Fjord

**Evidence**
- 4 seeds: Fjord reader 3/4, `cue` 3/4, `ignore` 2/4, `skilled` 2/4, with a skilled minimum gap of 8.8 m. Alpine is 4/4 for both reader and skilled.
- The 0.85 long-course factor starts only at 20 km (`environment.ts`), so Standard (10 km, the default length) gets no relief.

**Fix:** extend a graded factor to Standard on Hard (for example 0.9 at 10 km), or soften gust knock on Hard. Re-check against Whiteout (3/5).

### D7. Minor: the waterfront is regimented (round-4 D6, not fixed)

**Evidence:** `11h`, `11j` and `10` show the same straight wall of near-identical gables (`11j` 720–1920 × 320–620; 1.5/255 change from round 4). Tracker F-032 is OPEN.

**Fix:** as in round 4: stagger setbacks and roof pitches, add doors, sheds and a boathouse, and break the row.

### D8. Minor: the start composition is still Alpine's, and the sugarloaf blocks the sea (round-4 D7, F-029 OPEN)

**Evidence:** `02`: the gate is centre frame, the hut lower right, the rope line runs downhill, and a white dome (920–1470 × 280–540) fills the middle of the sea view.

**Fix:** put the start on a sea-facing shelf, and lower or move the sugarloaf.

### D9. Minor: the trophy still hides the presenter's head (round-4 D8, not fixed)

**Evidence:** `crop11g.png` (`11g`, 700–1400 × 280–1000): the lighthouse trophy and its ship's wheel cover the presenter's face. The whole frame changed by 0.4/255 from round 4.

**Fix:** offset the trophy to the side at chest height.

### D10. Minor: the gulls have stick wings (round-4 D9, not fixed)

**Evidence:** `08c`, right edge (1490–1920 × 560–960).

### D11. Minor: the splash crown has a hard cylindrical rim (round-4 D10, not fixed)

**Evidence:** `11h`, about 1350–1650 × 840–910 in full resolution (bottom right of `s3.png`).

### D12. Minor: hard white streaks on the menu sea (round-4 D11, not fixed)

**Evidence:** `01`, 900–1700 × 650–950: still parallel and ruler-straight (0.9/255 change).

### D13. Minor: the only Fjord achievement is still a gimme (round-4 D12, not fixed)

**Evidence:** the first viewpoint is at z 135–187 on 12/12 fresh Sprints.

**Fix:** require 3 viewpoints, or set the first one past 1 km.

### D14. Minor: the scoured-rock gate outcrops are textured now, but still flat plates (round-4 D13, partial; F-030)

**Evidence**
- `04b` (760–1190 × 535–640), `12` (790–1020 × 495–590), `09c` and `09d` (foreground): scanned rock, but sliver-thin slabs lying on the snow.
- There is no lee cornice, so the shelter is not legible.

**Fix:** use chunkier outcrops (0.8–1.5 m relief) with a wind-scoured face and a cornice on the lee side.

### D15. Minor (new): a hard straight sheet edge on the snow in the gust shot

**Evidence:** `crop12_edge.png` (`12`, 1130–1920 × 830–900): a straight, translucent quad edge crosses the slope, like a decal or drift sheet clipping the terrain. `07b` still shows a similar wedge (round-4 C and A).

**Fix:** feather the alpha at the edges of the drift or shadow quad.

### D16. Minor (process): the evidence set is incomplete at review time

**Evidence:** `EVIDENCE.md`, the manifests, `standard/`, `res-1366/`, `res-2560/`, `perf/` and `TESTS.md` are all absent.

**Consequence:** I could not verify F-024 (Standard-course cave sea framing), F-033 (perf) or the 1440p UI.

## What works

- **The pinned-skier Critical is gone:** `pin_rescue.test.ts` passes, and none of my 360 runs ended pinned or crashed.
- **The cave beats `08` and `08b` are the best shots in the location:** the Yeti is grounded at a lit tide pool, with the fjord, the islands and the colourful harbour beyond. With the lintel gone, the brow reads as rock.
- **The wind read is a real, repeatable decision** (wrong side costs about 4 s per Normal Sprint), and on these seeds the windsock rule carries more of its value (17/24) than in round 4 (7/12).
- **The Hard Sprint step is fixed** (11/12 vs 11/12).
- **Standard Normal has a clear ladder** (+23 s), while every policy still wins.
- **The harbour finish stays charming:** `10b` (the cobbled square), `11b` (the pier hot tub), `11e`/`11f2` (the stockfish racks and the cod gag), and `11c` ("YOU REACHED THE SEA"). The plunge water is water.

## Status of round-4 defects (my own verification)

| R4 # | Defect | Status | Evidence |
|---|---|---|---|
| D1 | Major: cave dressing blockout / floating | **Partial** | The lintel and net are removed. Prisms, floating slab and log remain (D1). |
| D2 | Major: saucer islands | **Not fixed** | 1.8 % of pixels changed in `03`; `cmp03_islands.png` (D2). |
| D3 | Major: cliff tile, crest, apron | **Not fixed** | Pinstripe, needles and plate in `06`; 4–5 % pixel change (D3). |
| D4 | Minor: weak wind cue, gate deserts | **Partial** | Cue beats ignore on 17/24 seeds (median +0.6 s). Deserts on 10/12 (D5). |
| D5 | Minor: Hard step too steep | **Fixed on Sprint; not on Standard** | Sprint reader 11/11, skilled 10/11. Standard Hard skilled 2/4 vs 4/4 (D6). |
| D6 | Minor: regimented waterfront | **Not fixed** | D7. |
| D7 | Minor: Alpine start composition | **Not fixed** | D8. |
| D8 | Minor: trophy hides presenter | **Not fixed** | D9. |
| D9 | Minor: crude gulls | **Not fixed** | D10. |
| D10 | Minor: splash rim | **Not fixed** | D11. |
| D11 | Minor: menu sea streaks | **Not fixed** | D12. |
| D12 | Minor: gimme achievement | **Not fixed** | D13. |
| D13 | Minor: scoured rock as blades and slabs | **Partial** | Now textured, still plates (D14). |
| D14 | Minor (process): missing evidence | **Not fixed** | D16. |

## Status of tracker items in my area (by my verification)

| ID | Claim | My status |
|---|---|---|
| F-021 (C) | Pinned skier | **Fixed as far as I can test.** 18/18 unit tests pass; 360 headless runs with 0 pinned or stranded. I did not re-run B's or E's trap probes. |
| F-022 | Hard step / long Normal | **Partial.** Hard Sprint is fixed. Hard Standard is still 2/4 skilled vs 4/4. I did not test ≥ 20 km. |
| F-023 | Cave lintel / net / prism grid | **Partial** (D1). |
| F-024 | Sea in Standard cave shots | **Cannot verify:** `standard/` is absent. |
| F-025 | Catch shot looks inland | **Cannot fully verify:** without a manifest, I cannot tell which frame is the catch shot. `11` (the trophy) shows houses and a snow slope, not the sea. |
| F-026 | Cliff tile lattice / pinstripe | **Not fixed** on screen (D3). |
| F-027 | Needle valley walls in the reveal | **Partial.** `11c` and `11i` walls are softer and blobby, but the needle crest remains in `06`. |
| F-028 | White streaks on vertical face (OPEN) | **Not fixed** (`11c`). |
| F-029 | Sugarloaf blocks the sea (OPEN) | **Not fixed** (`02`). |
| F-030 | Scoured rock untextured | **Partial** (D14). |
| F-031 | Foam / wet line at shores | **Partial.** A thin foam line follows the cliff base in `06` and `11c`. The island waterlines in `03`, `09` and `04` show no wet band. |
| F-032 | Repeated houses / boulder chips (OPEN) | **Not fixed** (D7; boulder chips in `09` and `02`, upper left). |
| F-035 | No warning for squalls entered mid-gust (OPEN) | **Not verified.** It is consistent with `cue` doing worse than the reader on Hard (8 wins vs 11). |

## Public-preview gate (completion brief §10), for my area

| Item | Status | Evidence |
|---|---|---|
| Hostile-critic Overall ≥ 8 | **Not met: 7.5** | Scores above. |
| No critical gameplay or physics defects | **Met as far as I tested** | F-021 tests pass; 0 pins or crashes in 360 runs. |
| All finite lengths completable | **Met for Sprint and Standard** (reader 4/4 Standard Normal; every Sprint policy wins on Normal). Longer lengths not tested by me. | `sprint.jsonl`, `standard.jsonl` |
| Fjord is a worthy second location, not a reskin | **Met** | `09`, `03`, `08b`, `11c` vs Alpine. |
| Difficulty ladder Alpine < Fjord | **Not reliably met on Sprint** (Fjord faster on 9/24 seeds); met on Standard | D4 |
| No floating decorations or artificial rock stacks (§5) | **Not met** | D1. |
| Named §4 geological failures absent | **Not met** | D2, D3. |
| No major regression in a signature cinematic | **Met:** no regression; the cave improved | Cave luma unchanged, lintel gone. |
| All automated tests pass; performance; resolutions | **Cannot verify** | `TESTS.md`, `perf/` and the resolution sets were absent. |

**Gate result: not met.** The Overall score is 7.5. §4 and §5 are still visibly failed in the cave and the backdrop.

**The path to 8 is the same as in round 4**, and none of it carries gameplay risk:
1. Finish the cave (D1).
2. Visibly change the island set and the cliff hero view (D2, D3).
3. Put a floor under the Sprint ladder (D4).

The next evidence round should include a pixel-difference check against round 5, to show that the art changes actually reach the screen.

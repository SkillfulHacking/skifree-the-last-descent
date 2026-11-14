# Fjord Coast, round 4 (release decision): Reviewer F (Hostile Game Critic)

- **Reviewer:** F, Hostile Game Critic
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `8d19542` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`)
- **Date:** 2026-11-12
- **Evidence used:**
  - Every 1920×1080 PNG in `round-4/candidate/` (31 shots), compared with `final/` (round 3) and `alpine-baseline/`. I viewed each shot. Contact sheets and crops are in `scratch/review-f-r4/` (`s1`–`s7.png`, `crop07_lintel.png`, `crop07_hull.png`, `crop06_wall.png`, `crop06_br.png`, `crop11g.png`, `crop_mix.png`).
  - `round-4/scenic-journey/*.png`, `round-4/TESTS.md`, `DEFECTS.md`, `REMEDIATION_wind_perf.md`. I treated the notes as claims to check.
  - My own pixel measurements (`scratch/review-f-r4/meas.py`).
  - My own headless runs on **12 fresh seeds `CRITG01`–`CRITG12`**. These were not used by the developers (who used `W4T*` and `W4V*`) or by me in round 3 (`CRITF*`).
    - I used the developers' round-4 harness, copied unchanged except for import paths: `scratch/review-f-r4/wind.test.ts`.
    - `sprint.jsonl` holds 288 unique runs: Fjord and Alpine; Relaxed, Normal and Hard; drivers `read`, `cue`, `ignore`, `wrong`, `lee` and `skilled`.
    - `standard.jsonl` holds 24 runs: 4 seeds on Normal.
    - `place.jsonl` is a placement survey: gates, squalls, rocks, viewpoints and gaps on 12 Sprint and 12 Standard courses.
    - Summaries are in `tables.txt`, produced by `table.py`.
- **Not available when I reviewed:**
  - `round-4/candidate/EVIDENCE.md`, `manifest*.json`, `res-1366/`, `res-2560/` and `candidate/perf/` did not exist.
  - The candidate PNGs are untracked files. I therefore could not confirm from a manifest which commit, camera or phase each shot came from.
  - `TESTS.md` was run on `c0ea8ae`. `git diff --stat c0ea8ae 8d19542` shows only docs, review PNGs and an e2e click timeout, with no `src/` change. So those results do carry over to `8d19542`.

## Verdict: FAIL (against the 9/10 target, and below the public-preview gate)

**Overall player experience: 7.5 / 10.** That is below the release gate of 8 for a public preview, and well below 9.

This is the best Fjord build so far. It is no longer a reskin of Alpine.

What round 4 fixed:
- **The wind is now a real choice.** On my fresh seeds, taking the wrong side of a wind gate costs a median **4.3 s per Normal Sprint**. Always taking the safe lee costs 1.9 s.
- **The sea cave is lit.** The basalt went from RGB (1, 1, 2) to (25, 33, 43). Near-black pixels in `08c` fell from 84 % to 14 %.
- **The plunge water reads as water** again.
- **Relaxed has a ladder:** the Fjord is now +6 s against Alpine, where round 3 had it 0.4 s faster.

Lighting the cave exposed what the darkness was hiding:
- The Yeti's introduction, the scariest beat of the run, now plays in front of a regimented grid of hexagonal prisms.
- Column-end blocks hang off the brow with icicles under them.
- A scatter of planks and a black net triangle hangs in the air.

The brief explicitly forbids "floating decorations or artificial rock stacks" (§5). Several named geological failures from §4 are also still on screen in almost every gameplay frame:
- uniform saucer islands;
- sawtooth crests;
- a cliff texture that reads as stucco or fabric.

A player who loves the Alpine run would find the Fjord a different, worthwhile place to ski. But it does not look finished at its two most important moments: the cave and the long-distance hero view.

## Scores

| Category | R3 | **R4** | Justification |
|---|---:|---:|---|
| Visual art direction | 7 | **7** | **Gains:** the cave is lit (`07`, `08`), and the plunge water is darker and bluer (`11j`). **Losses:** the cave dressing now reads as blockout and floating props (D1). The near islands are still saucer lenses (D2). The cliff hero shot `06` shows a fine repeating stucco-like tile and sawtooth crests (D3). The waterfront is still one straight wall of identical gables. |
| Environmental uniqueness | 8 | **8** | Every exterior frame says "coast": `09`, `04`, `08b` and `11c`. The start (`02`) still uses Alpine's composition of centre gate, hut lower right and rope line. |
| Skiing and hazard mechanics | 6.5 | **7.5** | **Wind gates are a real decision on Normal:** wrong side +4.3 s median (+2.2 to +12.3), always lee +1.9 s, ignoring the wind +1.3 s median (+2.85 s mean), all against the full read. **But the visible cue is weak:** the "windsock" rule beats ignoring the wind on only 7 of 12 courses (median 0.6 s). 7 of 12 Sprints have a stretch of more than 600 m with no gate. |
| Difficulty and fairness | 7 | **7.5** | **Fair:** 0 hazard crashes in 312 runs. **Ladder now on every difficulty:** reader F − A is +6.0 s on Relaxed, +7.2 s on Normal and +9.0 s on Hard. **Hard may be too steep for a 2/5:** the skilled autopilot wins 6/12 on Fjord vs 11/12 on Alpine. **Seed noise still dominates:** per-seed F − A ranges from −7.7 to +20.3 s on Normal. |
| Cinematics | 6.5 | **7** | **Gains:** the cave sequence is readable and coastal (`08`, sea, harbour and Yeti; `08b`, the leap with the fjord behind). The plunge reads as water. **Losses:** the floating lintel blocks and icicles are the subject of `08c` and frame `08d`. The gulls are still stick-winged. The trophy hides the presenter's face (`11g`). The splash has a hard cylindrical rim (`11h`). |
| Performance and stability | 7 (lc) | **7 (lc)** | **Low confidence.** No crashes or errors in my 312 headless runs. The candidate perf folder was missing, so I have no GPU-relevant evidence of my own. |
| Accessibility and controls | 7.5 (lc) | **7.5 (lc)** | **Low confidence.** Captions render on dark pills (`08c`, `08d`, `09`, `11f2`). The Scenic Route journey passes without debug (`TESTS.md` #19). The menu's Location description is low-contrast over the 3D start gate (`scenic-journey/01_menu_fjord.png`). |
| **Overall player experience** | 7 | **7.5** | A distinct, pleasant coastal run with a real wind read, a lit cave and a funny, coherent finish. It misses 8 because the Yeti's introduction is staged on visibly unfinished set dressing, and the named art failures remain in the gameplay backdrop. |

## My measurements

### Wind decision value: Sprint, 12 fresh seeds (`CRITG01`–`12`, `tables.txt`)

Each cell is the policy's time minus the full reader's time, on seeds both won: mean [min … max], then the number of seeds where the policy was slower than the reader.

| Difficulty | cue (windsock now) | ignore (always notch) | wrong | always lee | skilled (hazard-blind) |
|---|---|---|---|---|---|
| Relaxed | +0.78 [−0.01 … +1.64], 11/12 | +1.33 [0 … +3.70], 11/12 | +2.45 [+1.10 … +4.35], 12/12 | +1.20, 12/12 | +1.61, 11/12 |
| Normal | +1.37 [+0.22 … +3.39], 12/12 | **+2.85** (median **1.3**) [0 … +11.06], 11/12 | **+5.10** (median **4.3**), 12/12 | +1.98 (median 1.9), 12/12 | +8.47, 12/12 |
| Hard, wins/12 (gap) | 7 (22.2 m) | 8 (28.4 m) | 4 (13.5 m) | 8 (21.0 m) | 6 (16.2 m) |

On Hard the reader wins 10/12 with a minimum gap of 31.8 m.

**Ignore minus cue:**
- Normal: mean +1.48 s, median +0.60 s; the cue rule is better on 7/12 seeds.
- Relaxed: median +0.26 s; better on 8/12.

So the human-readable rule captures little of the value except on a few seeds. Most of the ignore mean comes from three seeds: +5.5, +7.1 and +11.1 s.

**Standard, Normal, 4 seeds:**
- cue +5.4 s;
- ignore +10.2 s (7.2 to 14.5, all 4 seeds slower);
- skilled +27.0 s.

This reproduces the developers' `W4V` numbers (`REMEDIATION_wind_perf.md`), and on my seeds the Normal effect is slightly larger.

### Ladder: Fjord − Alpine, paired, environment on

| | Relaxed | Normal | Hard |
|---|---|---|---|
| Reader | +5.98 s (12/12 both) | +7.19 s (−7.73 … +20.29) | +8.99 s; wins F 10 / A 11; gap 31.8 / 41.0 m |
| Skilled | +6.98 s | +15.06 s | +17.48 s; wins **F 6 / A 11**; gap 16.2 / 39.7 m |
| Standard Normal, reader | – | +10.9 s (4 seeds) | – |

### Placement (`place.jsonl`)

**Sprint:**

| Feature | Count |
|---|---|
| Wind gates | 4–8 (mean 7.0) |
| Jump squalls | 1–7 |
| Rocks on the line | 9–21 |
| Gap jumps | **4/12 courses** |
| Alternate-line metres | 0 on 3/12 courses |
| Viewpoints | 1–5, the first always at z 138–191 |

**Gate-free stretches over 600 m** occur on 7/12 courses. This counts only gates, and excludes the pre-cave opening and any jump squalls:
- `CRITG01`: 1908 → finish;
- `CRITG03`: 1143 → 1992;
- `CRITG04`: 2087 → finish;
- `CRITG08`: 855 → 1474;
- `CRITG09`: 407 → 1089;
- `CRITG11`: 911 → 1697;
- `CRITG12`: 427 → 1219.

**Standard:** 21–31 gates per course.

### Cave and water pixels (`meas.py`)

| Shot | Share with luma < 20, R3 → **R4** | Median luma, R3 → **R4** |
|---|---|---|
| `07` (full frame) | 0.49 → **0.04** | 30 → 94 |
| `08` (in letterbox) | 0.59 → **0.24** | 2 → 105 |
| `08c` | 0.84 → **0.14** | 1 → 37 |
| `08d` | 0.78 → **0.49** | 1 → 20 (chamber; acceptable as controlled darkness) |

- **Basalt face in `07`** (box 1300–1500 × 350–450): RGB (0.9, 1.1, 1.7) → **(24.8, 32.6, 42.5)**.
- **Plunge water in `11j`** (box 300–1700 × 760–940): RGB (142, 150, 158) → **(101, 113, 124)**. It is now clearly darker and bluer than the snow on the quay.

## Defects

### D1. Major: the sea-cave set dressing reads as blockout and floating props, now that it is lit

**Evidence**
- **`07`, the column field.** Right of the mouth (890–1780 × 420–1040) is a dense, near-uniform grid of about 60 hexagonal prisms with flat snow caps. They stand on bare snow with no talus, no burial and no connection to the cliff. This is the "artificial rock stack" the brief forbids (§5).
- **`07`, the lintel** (`crop07_lintel.png`, 680–1120 × 300–520). Six isolated column ends stick out of a smooth rock face like boxes glued to a wall, with icicles hanging under them. They read as floating.
  - The same blocks are the subject of `08c` (360–1320 × 570–840): blocks and icicles hovering against the face.
  - They frame the roar in `08d` (1130–1520 × 120–400) and float top right in `08b` (1440–1680 × 120–360).
  - Code: `seaCave.ts:393–432` places sparse ends (50 % skipped) 1.1 m into a sampled face. Its own comment says the dense version "read as a pile of hex nuts". The sparse version reads as floating nuts.
- **`07`, the hull and net** (`crop07_hull.png`, 280–760 × 700–1000). Loose planks, a cylinder, an oar-like slab and three snow-capped boxes lie scattered on the snow. A black mesh triangle hangs in the air. None of it reads as a boat.
  - The same debris and floating net are in `08` (280–620 × 630–960) and `08b` (1010–1100 × 830–960).
  - This is my round-3 D3, unfixed. Before, it was hidden in black; now it is in plain view.

**Why it matters:** this is the Yeti's introduction and the scariest beat of the run. It is also the one sequence every player sees on every course.

**Fix**
- Replace the grid with 3–5 clusters of columns at varied heights. Bury them in a talus apron of broken column drums, and step them up into the cliff so they read as eroded out of it.
- Model the brow as part of the cave-rock mesh: a sculpted overhang with column ends emerging from it, not prisms pushed into a sampled face. Alternatively, delete the lintel.
- Either model a recognisable overturned boat with the net slung between two posts, or remove the hull and net.
- Recapture `07`, `08`, `08b`, `08c` and `08d`.

### D2. Major: the near islands are still uniform saucers and domes (named failure in §4)

**Evidence**
- `03` (1000–1900 × 110–250), `04` (250–1250 × 380–480), `09` (1050–1500 × 390–450), `02` (650–960 × 320–380) and `05` (350–950 × 200–300) all show the same thing: flat, snow-topped lenses with dark skirts, evenly spread at one scale.
- In `09` and `04` they fill the upper half of the gameplay frame, so the player looks at them for the whole run.
- The ridged far islands (`10`, `11e`) and the one craggy rock in `01` show the developers can do better.
- Tracker `F-009` is listed as CLAIMED. I find it not fixed.

**Fix**
- Use 3–4 silhouette archetypes: skerry clusters, a steep headland, a long whaleback and a stack. Scale them non-uniformly.
- Cluster them along lines rather than spreading them evenly.
- Darken them with wet rock at the waterline, and drop the uniform snow cap on the small ones.

### D3. Major: the cliff hero view still shows named §4 failures

**Evidence**
- **`06` wall texture** (`crop06_wall.png`, 100–500 × 500–750). There is a regular, millimetre-scale repeating cell pattern across the entire face, so the rock reads as stucco or textile at hero scale. Horizontal benching replaces round 3's vertical smear, but the material does not read as rock. This is the "concrete/masonry" failure.
- **`06` crest** (640–960 × 180–310). Sawtooth spikes are still there; the same spikes appear in `11c` (right half).
- **`06` bottom right** (`crop06_br.png`, 1640–1920 × 860–1080). A faceted near-camera island, with a separate slab floating off it.
- **`06` harbour apron** (520–740 × 755–830). It reads as a paper-thin plate pushed out of the cliff foot, with no visible foam at the cliff waterline.

**Fix**
- Raise the cliff macro tiling scale by 4–8× and break up repetition with a second, rotated sample or a detail mask.
- Smooth or replace the crest spikes with broken shoulders.
- Give the harbour apron a stone quay edge and foam.

### D4. Minor (was Major D1): the wind decision is real, but its visible cue carries little of its value

**Evidence**
- On Normal, following the windsock now (`cue`) beats ignoring the wind on only 7/12 of my seeds, median +0.6 s.
- The cycle-aware `read` is a further 1.2 s median better than `cue`.
- So the decision mostly rewards memorising the 5.5 / 2.4 / 6.0 / 1.0 s cycle, not reading what is on screen.
- 7/12 Sprints have a gate-free stretch over 600 m (list above).

**Fix**
- Make the telegraph unambiguous at the decision point, about 1.5–2 s out. For example: spindrift crossing the notch only during the telegraph and active phases, plus a distinct audio swell.
- Let jump squalls or a ridgeline gate fill gaps over 600 m.
- Target: `cue` beats `ignore` on at least 10 of 12 seeds.

### D5. Minor (new): the Hard step may be too steep for a 2/5 location

**Evidence**
- Hazard-blind skilled autopilot: 6/12 wins on Fjord vs 11/12 on Alpine, minimum gap 16.2 vs 39.7 m.
- `cue` reader: 7/12 wins.
- `wrong` policy: 4/12 wins.

Autopilot results are not human enjoyment. But this leaves little headroom for Whiteout (3/5) on Hard.

**Fix:** check Hard intensity 1.2 against the planned 3/5 location before release, or reduce it to 1.1.

### D6. Minor: the waterfront is still regimented (round-3 D9, not fixed)

**Evidence**
- `10`: two clean arcs of houses.
- `11h` and `11j`: one straight wall of 9 near-identical gables (720–1920 × 320–620), with black window holes and no doors facing the water.

**Fix:** stagger the setbacks and roof pitches, add doors, sheds, a boathouse and quay clutter, and break the row with a gap or a lane.

### D7. Minor: the start composition is still Alpine's (round-3 D10, not fixed)

**Evidence:** `02` vs Alpine `02`: the gate is centre frame, the hut lower right and the rope line runs downhill.

**Fix:** move the start to a headland or a rock shelf above the sea, framed by the windsock, with the hut beside it.

### D8. Minor: the trophy hides the presenter's face (round-3 D13, not fixed)

**Evidence**
- `crop11g.png` (`11g`, 780–1320 × 380–760): the lighthouse trophy sits directly in front of the presenter's head.
- The podium blocks and orange buoy line up with the presenter's shoulder, so they read as an arm.

**Fix:** offset the trophy to the presenter's side at chest height, and move the podium out of that sightline.

### D9. Minor: the gulls are crude in close-up (round-3 D12, not fixed)

**Evidence:** `08c`: stick wings and ball bodies, at 1–2 % of frame height.

**Fix:** use a lower-poly but silhouette-correct gull with bent wings, or keep them at mid-distance.

### D10. Minor: the splash crown has a hard cylindrical rim

**Evidence:** `11h` (920–1300 × 700–745): a hard elliptical bottom edge where the crown meets the water.

**Fix:** fade the crown's alpha to 0 at the base, and add a foam ring decal.

### D11. Minor: hard white streaks on the menu sea (round-3 D14, not fixed)

**Evidence:** `01` (`crop_mix.png`, right half; full-frame 900–1700 × 650–950): parallel, ruler-straight white streaks on the water.

**Fix:** break the streaks with noise, fade their ends, and align them with the wind.

### D12. Minor: the only Fjord achievement is a gimme

**Evidence**
- The first viewpoint is at z 138–191 on all 12 of my fresh Sprints (`place.jsonl`).
- The browser journey unlocks Scenic Route at t = 21 s (`TESTS.md`).

**Fix:** require 3 viewpoints in one run, or keep the first one past 1 km.

### D13. Minor: the scoured-rock gate outcrops still read as flat grey blades and slabs

**Evidence**
- `04b` (about 760–1160 × 520–640): two flat grey blades on the snow, with a shard beside them.
- `04` (460–790 × 690–780): a dark slab on the snow.
- `09d`: the rim rock is a flat low-poly plate.

These are the objects the wind decision is about.

**Fix:** use chunkier, faceted outcrops with a snow cornice on the lee side, so the lee is visibly sheltered.

### D14. Minor (process): the candidate evidence set is incomplete

**Evidence**
- `candidate/EVIDENCE.md`, `manifest*.json`, `res-1366/`, `res-2560/` and `candidate/perf/` were absent while I reviewed.
- The shot PNGs are untracked.

**Fix:** commit the manifests and resolution sets before sign-off, so each shot can be tied to `8d19542`.

## What works

- **The run is coastal in every frame.** The sea and islands fill half of `09`, `04` and `03`, and the harbour row appears in `09d`.
- **Wind gates add a genuine read-and-commit choice.** Choosing wrong costs about 4 s per Sprint on Normal, and the choice decides Hard Standard. There were no hazard crashes in 312 runs.
- **Relaxed now keeps the mechanic.** The reader is still 1.3 s faster than ignoring the wind, and the Fjord is 6 s slower than Alpine.
- **The cave reads.** `08` (the Yeti at the tide pool, with the sea and the harbour beyond) and `08b` (the leap with the fjord behind) are the best Yeti intro shots in the project.
- **The finish and victory are charming and clearly coastal:**
  - `10b`: the cobbled square;
  - `11b`: the pier hot tub;
  - `11f2`: the cod gag, with its caption;
  - `11c` and `11i`: "YOU REACHED THE SEA" over the summit-to-harbour reveal;
  - `11j`: the water is no longer snow.
- **The developers' wind numbers reproduce on independent seeds.**

## Status of round-3 defects (my own verification)

| R3 # | Defect | Status | Evidence |
|---|---|---|---|
| D1 | Major: squall is a toll, not a decision | **Partially fixed**, now Minor (D4) | Wrong side +4.3 s median, lee +1.9 s, ignore +1.3 s median / +2.85 s mean on Normal. The cue rule beats ignore on only 7/12 seeds. |
| D2 | Major: cave crushed to black | **Fixed** | Luma < 20: `07` 0.04, `08` 0.24, `08c` 0.14 (were 0.49, 0.59, 0.84). Basalt RGB (25, 33, 43). |
| D3 | Major: cave dressing reads as blockout | **Not fixed**, now more visible (D1) | `crop07_lintel.png`, `crop07_hull.png`, `08c`. |
| D4 | Major: plunge water reads as snow | **Fixed** | `11j` water RGB (101, 113, 124), was (142, 150, 158). Rippled slate-blue surface. |
| D5 | Minor: cliff striation and crest spikes | **Partial** | Vertical smear gone; stucco-like tiling and sawtooth crest remain (D3). |
| D6 | Minor: scoured rock as grey blades with a soot halo | **Not fixed** (D13) | `04b`, `04`, `09d`. |
| D7 | Minor: Relaxed ladder flat; Hard gets nothing extra | **Fixed**, with a new Minor (D5) | Relaxed F − A +6.0 s. Hard skilled 6/12 vs 11/12. |
| D8 | Minor: near islands are uniform domes | **Not fixed**, raised to Major (D2) | `03`, `04`, `09`. |
| D9 | Minor: regimented waterfront | **Not fixed** (D6) | `10`, `11h`, `11j`. |
| D10 | Minor: start composition is Alpine's | **Not fixed** (D7) | `02` vs Alpine `02`. |
| D11 | Minor: documentation drift | **Fixed** | `CHANGELOG.md:3` has a Fjord entry. `docs/BIOMES.md:498` documents wind gates; `:506` points to the round-4 harness. |
| D12 | Minor: crude gulls | **Not fixed** (D9) | `08c`. |
| D13 | Minor: trophy presentation tangent | **Not fixed** (D8) | `crop11g.png`. |
| D14 | Minor: menu sea streaks | **Not fixed** (D11) | `01`. |

## Status of tracker items in my area

| ID | Status by my verification |
|---|---|
| F-003 (cave black) | **Fixed** (luma table). |
| F-004 (cave sea framing) | **Fixed for the default course shots:** `08` and `08b` show the sea and harbour. I did not verify custom Standard caves. |
| F-005 (plunge water) | **Fixed.** |
| F-006 (squall is a time tax) | **Partially fixed** (D4). |
| F-008 (crests, smearing) | **Partial** (D3). |
| F-009 (islands) | **Not fixed** (D2). |
| F-010 (scoured-rock view) | **Not fixed** (D13). |
| F-011 (concrete-looking rock) | **Not fixed** for the cliff hero shot (D3, `crop06_wall.png`). |
| F-014 (cod and presenter) | **Partial:** the cod gag reads with its caption (`11f2`), but the presenter is occluded (D8). |
| F-016 (UI at 1440p) | **Cannot verify from candidate shots** (`res-2560/` absent). `TESTS.md` #7 and #16 report the 2560 fit passing. |
| F-018 (Relaxed intensity) | **Fixed** (Relaxed ladder +6 s; wind read still worth +1.3 s). |
| F-020 (browser suite) | **Accepted from `TESTS.md`:** I confirmed there is no `src/` change between `c0ea8ae` and `8d19542`. I did not run the suite myself. |

## Public-preview gate (completion brief §10, as summarised in the brief), for my area

| Item | Status | Evidence |
|---|---|---|
| Overall ≥ 8 (preview) / 9 (approval) | **Not met: 7.5** | Scores above. |
| Fjord is a worthy second location, not a reskin | **Met** | `09`, `04`, `08b`, `11c` vs Alpine `09`, `07`. |
| Wind is a meaningful choice (§6) | **Met in mechanics; legibility partial** | Wrong side +4.3 s; cue vs ignore 7/12 (D4). |
| Relaxed keeps the mechanic; ladder Alpine < Fjord | **Met** | F − A +6.0 / +7.2 / +9.0 s for Relaxed / Normal / Hard. |
| Cave not black; Yeti grounded; coastal reveal | **Met** | Luma table; `08`, `08b`. |
| No floating decorations or artificial rock stacks (§5) | **Not met** | D1. |
| Named geological failures absent (§4) | **Not met** | D2, D3. |
| No snow-coloured water in the victory (§4, §7) | **Met** | `11j`. |
| Victory: coastal trophy, plunge, fish gag, ocean reveal | **Met, with Minor staging issues** | `11`, `11b`, `11f2`, `11h`, `11c`; D8, D10. |

**Gate result: not met.** The overall score is 7.5, which is below 8, and two §4/§5 requirements are not met.

**The shortest path to 8:**
1. Rebuild the cave dressing (D1).
2. Replace the near-island set (D2).
3. Retile the cliff (D3).

All three are art-only changes with no gameplay risk.

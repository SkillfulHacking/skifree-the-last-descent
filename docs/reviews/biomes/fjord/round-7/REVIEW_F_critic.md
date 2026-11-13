# Fjord Coast, round 7: Reviewer F (Hostile Game Critic)

- **Reviewer:** F, Hostile Game Critic
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `7b0a5bc` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`)
- **Date:** 2026-11-13
- **Evidence used:**
  - All 31 1920×1080 PNGs in `round-7/candidate/`, viewed full-size and as half-size contact sheets (`scratch/review-f-r7/s1.png`, `s2.png`). Crops and side-by-sides: `cmp06_wall.png` (round 6 above round 7), `crop06_slab.png`, `cmp07.png`, `crop07_boulders.png`, `cmp08c.png`, `crop11_boxes.png`, `crop11_sea.png`.
  - Pixel differences round 6 → round 7 for every shot (`scratch/review-f-r7/diff.py`). Figures are mean absolute luma difference / share of pixels changing by more than 20.
  - Source diff `5c28419..7b0a5bc`: `seaCave.ts`, `seaCaveCinematic.ts`, `seaFraming.ts`, `harbourVictory.ts`, `scanIslands.ts`, `cliffStream.ts`, `rockMaterial.ts`, and the tests. I treated `DEFECTS.md` and the commit messages as claims to check.
  - **Headless gameplay re-run:** my round-6 harness (`scratch/review-f-r7/wind.test.ts`, unchanged). Seeds `CRITG01`–`06`, Normal Sprint, Fjord and Alpine, drivers `read`, `wrong` and `skilled` (30 runs, `critg_normal.jsonl`).
  - `npx vitest run tests/unit/pin_rescue.test.ts tests/unit/fjord_gameplay.test.ts tests/unit/fjord_art.test.ts tests/unit/fjord_reveal.test.ts`: **26/26 pass.**
- **Not available when I wrote this:**
  - `candidate/EVIDENCE.md`, `manifest*.json`, `res-1366/`, `res-2560/`, `standard/`, `perf/` and `round-7/TESTS.md`.
  - The round-6 shots `12_wind_gate_gust`, `12b_wind_gate_lull` and `14_viewpoint` have no round-7 counterpart.
  - I have not read any other round-7 review.

## Verdict: FAIL against the 9/10 target. My Overall (8) meets the public-preview threshold.

**Overall player experience: 8 / 10 (up from 7.5).**

In round 6 I named three things holding the Overall below 8. Two of them are fixed on screen.

1. **The Yeti's introduction is clean.**
   - The lone portal column ("monolith"), the hex drums, the fish bones and the brow icicles are gone (`cmp07.png`; `08` against round-6 `08`).
   - `08` is now one of the location's best frames: the Yeti at the iced mouth, the fjord, the scanned islands and the harbour row all in one shot.
2. **The catch shot faces the sea.** `11` now looks past the pair, across the quay, to open water and the scanned islands, under the festoon lights (`crop11_sea.png`).
3. **Not fixed: the hero cliff and the gameplay ladder.**
   - `06` is pixel-identical where it matters: 0.4 % of pixels changed, and the pinstripe is still there (`cmp06_wall.png`).
   - The white vertical streaks in the `11c` victory reveal are unchanged (0.4 %).
   - Gameplay is bit-identical to round 6 (30/30 runs, max |Δt| = 0.00 s).

A player who loves the Alpine run now gets a coastal run that is clearly its own place. It is bracketed by a cave introduction and a harbour finish that no longer show blockout. That is an 8.

It is not more than 8:
- The named §4 geology failures are still visible in two views a player sees: the long cliff view (`06`) and the victory reveal under the title card (`11c`).
- The gull beat of the cave cinematic now frames an empty rock wall (new defect D2).
- The "2/5" difficulty claim still loses to seed noise on Sprint.

I scored the screen, not the trend. I am not rounding this up from 7.75.

## Scores

| Category | R6 | **R7** | Justification |
|---|---:|---:|---|
| Visual art direction | 7.5 | **7.5** | **Gains:** the cave dressing is now scanned rock only (`07`, `08`); the catch shot shows the sea. **Unchanged:** the hero cliff `06` keeps its pinstripe, needle crest and a flat white slab island with a "whale" skerry (`crop06_slab.png`). `11c` keeps white streaks on a vertical face. The boulders still sit *on* the snow with dark undersides (`crop07_boulders.png`). The menu sea streaks, the sugarloaf and the flat scoured-rock plates remain. The named §4 failures in hero views keep this below 8. Low-moderate confidence (A's primary). |
| Environmental uniqueness | 8.5 | **8.5** | The archipelago, the sea cave above the fjord and the harbour are this location's own (`03`, `08`, `08b`, `11`). The start (`02`) still uses Alpine's composition, with the sugarloaf blocking the sea. |
| Skiing and hazard mechanics | 7.5 | **7.5** | Bit-identical to round 6 (30/30 runs). The wind gate is still a real decision (wrong side about +3.9 s per Normal Sprint, round-5/6 figures). The gate deserts and plate outcrops are unchanged. |
| Difficulty and fairness | 7.5 | **7.5** | Unchanged code. The Fjord is faster than Alpine on 9/24 Normal Sprint seeds (round-5/6 data, still valid). Hard Standard is still tight. The pin rescue tests pass. |
| Cinematics | 7.5 | **8** | **Up:** `08` (Yeti, sea, harbour, no props) and `08b` are strong; `11` faces the sea; `08d` reads. **Down:** the 2.4–3.8 s gull shot (`08c`) now shows bare rock under a "[gulls scream and scatter]" caption, with no gull in frame (D2). The new low "coastal reveal" over the water has no screenshot. The trophy still hides the presenter's head (`11g`), and the splash rim (`11h`) is unchanged. Partly C's area. |
| Performance and stability | 7 (lc) | **7 (lc)** | **Low confidence.** No hangs or errors in my runs; 26/26 targeted tests pass. `perf/` is absent. This round adds no new assets; it removes props (drums, portal, bones, icicles). |
| Accessibility and controls | 7.5 (lc) | **7.5 (lc)** | **Low confidence.** Captions sit on legible pills (`08c`, `08d`, `09`), and the menu shows keyboard and pad glyphs (`01`). `TESTS.md` and the resolution sets are absent. |
| **Overall player experience** | 7.5 | **8** | The two set pieces that bracket the run no longer carry blockout, and the trophy beat looks at the sea. What remains is a cliff that still pinstripes in its hero view, a victory-reveal wall with white streaks, an empty gull beat, and a difficulty step that seed noise swamps. All are real, but none breaks the experience. |

## My measurements

### Pixel change, round 6 → round 7

| Shot | Change | Reading |
|---|---|---|
| `08` | 22.8 / 33.4 % | New frame; props gone; sea and harbour in shot |
| `11` | 35.2 / 55.9 % | New camera; now faces the sea |
| `08d` | 10.5 / 12.2 % | Background props gone |
| `07` | 2.3 / 2.7 % | Monolith, drums, card quad and icicles gone (`cmp07.png`) |
| `08c` | 0.6 / 0.5 % | The column, the icicles and the one visible gull are gone. **No gull in frame now** (`cmp08c.png`) |
| `06` (cliff hero view) | 0.9 / 0.4 % | **Unchanged on screen.** The `rkBand2` distance fade (`rockMaterial.ts:313-315`) and the Cliff Side macro removal (`cliffStream.ts:163`) do not visibly touch the banding (`cmp06_wall.png`), so the stripes are not that band |
| `01` | 1.5 / 1.8 % | The sea streaks are unchanged |
| `03`, `04*`, `05`, `09*` | ≤ 1.3 / ≤ 0.9 % | The 1:4 island-flatness clamp makes no visible difference in any shot |
| `11b`–`11j`, `10*`, `07b`, `02` | ≤ 0.5 / ≤ 0.8 % | Unchanged |

### Gameplay

- The `src/physics`, `src/game`, `src/world/hazards`, `profile.ts`, `course.ts`, `src/yeti` and `coast.ts` diffs since `5c28419` are empty.
- My re-run gives 30/30 runs identical to round 6 (same outcome; max |Δt| = 0.00 s). Every round-5/6 gameplay figure therefore stands:
  - Normal Sprint, 24 seeds: F − A mean +4.6 s, but the Fjord is faster on 9/24.
  - Wrong side of the wind gate: +3.9 s.
  - Hard Standard, Fjord skilled driver: 2/4 wins, against 4/4 on Alpine.

## Defects

### D1. Major: the hero cliff and the reveal wall still show the named §4 failures (round-6 D2, not fixed; F-026, F-027 and F-028 claims not borne out)

**Evidence**
- **`06`** (`cmp06_wall.png`, about 560–1160 × 330–630). The fine horizontal pinstripe banding over the whole wall is unchanged; the region changed 0.4 %.
- **`06`**: the needle crest (640–990 × 140–330) is unchanged.
- **`06`** (`crop06_slab.png`, 1560–1920 × 700–1000): a flat white faceted slab lies on the sea, with a sickle-shaped sliver and a dark "whale" skerry beside it. It reads as the "cake/plate" failure. The new 1:4 clamp (`scanIslands.ts:153-157`) has not changed it.
- **`11c`** (the victory reveal under "YOU REACHED THE SEA"): the white vertical streaks on the near-vertical valley wall are unchanged (0.4 %).

The round-7 shader change fades a ~8 m band beyond 120–400 m. The stripes on screen are unaffected, so they come from something else: terrace or normal stepping in the cliff mesh, or the detail tile.

**Fix:** isolate the source. Render `06` with strata = 0, then with detail normal = 0, then with flat vertex normals, and see which run removes the stripes. Then apply the island method: scan-derived cliff modules for the hero face, or at minimum smooth the cliff mesh normals beyond ~300 m. Fade the snow mask by slope above ~70° in `11c`.

### D2. Major (new regression, short beat): the gull shot has no gulls

**Evidence**
- **`08c`** against round-6 `08c` (`cmp08c.png`). The 2.4–3.8 s shot is "tight on the brow" (`seaCaveCinematic.ts:159-162`).
- Round 7 moved the perches from the portal columns to the boulder crowns (`seaCave.ts:394`, `perches.push({ p: … sy * 0.92 })`). Those boulders lie 7–12 m out on the snow, below and in front of the brow.
- The scatter velocity is out from the face and upward (`seaCaveCinematic.ts:132-133`), so the gulls fly away from a camera aimed at the brow.
- The frame is now 1.4 s of bare dark rock under "[gulls scream and scatter]". The caption describes something the player cannot see. The round-6 frame at least had one (stick) gull.
- The brow sort (`seaCaveCinematic.ts:111`) still prefers `brow` perches, but none exist now.

**Fix:** re-aim the 2.4 s shot at the boulder group, from low on the slope looking up past the boulders to the mouth, so the gulls lift through the frame. Or add 3–4 perches on rock ledges of the cave shell near the brow.

### D3. Major: the Alpine→Fjord ladder on Sprint is smaller than seed noise (round-6 D4, not fixed)

**Evidence:** gameplay is bit-identical (30/30 runs). The Fjord is faster than Alpine on 9/24 Normal Sprint seeds; F − A ranges from −10 to +20 s.

**Fix:** as in rounds 5 and 6. Use a per-course gate and squall floor, or calibrate pace against the Alpine course built from the same seed, with F − A > 0 on at least 22/24 seeds.

### D4. Minor: the cave boulders still perch on the snow (round-6 D1 residue)

**Evidence**
- `crop07_boulders.png`: the right-hand slab (about 1000–1170 × 875–960 full frame) shows a dark underside and no contact with the snow.
- `08`: the four boulders have hard dark undersides and no drift lip or contact shadow.
- A thin white blade-shaped sliver stands by the left cluster (`07`, about 440–490 × 910–1000), and there are a few tiny white flecks (`07`, about 1090 × 820 and 1180 × 1010).
- Sinking the boulders from 0.35 r to 0.5 r (`seaCave.ts:391`) is not visible at this camera.

**Fix:** add a snow collar (a displaced terrain lip or a soft white decal ring) and contact AO. Cull fragments under ~0.3 m.

### D5. Minor: the coastal reveal and the Standard-course cave shots are unevidenced

`seaCaveCinematic.ts:199-210` adds a low over-water shot, with a unit test (`fjord_reveal.test.ts`) that asserts water fraction ≥ 0.1 at the pose. It passes. However, there is no screenshot of it, and `standard/` is absent, so I cannot judge it on screen.

### D6. Minor: the trophy hides the presenter's head (round-6 D9)

`11g` is unchanged (0.1 %).

### D7. Minor: the splash crown has a hard cylindrical rim (round-6 D11)

`11h` is unchanged.

### D8. Minor: the waterfront is regimented (round-6 D7, F-032 OPEN)

`11h` and `11j` are unchanged. In `11` the plaza now shows a row of untextured boxes and an orange ball (`crop11_boxes.png`). They read as primitives, though they are grounded.

### D9. Minor: the start composition is Alpine's, and the sugarloaf blocks the sea (round-6 D8, F-029 OPEN)

`02` changed 0.4 %.

### D10. Minor: ruler-straight streaks on the menu sea (round-6 D12)

`01`: the parallel bright bars are unchanged. This is the first image a player sees.

### D11. Minor: the scoured-rock gate outcrops are flat plates (round-6 D14)

`04b` is unchanged. The fix is still to use the island scans.

### D12. Minor: gate deserts, Hard Standard tightness and the gimme achievement (round-6 D5, D6, D13)

Unchanged code.

### D13. Minor: the hard translucent wedge in the cave outlook (round-6 D15)

`07b` is unchanged (0.1 %). The pale quad over the slope and the blocky shadow stepping remain.

### D14. Minor (process): the evidence set is incomplete at review time

`EVIDENCE.md`, the manifests, `standard/`, `res-*`, `perf/` and `TESTS.md` are absent. The wind-gate (`12`, `12b`) and viewpoint (`14`) shots were not re-captured.

## What works

- **The cave introduction is finally clean.** It shows rock, ice and the Yeti, with nothing artificial. `08` and `08b` both put the sea, the islands and the harbour behind the Yeti, which the brief asked for.
- **The catch shot looks at the water**: quay, sea, scanned islands and the festoon lights. With `11b`–`11f2` it makes a warm, specific finish that Alpine does not have.
- **The scanned archipelago** carries the whole descent (`03`, `09`).
- **The Critical stays fixed.** 26/26 targeted tests pass, there were no pins in my runs, and every run won.

## Status of round-6 defects (my own verification)

| R6 # | Defect | Status | Evidence |
|---|---|---|---|
| D1 | Major: cave blockout (monolith, drums, bones) | **Fixed.** Residue: perched boulders, demoted to Minor D4 | `cmp07.png`, `08` |
| D2 | Major: cliff hero view | **Not fixed** | `cmp06_wall.png`, 0.4 % (D1) |
| D3 | Major: catch shot inland | **Fixed** | `11`, `crop11_sea.png` |
| D4 | Major: Sprint ladder | **Not fixed** | 30/30 identical runs (D3) |
| D5 | Minor: gate deserts | **Not fixed** | Unchanged code |
| D6 | Minor: Hard Standard | **Not fixed** | Unchanged code |
| D7 | Minor: waterfront | **Not fixed** | D8 |
| D8 | Minor: start, sugarloaf | **Not fixed** | D9 |
| D9 | Minor: trophy hides head | **Not fixed** | D6 |
| D10 | Minor: stick gulls | **Changed into a worse defect** | The gulls are gone from the shot (D2) |
| D11 | Minor: splash rim | **Not fixed** | D7 |
| D12 | Minor: menu sea streaks | **Not fixed** | D10 |
| D13 | Minor: gimme achievement | **Not fixed** | Unchanged code |
| D14 | Minor: scoured plates | **Not fixed** | D11 |
| D15 | Minor: wedge in `07b` | **Not fixed** | D13 |
| D16 | Minor (process): missing evidence | **Not fixed** | D14 |
| D17 | Minor: `05` showed no island change | **Cannot verify** | No manifest. `05` is unchanged from round 6; the menu now re-places scans after load (`scanIslands.ts:104-106`) |

## Status of tracker items in my area (by my verification)

| ID | Status |
|---|---|
| F-021 (pinned skier) | **Fixed as far as I can test:** `pin_rescue` passes; 0 pins in 30 runs |
| F-022 (Hard step) | **Partial:** Sprint fixed; Hard Standard unchanged |
| F-023 (cave lintel, net, prisms) | **Fixed.** The colonnade, drums, bones and icicles are now off too (`seaCave.ts` `PORTAL = false`; `07`, `08`) |
| F-024 (sea in Standard cave shots) | **Cannot verify:** `standard/` is absent. The unit test `fjord_reveal` passes |
| F-025 (catch shot inland) | **Fixed** (`11`) |
| F-026 (cliff pinstripe) | **Not fixed on screen** (`06`) |
| F-027 (needle walls) | **Not fixed** (`06`, `11c`, `11i` unchanged) |
| F-028 (white streaks on a vertical face) | **Not fixed** (`11c`) |
| F-029 (sugarloaf) | **Not fixed** |
| F-030 (scoured rock) | **Partial:** textured, but still plates |
| F-031 (foam and wet line) | **Partial:** unchanged from round 6 |
| F-032 (repeated houses and chips) | **Not fixed.** The chips in the sky in `11` are gone with the new camera |
| F-035 (squall warning mid-gust) | **Not verified** (code unchanged) |

## Public-preview gate (completion brief §10), for my area

| Item | Status | Evidence |
|---|---|---|
| Hostile-critic Overall ≥ 8 | **Met: 8** | Scores above |
| No critical gameplay or physics defects; no unrecoverable states | **Met as far as I tested** | 26/26 tests; 30/30 runs won; 0 pins |
| All finite lengths completable | **Met for Sprint** (this round) **and Standard** (unchanged code; round-5 runs). Longer lengths not tested by me | `critg_normal.jsonl` |
| No major regression in a signature cinematic | **Met on balance.** The cave and victory cinematics are both net better. The gull beat regressed (D2, a 1.4 s shot) | `08`, `11` against `08c` |
| All automated tests pass; no major performance regression; menus at three resolutions | **Cannot verify** | `TESTS.md`, `perf/` and `res-*` are absent |
| Art direction ≥ 8 | **Not met from my reading (7.5).** Reviewer A's score is the gate figure | D1 |

**Gate result for my area:** the critic threshold is met. The gate as a whole cannot be declared met while `TESTS.md`, `perf/` and the resolution sets are missing, and while art direction is below 8 on my reading.

**Path to 9** (the full-approval target):
1. Find and remove the cliff stripes, and the streaks on the vertical face in `11c` (D1).
2. Put the gulls back in the gull shot (D2).
3. Put a floor under the Sprint ladder (D3).
4. Bed the boulders with snow collars (D4).
5. Fix the menu-sea streaks and the sugarloaf (D9, D10): these are the first two images a player sees.

# Whiteout Ridge, round 2: Reviewer F (Hostile Game Critic)

- **Role:** Reviewer F, hostile critic. Owns category 8 (overall player experience) and scores every other category; scores outside category 8 are low confidence (lc).
- **Nature:** a **model-based reviewer, not a human playtester**. I did not play in real time. Feel, pacing and sound are inferred from code, data and stills.
- **Build:** `b70a793` (branch `pass5-whiteout`, per `CANDIDATE.md`). `git diff b70a793 HEAD -- src` is empty (HEAD `49bb459`). Balance was measured at `0de65b7`; `git diff 0de65b7 b70a793 -- src` touches only `ridgeRocks.ts` (culling), so I accept the balance data for this build.
- **What I examined:**
  - All 30 evidence PNGs and their manifest notes, plus strip frames 0.5, 11.5 and 17.5. I compared each note with its image.
  - `audio.json`, `perf/*.json` (I recomputed the frame statistics) and `courses.json`.
  - All 2,232 raw rows in `balance/round2/*.jsonl`. I recounted every cell, with paired per-seed comparisons, on both the tuning (W034) and held-out (W2H) seeds.
  - The source diff `3f7bc45..b70a793` in the areas that matter: `storm.ts`, `hazards.ts`, `Environment.ts`, `GameSession.ts` captions, `audio/logic.ts`, `rescueVictory.ts`, `stormCave.ts`, `achievements.ts` and the settings.
  - **My own experiment:** a short headless Vitest run under `/tmp` using the developers' `whiteoutDriver` and `simulateCourse`. It ran the **default course `CLASSIC-SPR@WHITE` on Normal with all 16 driver policies**, plus Alpine and Fjord Classic Sprint with the blind driver for comparison.
- **Missing evidence:** `round-2/e2e.txt` is listed in the round-2 README index, but it does not exist in the folder.

## Verdict: FAIL

Category 8 is **5/10**, against a target of 9. Round 2 did real work:
- the drift-gap decision now pays, on held-out seeds too;
- the CPU frame cost is fixed;
- the storm is visibly greyer and audibly louder;
- Reduce Weather Effects exists;
- the "coming soon" card is gone.

The **first five minutes** are still broken, and the data show it is worse than I could show in round 1. On the course a new player gets by picking Whiteout and pressing start (Classic Sprint, Normal), **every one of the developers' 16 driver policies is caught**, the furthest after 1,400 m of 3,000. The storm caption also still coaches a move (the lee) that the developers' own data show loses races.

| # | Category | R1 | R2 | Justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 6 | 6 | Storm light is now grey and flat, and the station loses its colour at range. But: cardboard ranges (06, 27), quad seams in 09, a seam across the piste in 11, a plastic-lozenge cave cornice (12–14). |
| 2 | Environmental uniqueness (lc) | 5 | 6 | The corniced rim (08) and the storm-held rescue are genuinely Whiteout. The cave is still the shared cave with a lozenge stuck on, and logs, stumps and dense trees still cover a "bare ridge". |
| 3 | Skiing and hazard mechanics (lc) | 5 | 6 | Drift gaps now pay and the hop exploit is closed (verified). The blizzard stance is worth ±0 and the lee is negative, so "weather reading" is mostly slalom through drift gaps. |
| 4 | Difficulty and fairness (lc) | 5 | 4 | The default course is unwinnable on Normal for all 16 policies (my run). Blind Normal Sprint wins 24/48. Even the fog-proof skilled reader wins only 13/24 on Normal Standard (Fjord 22/24). |
| 5 | Cinematics (lc) | 6 | 6 | The victory holds the storm and the lantern is raised (22). There is still no visible searchlight or flinch (24, strip 11.5), the "storm break" shows no sun, and the leap still glues the Yeti to the cliff (15). |
| 6 | Performance and stability (lc) | 5 | 7 | CPU median 7.5 → 0.7 ms, and frames > 16 ms 1,220 → 18 (verified). The last frame has 13.9 M triangles, and software-render time is 1.9× Fjord's. GPU timing is unmeasured. |
| 7 | Accessibility and controls (lc) | 6 | 7 | Reduce Weather Effects, wind pan from the front, and every blizzard captioned. The front caption advises the losing move, and the stills show stale captions. |
| **8** | **Overall player experience (owned)** | **5** | **5** | Real systemic fixes, but the default first run is a guaranteed loss, the coached decision is wrong, and the storm still reads as heavy overcast. |

## Round 1 → round 2

| R1 finding | Status | Evidence I checked |
|---|---|---|
| **F1** Reading the weather is a non-decision | **Partly fixed** | See below. |
| **F2** Difficulty cliff; default course lost; first full storm lands on the first chase | **Not fixed** (worse than shown) | See N1. `storm.ts:23` (`calmStart: 22`) and `storm.ts:63` (`if (k === 0) return 'full'`) are unchanged. `courses.json`: `CLASSIC-SPR@WHITE` is caught at 84.6 s (R1: 84.9 s). Daily Sprints: 2/7 lost (11-14, 11-15). Daily Standards: 4/7 lost (R1: 5/7). |
| **F3** The storm barely sounds like a storm; no wind direction | **Partly fixed** | See below. |
| **F4** The whiteout never whites out; blizzard fog capped to nothing | **Partly fixed** | See below. |
| **F5** Screenshot notes claim things the images don't show | **Partly fixed** | `16` now shows storm light with `STORM ←`, so the R1 clear-sky contradiction is gone. The README corrects 16/23/26 honestly. Many notes are still false (N5). |
| **F6** CPU cost 19× Alpine | **Fixed (CPU)**; GPU open | I recomputed from `perf/frames_whiteout.json`: n = 37,673, median 0.7 ms, p95 8, p99 8.7, 18 frames > 16 ms, max 67.4 ms. See N8 for GPU. |
| **F7** Hard has weaker weather than Normal | **Fixed** | `biome.ts:151`: normal 0.8, hard 0.8. |
| **F8** Achievements say "coming soon" | **Fixed** | `achievements.ts:235-243` has no `requires` for `whiteout-survivor`. The menu e2e result cannot be checked because `e2e.txt` is missing. |
| **F9** Content reused from Alpine and Fjord | **Partly fixed** | The cave cornice, rime and bank are added (`stormCave.ts:11-15`), but the shared geometry is "untouched" (`stormCave.ts:4`). Logs and stumps remain (`biome.ts:109`). |
| **F10** Art defects | **Partly fixed** | The 04 storm-wall trapezoid is gone. 03's cloud underside is softer. Cardboard ranges and the 09 seams remain (N6). |
| **F11** Knock hazard on the line; contradictory comments | **Not re-verified in depth** | The blizzard is still `severity: 'knock'` with `keepLaneClear: false` (`hazards.ts:225-228`). Every cell is now captioned (`GameSession.ts:816-822`), which mitigates it. |
| **F12** No reduce-weather option | **Fixed** | `settings.ts:16`, `App.ts:658`, `weatherFx.ts`. |

**F1 in detail.** Verified from the raw rows.
- W2H (held-out) Normal Sprint: `informed2NoLee` wins 22/24 against `blind` 10/24. Paired by seed that is +12 −0; over both seed sets, +18 −0 of 48. The developers' claim reproduces.
- Almost all of the gain comes from drifts alone: `driftsOnly` vs `blind` is +16 −0 of 48.
  - `blizzOnly`: 14/24 and 12/24, which is ±0.
  - `linesOnly`: 16/24 and 14/24.
  - `leeOnly`: 14/24 and 12/24.
- See N2 and N3.

**F3 in detail.** `audio.json` gives RMS 0.1491 in storm against 0.0877 clear, which is **+4.6 dB** (R1 +1.1). `logic.ts:256-268` now takes `weather.storm`, `exposure` and `pan`. That is still below the 6 dB I asked for, and the probe does not measure pan (perf README).

**F4 in detail.**
- What changed in code:
  - storm fog is ×21 (`storm.ts:33`);
  - the ceiling is raised to 0.016 (`biome.ts:75`);
  - blizzard boosts now bypass the ceiling (`Environment.ts:252`).
- So at s ≈ 0.86, exp2 fog should hide about 98% at 125 m. In `19` the station at about 125 m has indeed lost its red (x 660–730, y 290–345): a real improvement.
- What the frames still show: the horizon stays legible in `05` (terrain against sky, y ≈ 300–400 across the frame), `28` (y ≈ 340–400) and `19` (y ≈ 300–330). The README's "horizon lost" is not supported.

## New findings

### N1. Critical: the default course on the default difficulty cannot be won, by any policy
- **Evidence (verified by my own run, `/tmp`, developers' driver, 0.25 s reaction):**
  - **Course:** `CLASSIC-SPR@WHITE` on Normal. Difficulty defaults to `normal` (`settings.ts:83`).
  - **Results:** all 16 policies in `tests/sim/balance.ts:32-53` are **caught**, with 0 crashes each.

    | Policy | Caught at |
    |---|---|
    | `blind` | 51.0 s, 583 m |
    | `informed2` (what the caption coaches) | 50.3 s, 615 m |
    | `driftsOnly` | 720 m |
    | `informed2NoLee`, `informed`, `sheltered` | 84.6 s, 1,173 m |
    | `exposed` | 1,237 m |
    | `leeOnly` (best) | 100.1 s, 1,400 m |

  - **Comparison, same harness, blind driver:**

    | Course | Result | Minimum gap |
    |---|---|---|
    | `CLASSIC-SPR` (Alpine) | won, 156 s | 53.7 m |
    | `CLASSIC-SPR@FJORD` | won, 177 s | 38.9 m |

- **Cause (verified from `frontAt`):**
  - The front builds from about 25 s and is at full storm from about 30 s to 85 s.
  - The chase starts at about 29 s (run time 51.0 minus chase time 22.2).
  - So the first chase begins exactly as the strongest storm of the run arrives, the R1 F2 pattern, unchanged (`storm.ts:23`, `:63`).
- **Missed by the evidence:**
  - The W-051 gate asserts only Relaxed outcomes (`courses.measure.test.ts:105`), so Normal failures pass CI.
  - None of the 30 stills or the strip is on the default course: the manifest's `runs[]` are all `SEED-4033011667`.
- **Player impact:** the first Whiteout run on Normal ends in "caught" about 20–55 s into the chase for everyone. That includes a perfect, fog-proof weather reader. The victory cinematic, the best thing in the location, is unreachable on that course. A journalist's first impression is "unfair".
- **Fix direction:**
  - Give the Classic course's first front a graze profile or a calm until about 60 s after the chase starts.
  - Gate `CLASSIC-*@WHITE` Normal on the blind driver winning.
  - Capture the evidence set on the default course.

### N2. Major (categories 3, 7 and 8): the storm caption coaches the move that loses
- **Evidence (verified):**
  - `GameSession.ts:1194` captions every front: "the wind pushes you left; the left shoulder is the lee". It is on screen in `04`–`07` (caption bar, y ≈ 545–575).
  - The developers' own README marks the lee "Not yet a net win … Open (W-055)".
  - My paired recount, adding the lee to the otherwise skilled policy (`informed2` against `informed2NoLee`):
    - Normal Sprint: **+1 −5** of 48;
    - Normal Standard: **+0 −3** of 24;
    - W2H Sprint: 17/24 against 22/24.
  - On the default course, the lee-taking reader is caught at 615 m against 1,173 m without it.
  - The README explains why: "the lee crosses drift rows".
- **Player impact:** the one instruction the game repeats every storm makes a good player worse. Round 1's complaint was that the HUD advice did nothing; now it actively hurts.
- **Fix:** either make the lee pay (no drift rows in the marked lee), or stop naming it in the caption until it does.

### N3. Major (categories 3 and 4): "weather reading" is mostly drift-gap slalom, measured by a driver that sees through fog
- **Evidence (verified):**
  - **Where the skill comes from:**
    - `driftsOnly` alone accounts for +16 of the +18 Normal Sprint seeds gained.
    - The blizzard stance is ±0 (also the README: "on its own ±0 wins").
    - The storm-line choice adds little.
    - So the advertised weather decisions collapse into one decision: steer into marked gaps. That is a static ground obstacle, not weather.
  - **What the driver can see:**
    - It commits to a gap 95 m before the row, using the exact `gapX` (`whiteoutDriver.ts:151-153`), and "sees the line through any fog" (`:16`).
    - At the storm density (about 0.016), 95 m is about 90% fogged.
    - In `29` the gap markers at about 95 m are two orange panels about 10 px wide (x 403–413 and 532–542, y 385–400). The mound row itself is not distinguishable.
  - **Win rates, even with that perfect vision:**
    - Normal Standard: 13/24 (Fjord 22/24);
    - Hard Sprint: 10/48 (Fjord 8/24, Alpine 16/24);
    - Normal Sprint blind: 24/48.
- **Player impact:** a real human who reads the weather but misjudges one 21 m gap in fog will land nearer the blind numbers than the informed ones. The README itself says human cost is not measured.
- **Fix direction:**
  - Re-measure with a visibility-limited driver (it may only see markers within the fog distance).
  - Make the blizzard stance and the lee pay off.
  - Bring Normal Standard within about 10 points of Fjord.

### N4. Major (categories 1 and 8): the storm reads as dense overcast, not a whiteout
- **Evidence:**
  - `05`, `16` and `28`: a legible horizon, lamps visible well beyond the claimed ~80 m (`28`: lamps at x 500–700, y 380–400), sparse flakes, and no driving streaks in the air.
  - The `05` note promises "driving snow streaks"; I count fewer than 15 flakes in the frame.
  - The improvement is real: the sky is uniformly grey, and the station desaturates at range in `19`.
- **Impact:** the location's name is still a promise half kept.
- **Fix:** add screen-space spindrift and contrast loss near the ground plane, so the terrain–sky edge disappears at full storm.

### N5. Major (evidence integrity): notes still describe things the frames don't show
I verified each image against its manifest note:

| Shot | Note claims | Image shows |
|---|---|---|
| `01` | "cloud shadows on the snow, the ridge in sun" | Flat light, no sun, no shadows. |
| `02` | "the storm wall on the windward horizon" | No wall (R1 issue, unchanged). |
| `07` | "~2 s after the storm" | Ease ended at 87.5 + 1.33 = 88.8 s and the frame is at t = 96.5 s, so about 7.7 s after. No sun or shadows (R1 issue, unchanged). |
| `09` | "flank falling ~500 m into the valley, far ranges" | Milky haze, a hard grey translucent bar (x 0–800, y 80–310) and vertical seams (x 440–640, y 0–520). No valley (unchanged). |
| `17` | "the Yeti silhouette" | A pale figure about 20 px tall at x ≈ 638, y 345–370. |
| `22` | "the lantern raised in the doorway" | The skier holds it up in the foreground (x 570–645, y 270–415). |
| `24` | "in the searchlight beam, flinching" | A neutral stance, arms down, flat light. Strip 11.5 is the same. |
| `25` | "the storm breaking" | Unbroken grey. |
| README | "low sun" in the reveal (`26`) | No sun or cast shadows. |

Further problems:
- The front caption from t = 28.5 s is still on screen at t = 46.5, 87.5 and 96.5 s (`04`–`07`). It even shows beside `CLEARING` in `06`. The readable time is about 6.1 s (`Hud.ts:221`), so this is either a capture artefact or a HUD bug; I cannot tell which.
- No gameplay still shows the Yeti closer than 72 m (`18`). Every other chase frame reads 114–265 m, so chase pressure is never evidenced.
- `e2e.txt` is missing.

**Fix:** re-capture on `CLASSIC-SPR@WHITE`, step the HUD with the clock, and write each note from its frame.

### N6. Minor (category 1): art seams in normal and cinematic frames
- `06` and `27`: flat-filled jagged range cut-outs (`06` x 0–520, y 90–300).
- `11`: a hard diagonal seam across the piste (from about (450, 470) to (510, 610)) and inverted cut-out shapes hanging at the top (x 150–980, y 0–60).
- `12`–`14`: the new "wind cornice" is a smooth flat-shaded lozenge (`12` x 280–870, y 465–525). The rime is a row of identical white diamond sprites (`13` x 20–310, y 40–90). The spindrift reads as vertical rain streaks against black.
- `26` and strip 17.5: drifts at the hut are flat grey discs (x 730–995, y 560–600), and a diagonal terrain-tile band runs across the slope.

### N7. Minor (category 5): the leap is unchanged
In `15` the Yeti is still flat against the cliff above the mouth (x 610–655, y 320–375), with no arc or shadow. The skier's head is cropped at the bottom edge (x 740–870, y 635–720).

### N8. Minor (category 6): GPU risk is unmeasured
- The last-frame renderer count is **13.9 M triangles**, against 1.66 M for Fjord and 1.82 M for Alpine (`frames_*.json` summaries).
- SwiftShader's median render time is 10,978 ms, against 5,755 ms for Fjord and 4,133 ms for Alpine. That is a crude but direct proxy for raster load, at 1.9× Fjord.
- The census attributes 6.75 M triangles to instanced props and vegetation.
- Two frames exceed 33 ms (max 67.4 ms).

### N9. Minor (category 2): "above the treeline"
- Logs and stumps still spawn (`biome.ts:109`).
- `08` and `10` show dense conifers covering the "bare ridge".
- `27`'s gameplay camera still reads the piste as a trough between two banks; the drop is not visible.

### N10. Minor: inaccuracies in the balance README
- The ladder table's "Alpine (48 seeds) 24/24" is 24 runs per cell (12 W034 + 12 W2H per configuration, in `compare_*`).
- The table is otherwise accurate: every Whiteout cell matches my recount exactly.

## What is genuinely better
- **The drift-gap decision is real and holds on held-out seeds:** paired +12 −0, and median minimum gap 43 m against 3 m on W2H.
- **The CPU frame cost is fixed.**
- **The storm is louder** (+4.6 dB) **and panned toward the front.**
- **Storm light reads as a storm in the chase** (`16`).
- **The rescue now plays in a held storm.** The station, lantern beat and Yeti fur (`13`, `14`, `21`, `22`) are the best-looking moments in the location.
- **The "BEHIND YOU" inset with the snowball ring** (`18`) is a clear, fair telegraph.
- **The developers' README is candid** about W-037, W-055 and unmodelled visibility.

## What would raise category 8 to 9
1. **N1:** the default Classic Sprint is won by the blind driver on Normal with a minimum gap of 25 m or more, the first full storm does not coincide with the first chase, and a Normal gate exists for `CLASSIC-*@WHITE`.
2. **N2:** the captioned lee is a measured net win, or the caption no longer names it.
3. **N3:**
   - Normal Standard for the skilled reader is at least 80%.
   - Normal Sprint blind is at least 75%.
   - At least two weather decisions beyond drift gaps are each measurably positive.
   - The results are re-measured with a visibility-limited driver.
4. **N4:** a full storm erases the horizon in gameplay frames, with lamps and markers carrying the player.
5. **N5:** an evidence set on the default course whose notes match the frames, with a chase frame showing the Yeti inside 40 m in a storm.
6. **N8:** GPU or raster cost within 1.5× of Fjord.

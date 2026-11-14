# Fjord Coast, Round 9: Reviewer B (Physics and Gameplay)

## 1. Header

- **Reviewer:** B, Physics and Gameplay.
- **Nature of review:** model-based reviewer (same model family as the developers; not external). I am not a human playtester.
- **Build:** `3bf5a7e` (branch `pass4-fjord`). The worktree HEAD is `564cd5b`, which adds evidence and documents only: `git diff 3bf5a7e HEAD -- src tests` is empty.
- **Date:** 2026-11-14.
- **Previous review:** round 8 (`round-8/REVIEW_B_physics.md`, build `d1f642b`).

### Method

- **Code review** of the full `d1f642b → 3bf5a7e` diff of the gameplay files: `SkierPhysics.ts` (pin watchdog, `relocate(…, crash)`), `World.ts` (`extraColliders` now includes the cave dressings' colliders), `seaCave.ts` (boulders bedded at 62 % and given colliders), `presentation/cave.ts`, `caveTerrain.ts` (jamb cap) and `GameSession.ts` (captions only).
  - `environment.ts`, `fjord/hazards.ts`, `fjord/biome.ts`, `course.ts`, `profile.ts`, `CourseConfig`, `simulate.ts` and the Yeti have **no** changes since round 8.
  - `git diff c9ffd1b 3bf5a7e -- src` touches only `src/world/caveTerrain.ts`, as `EVIDENCE.md` says.
- **Headless runs.** All of these were mine, under `scratch/review-b-r9/`, run one at a time on **fresh seeds** (`B9*`) plus my round-4 trap seeds `B4C1`–`B4C3`. Raw output is in `scratch/review-b-r9/out/`.
  - **Cave-mouth pin sweep** (`pin9.test.ts`): 1,296 approaches. The real `dressSeaCave` boulder colliders are loaded on every Fjord course. Each approach gets a route-steer, five escape policies (a new one steers without tuck) and an idle check.
  - **Boulder probe** (`boulders9.test.ts`): 63 boulders on 18 caves and 1,548 runs (aimed and cave-side). It also takes a Monte Carlo of the visible footprint from the real `.skm` geometry against the collider radius.
  - **False-positive probe** (`fp9.test.ts`): 9,105 rest-point cases in both locations with 8 input policies.
  - **Jump A/B** (`jumpsab.test.ts`): 1,620 cases, round-4 engine against the candidate.
  - **Cornice** (`cornice.test.ts`): 594 approaches × 5 policies.
  - **Balance:** 14 seeds of Normal Sprint (read, skilled, ignore) and 4 seeds of Hard Endurance (reader).
- **Unit tests:** `pin_rescue`, `terrain_contact` and `fjord_gameplay` give **31/31 passing**. `round-9/TESTS.md` reports 311/311 unit tests and 19/19 browser tests (the menu re-run on `3bf5a7e`; the rest on `e0e2eca`). I did not run Playwright, `tsc` or a build.
- **Screenshots viewed (1920×1080):** `07_yeti_cave`, `12_wind_gate_gust` and `15_cornice_relocation`, plus their manifest entries.

---

## 2. Verdict: **FAIL** against the 9/10 target (my categories: 8.5 and 7.5)

Round 9 fixes both physics Majors I raised in round 8, and I verified both:

- **The pin rescue no longer touches a player who is standing still or turning.** Pivoting, braking while steering, and looking around never trigger a relocation off the cornice band: 0 of 1,035 open-snow cases in Alpine, and 0 of 27 at the Fjord viewpoints. A rescue is no longer a crash: 0 crashes in 1,296 approaches.
- **The cave boulders are solid.** All 63 boulders have colliders, and 0 runs penetrate one.
- **The Critical stays fixed with the new cave terrain and the boulders in place.** In 1,296 cave approaches: 0 unrecovered, 0 frozen, 0 launches.
- **Legitimate jumps are bit-identical** to round 4.

The build still misses 9/10:

- The default course's difficulty step is still within seed noise (F-039, Major, unchanged). That keeps Difficulty and fairness at 7.5.
- The new boulder colliders are a little crude: infinite-height cylinders with tree crash thresholds and tree sounds.
- The rescue's "stranded" branch still teleports a player who skates uphill on open snow, with a caption that blames a rock that isn't there.
- Four round-4/round-8 minors are untouched: the cornice stop is still a crash, the landing rock is still weakly tied to the gust, the readable decision is thin, and the gate is shown from a free camera.

## 3. Scores (physics/gameplay point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7.5 (low confidence) | I only viewed 07, 12 and 15. The bedded boulders in `07` now read as rock flakes in the snow, not hovering stones. Reviewer A owns this category. |
| Environmental uniqueness | 8.5 | The mechanics are unchanged and still distinctive: wind gates with gust/lull, knock and brace, squalls on kickers, the cornice, spines and gaps. Ignoring the wind costs +1.76 s per Normal Sprint (14/14 seeds slower). |
| Skiing and hazard mechanics | 8.5 | Round-8 #1 and #3 are fixed with no regressions (0 unrecovered, 0 launches, jumps identical, cornice 0 stuck inland). What keeps it from 9: crude boulder colliders (defect 2), the uphill-skate rescue false positive (defect 3), and four old minors (landing rock, cornice crash, thin decision, gap stake). |
| Difficulty and fairness | 7.5 | On Normal Sprint, the default, a good player still finds the Fjord no harder than Alpine: +0.44 s ± 2.4 s, Fjord faster on 6 of 14 seeds. Pooled with round 8, 37 seeds give +0.85 s, with the Fjord faster on 16. Hard Endurance is now 2/4 against 2/4 (inconclusive). |
| Cinematics | 7 (very low confidence) | Not reviewed. Reviewer C owns this category. |
| Performance and stability | 8 (low confidence) | No soft-lock, frozen state or runaway energy in any probe. `EVIDENCE.md` gives Fjord a CPU p99 of 11.9 ms against Alpine's 8.2 ms with 0 frames over 33 ms (CPU, software renderer, not verified by me). Reviewer D owns this category. |
| Accessibility and controls | 8 (low confidence) | A resting stick no longer teleports you, and the instruction subtitles now sit on a dark pill (shot `15`, legible). An idle stop at the cornice edge is still a crash, and the uphill-skate rescue gives a false caption. |
| Overall player experience | 8 | A fair, distinctive second location with no traps. Innocent behaviour is now punished much less. A strong player still won't feel the Sprint as harder than Alpine. |

## 4. Defects

### Defect 1. **Major: on Normal Sprint the Fjord is still not measurably harder than Alpine for a competent player (F-039, open; round-8 #2, not fixed)**

- **Evidence:** `bal-sprint.jsonl`, 14 fresh seeds `B9S01–14`, paired Fjord − Alpine winning times.

| Driver | Mean | Standard error | Median | Seeds where the Fjord is faster |
|---|---:|---:|---:|---:|
| Reader | **+0.44 s** (+0.3 %) | 2.42 s | +1.9 s | **6/14** |
| Hazard-blind skilled | +6.43 s (+4.2 %) | 2.70 s | — | 4/14 |

- Pooled with round 8's 23 seeds, the reader is +0.85 s and the Fjord is faster on 16 of 37.
- No balance, hazard or terrain-profile code changed this round; the tracker lists F-039 as OPEN.
- **Fix** (as in round 8): tie the Fjord's run-in terrain to Alpine's for the same seed, or add a small cost a reader cannot avoid. Then assert reader Fjord − Alpine ≥ +2 % pooled over ≥ 20 seeds, with the Fjord slower on ≥ 75 % of them.

### Defect 2. **Minor: the new cave-boulder colliders are infinite-height "trees"**

- **Code:** `seaCave.ts:401` (`solids.push({ x, z, r: r * 0.85 })`) feeds `SkierPhysics.ts:860–865`, which calls `solidHit(…, 'tree-heavy', …, crashAt 9, heavyAt 4)`. There is no height test.
- **Evidence** (`boulders9c.log`, 1,548 runs, 63 boulders):
  - **Crashes in mid-air above the rock:**
    - 548 impacts happened while airborne, 52 of them more than 2 m above the snow (maximum 5.3 m).
    - The tallest possible crown is 0.38 · 1.8 · 2.6 ≈ 1.8 m above the snow.
    - 48 crashes ("hit a tree") came with the skier more than 1.9 m above the snow, for example `B9B1 standard aim r2.1 v30 off0, h 2.6 m`.
    - So a player who jumps over a knee-high boulder can crash on thin air above it.
  - **Rules, sound and effects that don't fit a rock:**
    - Ordinary field rocks crash only at a normal speed above 15 m/s (`SkierPhysics.ts:940`). These boulders crash at 9 m/s.
    - A light touch plays the **branch-snap** sound and drops "snow from branches" particles from 1.8 m (`GameSession.ts:576–579`). A heavy hit plays the tree sound.
    - The internal crash reason is "hit a tree" (752 of 776 crashes in the probe). It is not shown on screen.
  - **Footprint:** a Monte Carlo of the shipped `.skm` scans (cut at 62 %, scaled as in `seaCave.ts`) puts the visible radius at a median 1.28× the collider radius (p90 1.48×).
    - The visible rock reaches past the contact distance (collider + skier radius) by a median of +0.04 m, p90 +0.40 m and at most +0.95 m.
    - So on the larger, wider boulders the skis visibly overlap rock by up to about a metre before contact.
  - The colliders are added even when the scan geometry fails to load (`solids` is filled before the async mesh add), which would leave invisible solid rocks. The risk is low, since the assets are bundled.
- **Fix:**
  1. Give the dressing colliders a `kind` (`rock`) and route them through the field-rock thresholds and rock audio.
  2. Store the crown height and skip contact when `s.pos.y > top + 0.2`.
  3. Take the collider radius from the scaled scan extent at the snow line, minus about 0.2 m.
  4. Register the collider only when its mesh is added.

### Defect 3. **Minor: the rescue's "stranded" branch still teleports a player who skates uphill on open snow, with a false rock caption**

- **Code:** `SkierPhysics.ts:1017`. Since round 9, holding tuck without brake counts as "pushing". If the skier is more than 10 m off the line and covers less than 3 m in 4 s, they are relocated. No wall contact is needed.
  - The skate push is 1.6 m/s² (`:430`), so anyone facing up a slope steeper than about 9° makes no headway.
- **Evidence** (`fp9.log`, B9F1–3, a skier at rest facing uphill on open snow under 30°):

| Policy | Fjord, open snow | Alpine, open snow | Fjord viewpoints |
|---|---:|---:|---:|
| Tuck (skate) uphill 12 s | **185/521** | **167/514** | 11/27 |
| Stick held diagonally (steer 0.7 + tuck 0.7) | 200/521 | 180/514 | 13/27 |

  - The player is not crashed now: 0 rescue crashes outside the cornice band.
  - But they are teleported with *"BACK ON THE PISTE — You were boxed in against the rock"* when no rock is involved. A player skating back up to a missed viewpoint or sign gets this.
- **Fix:**
  1. Require that the fall line is also blocked before calling a skier stranded: no direction within ±60° of downhill lets them skate more than 1 m in the window. Or require wall contact within the last 4 s rather than 1 s.
  2. Lengthen the stranded window to about 8 s.
  3. Use a neutral caption for this branch ("Back to the run").
  4. Add the unit test the tracker says is missing (F-046: "no dedicated test of the standing-still case"): pivot, brake+steer and uphill skating at every viewpoint and at open-snow points, never relocated with a rock caption.

### Defect 4. **Minor: a stop at the cornice edge is still a crash (round-4 #6 and round-8 #6, not fixed)**

- The cornice relocation calls `relocate()` with the default `crash = true` (`SkierPhysics.ts:329`). Only the pin rescue was changed.
- **Evidence:**
  - `cornice.log`: 187 of 200 idle stops in the band are stall-relocated at a median 2.9 s, as a crash.
  - `fp9.log`: 33 of 521 Fjord open-snow points at 40 m off the line are in the band, and idle, pivot and look-around there are all relocated **with a crash**.
  - Shot `15` shows "WIPEOUT!" and the multiplier reset to ×1.0 (that is the over-crest variant, where a crash is defensible).
- **Fix:** no crash and no multiplier reset for the stall relocation (`relocate(…, false)`), and about 6 s for a stationary skier or a warning prompt first.

### Defect 5. **Minor: the jump-squall landing rock is still only weakly tied to the gust (round-4 #4 and round-8 #5, not fixed)**

- `fjord/hazards.ts` is unchanged since round 8 (`JUMP_ROCK_INSET` 4). The round-8 measurement stands: 85 landings in the rock with wind against 54 calm (10.6 %).
- **Fix:** as in round 8, `x = lipX + Δroute + 2.5 + r`, and assert calm landings in the rock below 3 %.

### Defect 6. **Minor: the decision a human can read is still worth little against "always lee" (round-8 #7, not fixed)**

- Ignoring the wind costs +1.76 s per Normal Sprint (14/14 seeds slower, `bal-sprint.jsonl`). That is real, but the windsock cue was worth only about 0.3 s per Sprint over blind lee play in round 8, and the hazard code is unchanged.

### Defect 7. **Minor: Hard Endurance is unresolved (round-8 #4, partial)**

| Seeds | Alpine | Fjord |
|---|---:|---:|
| `B9E01–04` | 2/4 | 2/4 |
| Pooled over rounds 4, 8 and 9 | 8/12 | 6/12 |

- The losses are Yeti catches, plus one "hard landing" and one log trip in won runs.
- The samples are too small to call either way. **Fix:** a ≥ 20-seed pooled check in the developers' test suite.

### Defect 8. **Minor: gaps have no stake at racing speed (F-015, accepted for the preview)**

- The code is unchanged.

### Defect 9. **Minor (evidence): the gate decision is still not shown from the player's camera (round-8 #9, not fixed)**

- `12`/`12b` use the same free camera as round 8: (46.8, −229.3, 851.4) in the manifest.

## 5. What works

- **No unrecoverable state anywhere I probed, including the new cave terrain and the solid boulders:**

| Probe | Approaches | Unrecovered | Frozen | Air > 3 s | Rescue crashes |
|---|---:|---:|---:|---:|---:|
| Fresh seeds, both locations, Fjord with boulders | 576 | 0 | 0 | 0 | 0 |
| My round-4 trap seeds, Fjord with boulders | 720 | 0 | 0 | 0 | 0 |

  - Maximum air 2.36 s; maximum vertical speed 14.3 m/s.
  - Rescues come at a median of 1.1–2.1 s into the attempt (maximum 14.9 s).
  - A new steer-only escape policy (no tuck) adds no unrecovered case.
- **The rescue false positive I raised in round 8 is gone:**

| Behaviour | Round 8 | Round 9 |
|---|---:|---:|
| Pivoting on the spot | 382/508 | **0/521** (outside the cornice band) |
| Pivoting at a viewpoint | 24/26 | **0/27** |

  The rescue is no longer a crash.
- **The cave boulders are solid:** 0 penetrations deeper than 0.25 m in 1,548 runs, and no pocket that the watchdog misses.
- **Legitimate jumps are untouched:** 1,620 of 1,620 cases are bit-identical to the round-4 engine (2,077 jumps, 44 crashes on both).
- **The cornice:** skating inland gets out in 193 of 200 cases (t median 3.3 s), and is relocated in the other 7. Nobody is stuck under any inland policy.
- **The Yeti, `CourseConfig` and the intensity scaling are unchanged.** Relaxed keeps the mechanic, and the Yeti is not faster (verified in round 8; no code change since).

## 6. Status of round-8 defects and tracker items (my own verification)

| Item | Status | My evidence |
|---|---|---|
| r8 #1 / F-046: rescue fires on a standing, turning player | **Fixed** (for the reported case) | 0 relocations in 1,035 pivot, brake+steer and look-around cases outside the cornice band, and 0 at viewpoints. Rescue crashes: 0. Residual: uphill skating (defect 3). |
| r8 #2 / F-039: Sprint ladder within noise | **Not fixed** | Defect 1. |
| r8 #3 / F-040 (collision part): cave boulders view-only | **Fixed, partial in quality** | 63/63 colliders, 0 penetrations. Height, thresholds, sound and footprint issues in defect 2. |
| r8 #4: Hard Endurance steep, Relaxed weak bot | **Partial / inconclusive** | 2/4 against 2/4 (defect 7). Relaxed was not re-run; its code is unchanged. |
| r8 #5: landing rock weakly tied to the gust | **Not fixed** | The code is unchanged (defect 5). |
| r8 #6: cornice stop is a crash | **Not fixed** | Defect 4. |
| r8 #7: thin readable decision | **Not fixed** | Defect 6. |
| r8 #8 / F-015: gap stake | Not fixed (accepted) | The code is unchanged. |
| r8 #9: no player-camera gate shot | **Not fixed** | Same manifest camera. |
| F-001: wall launch | **Fixed** (re-verified) | 0 of 1,296 with air over 3 s. |
| F-002: cornice trap | **Fixed** (re-verified) | 0 stuck under inland policies. |
| F-006: squall decision | **Fixed** | Ignore +1.76 s per Sprint, 14/14 seeds. |
| F-018: Relaxed 0.25 | **Fixed** | The code is unchanged since round 8's verification. |
| F-021: cave-mouth pin (Critical) | **Fixed** (re-verified on `3bf5a7e` terrain, with boulders) | §5. |
| F-022: Hard and long-course step | **Mostly fixed** | As round 8; Hard Endurance is inconclusive. |
| F-047: instruction subtitles on a dark pill | **Fixed** (visually, shot `15`) | Reviewer E owns this item. |
| F-035: mid-gust squall warning | Not verified | Reviewer E's area; OPEN per the tracker. |

## 7. Public-preview gate (completion brief §10), my items

| Gate item | Status | Evidence |
|---|---|---|
| No critical gameplay or physics defects | **Met** | None found. The one Major is balance (defect 1). |
| No unrecoverable states | **Met** | 0 unrecovered or frozen in 1,296 cave approaches (with boulders), and 0 stuck at the cornice inland. |
| All finite lengths completable | **Met** (headless) | Normal Sprint 14/14 for every driver. Hard Endurance won on 2/4 in both locations. Standard, Expedition and Relaxed code is unchanged since round 8, where all were completed. |
| Endless streams reliably | Not re-run (physics unchanged) | Round 8: 12/12 × 900 s. Streaming belongs to Reviewers D and E. |
| No infinite launch, friction trap or unrecoverable position (§3) | **Met** | §5. |
| Legitimate jumps, rollers, pops and landings unaffected | **Met** | 1,620 of 1,620 identical. |
| All automated tests pass | **Met per `TESTS.md`** | 311/311 unit and 19/19 browser tests (partly on `e0e2eca`, which differs only in `caveTerrain.ts`). My 3 unit files are 31/31. |

**My gate items are met.** Full approval is **not**: Skiing and hazard mechanics 8.5 and Difficulty and fairness 7.5 are below 9.

## Reproduction

Run from `/home/claude/sf-fjord`. The run order is in `scratch/review-b-r9/run_all.sh` and `run_bal.sh`, plus `boulders9.test.ts` and `fp9.test.ts`, run directly with `--config scratch/review-b-r9/vitest.config.ts`. Tables come from `node scratch/review-b-r9/table.mjs scratch/review-b-r9/out/bal-*.jsonl`.

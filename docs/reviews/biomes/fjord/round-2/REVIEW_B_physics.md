# Fjord Coast, round 2: Reviewer B (Physics & Gameplay Engineer)

- **Reviewer:** B, Physics & Gameplay Engineer
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `aec1812` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`; only untracked evidence PNGs differ from the commit)
- **Date:** 2026-11-10
- **Method:**
  - I read the round-2 diff (`git diff f8519ca aec1812 -- src tests`), concentrating on `SkierPhysics.ts`, `physics/environment.ts`, `capabilities/environment.ts`, `fjord/hazards.ts`, `fjord/biome.ts`, `profile.ts`, `coast.ts` and `GameSession.ts`.
  - I ran my own headless simulations under `scratch/review-b-r2/`: `balance`, `cliff`, `cliff2`, `probes`, `extra`, `p2`, `slope`, `det`, `stall`, `boulder` and `wayround`. Raw output is in `scratch/review-b-r2/out/`.
  - I deliberately added **8 to 12 fresh seeds** (`R2A`–`R2L`) that the developers never tuned against, alongside round 1's `RB1`–`RB5`.
  - I viewed screenshots 04 and 04b (round 1, round 2 and the wip iteration).
  - I ran `npx tsc --noEmit` (clean) and the Fjord, biome and capabilities unit files (4 files, 84 tests pass).
  - No browser, Playwright or build was used.
  - The developers' `REMEDIATION_gameplay.md` was treated as claims only.

---

## 2. Verdict: **FAIL** against the 9/10 targets (substantially improved since round 1)

Round 2 fixes the serious round-1 problems, and I verified each fix with my own numbers.

- **Cornice soft-lock is gone.** Across 7,200 adversarial charged pops, nobody was stranded and nobody got a long BIG AIR.
- **Viewpoints are now free.** No viewpoint sits inside a chase window, and taking one never changed a chase outcome.
- **The environment now matters.** It costs a hazard-blind expert about 2.5 s per Sprint and costs a hazard reader about 0.4 s. It occasionally changes an outcome, always in a telegraphed and fair way.
- **Physics is still clean.** Runs are deterministic. Alpine is untouched. There were 0 hazard-caused crashes in 814 full-course runs.

The build still falls short of 9/10 in my categories, for four reasons:

1. **The difficulty ladder is now inverted the other way.** On seeds the developers did not tune against, Fjord (2/5) is *easier* than Alpine (1/5) at Standard length and above.
   - Relaxed "average": Fjord 4/8, Alpine 0/8.
   - Hard skilled: Fjord 8/8, Alpine 6/8.
   - Hard reader: Fjord 8/8, Alpine 5/8.
   - The brief requires Alpine to "remain the easiest". The cause is the terrain retune (`minSlope: 14`): the fresh-seed route gradient is now 17.2–17.6° against Alpine's 16.0–16.4°.
2. **Exploration has shrunk to almost nothing on the common lengths.** Sprint and Standard now have exactly **one** viewpoint per course, always in the first 140–680 m.
3. **The ridgeline and gap features are thin.**
   - Usable spines exist on 8 of 22 Standard ridgeline segments. They save 0.69 s on average.
   - There are 5 gaps across 8 Standard courses and **0 across 8 Sprint courses**.
   - The gaps carry no risk at any speed I tried (2–27 m/s, on or 5–8 m beside the kicker).
4. **The airborne squall is still negligible.** Median landing drift is 0.28 m, unchanged from round 1.

---

## 3. Scores (from the physics/gameplay point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7.5 (low confidence) | Only 04 and 04b were viewed. The windsock and spindrift telegraph in 04 is bold and readable. The round-2 04b "scoured-rock" shot does not show a rock patch at all (the wip iteration did). Reviewer A owns this category. |
| Environmental uniqueness | 7.5 | The environment now changes play measurably, which it did not in round 1. Grounded squall lanes, rock on the line and spines are Fjord-specific. Spines and gaps are sparse (0 gaps in Sprint), and viewpoints are reduced to one per Sprint or Standard course. |
| Skiing and hazard mechanics | 8 | Bounded, telegraphed, deterministic and skill-rewarding: a reader beats a blind expert by 3.3 s per Sprint and 14 s per Standard. Rim recovery is robust. Gaps carry no risk, spines save under 1 s, and the airborne squall still does nothing perceptible. |
| Difficulty and fairness | 7.5 | Fair: 0 hazard crashes, nothing random or unavoidable, and Relaxed is approachable again (average 10/13 Sprints). The ladder is wrong, though: Fjord is easier than Alpine at Standard and Endurance on unseen seeds (N1). |
| Cinematics | 7 (low confidence) | Not assessed; outside my scope. |
| Performance and stability | 8 (low confidence) | Headless Fjord costs 15.9 ms per simulated second against Alpine's 15.0, measured interleaved under the same load (round 1: 1.4×). Endless 20 km and Expedition are stable. Determinism holds across runs and streaming orders. Not GPU-measured. |
| Accessibility and controls | 8 (low confidence) | The controls are the same as Alpine. Squall, rock, viewpoint and relocation captions exist in code (`GameSession.ts` `envCaption`) but were not seen on screen. The "BACK ON THE PISTE" recovery replaces the soft-lock. |
| Overall player experience | 7.5 | A clearly better, fairer and more readable location than round 1. Still short of a 9 because the scenic-exploration identity is thin on Sprint and Standard and the Fjord is no harder than Alpine. |

---

## 4. Defects

### New in round 2, or found by this round's measurements

**N1. Major: the Fjord (2/5) is now easier than Alpine (1/5) at Standard length and above on unseen seeds; the B3 retune overshot and was tuned against round 1's seeds.**
- **Evidence:** `scratch/review-b-r2/out/balance-{s,l,m}.jsonl` (`node scratch/review-b-r2/table.mjs out/*.jsonl`). Wins out of runs:

| Cell | Fjord | Alpine |
|---|---:|---:|
| Standard Relaxed "average" (8 fresh seeds) | **4/8** | **0/8** |
| Standard Relaxed "average", combined with the developers' RB seeds | 5/11 | 1/11 |
| Standard Hard reader (fresh) | 8/8 | 5/8 |
| Standard Hard skilled (fresh) | 8/8 | 6/8 |
| Standard Hard intermediate (fresh) | 3/8 | 1/8 |
| Endurance Hard (R2A) | skilled and reader both win | skilled caught at 9.45 km, reader at 12.97 km |

- **Mean winning times (fresh seeds):** Fjord is faster for every winning style.
  - Sprint skilled: 146.0 s in Fjord against 152.6 s in Alpine.
  - Standard skilled, Relaxed: 463.4 s in Fjord against 479.8 s in Alpine.
- **Sprint (13 seeds) is at parity:**
  - Relaxed average: Fjord 10/13, Alpine 8/13.
  - Relaxed cautious: Fjord 3/13, Alpine 4/13.
  - Normal average: Fjord 3/13, Alpine 4/13.
  - Hard intermediate: Fjord 9/13, Alpine 8/13.
- **The cause is terrain** (`scratch/review-b-r2/slope.test.ts`):

| Course | Fjord route gradient (fresh seeds) | Alpine |
|---|---:|---:|
| Sprint | 17.2° | 16.0° |
| Standard | 17.6° | 16.4° |

- On RB1–RB5 the Fjord Sprint happens to measure 16.0°. This is why the developers' table (RB seeds only) shows Fjord as slightly harder. I reproduced their RB rows exactly, cell for cell.
- The environment does add difficulty. With it switched off, fresh Sprint Relaxed average goes 8/8 instead of 7/8 and cautious 4/8 instead of 3/8. But that effect is smaller than the speed the steeper terrain gives everyone.
- **Brief:** §3 Alpine "should remain the easiest and most predictable mountain"; §2 "gradual progression of environmental difficulty"; "a sensible environmental difficulty ladder" (§10).
- **Fix:**
  - Lower `minSlope` (14 → about 12.5) or move weight from `highspeed` back toward `alpine`, so the Fjord mean gradient sits at or slightly below Alpine's.
  - Let the environment (lanes, rock) provide the margin.
  - Add a balance assertion on seeds *not* used for tuning: Fjord win rate ≤ Alpine's (with a tolerance) per difficulty and style, at Sprint **and** Standard.

**N2. Major: viewpoints on Sprint and Standard collapsed to one per course, placed at the very start.**
- **Evidence:** `probes.test.ts` with `P=V`, 8 seeds per length; viewpoint and trigger positions from `extra.test.ts`.

| Length | Viewpoints per course (round 2) | Round 1 |
|---|---|---|
| Sprint | **1** (z = 138–192 m, first trigger at z = 282) | about 2 |
| Standard | **1** (z = 412–677 m of 10,000) | 6.8 |
| Endurance | 3 | |
| Expedition | 8 | |
| Endless (to 20 km) | 4 | |

- None of them is inside a chase, and the ids are unique, so B2 and B7 are fixed.
- On the two everyday lengths, though, "Scenic Exploration" (the Fjord's headline) amounts to one detour in the first minute. The remaining 2.7 km or 9.3 km offers nothing to discover.
- The cause is that `Coast.lookouts` only uses the stretch before the first trigger and the stretches after refuges. Sprint and Standard have no refuges.
- **Fix:** allow viewpoints inside chases where taking one is time-neutral, for example a downhill exit chute or spine that rejoins the line with speed. Verify with a detour-in-chase simulation like the one below. Alternatively, add more run-in viewpoints and lengthen the pre-trigger stretch on Fjord.

**N3. Minor: the gap jumps are rare and carry no risk; the airborne squall over jumps still has no measurable effect.**
- **Evidence:** `extra.test.ts` with `P=G`, and `p2.test.ts`.
  - Gaps: 0 in 8 Sprint courses, 5 in 8 Standard courses.
  - Every approach was clean: 2–4 m/s crawls from 8 m before the lip, 6–27 m/s on the line, and 8–26 m/s at 5–8 m beside the kicker. Results: 0 crashes, 0 stuck, at most 0.5 s grounded in the gully.
  - The gap therefore asks nothing of the skier and rewards nothing beyond the spine itself.
  - Airborne crosswind on 320 kicker jumps: landing drift median 0.28 m, p90 0.54 m, max 1.42 m; 0 crash differences. This is identical to round 1.
- **Fix:**
  - Allow at least one spine with a gap per Sprint where the terrain permits.
  - Give the gap a real stake: a landing that loses about 3–5 m/s if you come up short (no crash), and a clean-landing style bonus.
  - Either make the jump squall worth reading (about 3 m of drift toward a flagged hazard) or remove the claim from the copy.

**N4. Minor: the way round a rock patch on the racing line runs close to obstacles; the hazard-reading bot hits a boulder taking it.**
- **Evidence:**
  - `boulder.test.ts`: the reader driver (`tests/sim/readerDriver.ts`) on R2A Endurance crashes into a boulder at z≈4635 on all three difficulties. The boulder sits at route +8.1 m (r 1.3), so its edge is 6.8 m from the line. The bot had eased 6.6 m off the line for a rock on the line ahead.
  - `wayround.test.ts`: across 176 rock patches on the line (Sprint and Standard, 13 seeds), the *geometric* way round is clear by at least 0.92 m. One patch is below 1 m, and the median is 26 m.
  - Obstacle centres are kept 7.5 m from the route (`obstacles.ts:222`), but boulder radii reach 2.3 m. The safe band can therefore end at 5.2 m, while the way round sits 5.2–6.0 m out.
  - The unit test's bound (`fjord_gameplay.test.ts`, `< LANE_HALF + 1.5`) does not check obstacle edges.
- **Fix:** place the patch so the way round is ≤ 4.5 m from the route, or clear obstacles within (way-round offset + 2.5 m) for the patch's z-span. Assert edge clearance ≥ 1.5 m in the unit test.

**N5. Minor (evidence): the round-2 `04b_hazard_rock.png` does not show a scoured-rock patch.**
- **Evidence:**
  - `round-2/04b_hazard_rock.png` shows open snow, trees and the sea, with no rock patch in frame.
  - `round-2/wip/iter4_04b_hazard_rock.png` shows the new outcrop.
  - Rock on the line is now a core decision, so the shipped evidence should show what the player reads.
- **Fix:** re-aim the evidence camera at a rock patch on the line (its placement changed with the gameplay merge).

### Round-1 defects: status from my own measurements

| # | Round-1 finding | Status | My numbers |
|---|---|---|---|
| B1 | Cornice pop soft-lock | **Fixed** | `cliff.test.ts`: 7,200 charged pops (6 seeds, pop triggered at guard > 0.05, 0.3, 0.7 or 0.95, 18–42 m/s, 3 headings). 60 crossed the crest, all 60 relocated, **0 stranded**. Maximum 1.5 m beyond the rim (the relocation threshold); maximum airtime 2.05 s (round 1: 9.6 s); 0 runs with more than 2.5 s of air, so no BIG AIR exploit. The round-1 set (675 pops, RB1–RB3) gives **2 crossings, 2 relocations, 0 stranded**, matching the developers' claim. In a chase, deliberately aiming for the sea never gets over the crest (12/12, `cliff2.test.ts`). The updraft zone never overlaps a kicker, gap or cliff band landing (0 of all jumps on 8 seeds within 16 m of the crest). |
| B2 | Viewpoints inside chases | **Fixed** (see N2) | 136 viewpoints over 5 lengths × 8 seeds, **0 in a chase window**. Detour against no detour (skilled and average, Sprint 8 seeds and Standard 4, all 3 difficulties): wins are **identical in all 12 cells**. Time cost median 19 s (Sprint), 11 s (Standard). One autopilot outlier (RB2) stalled after a boulder crash on the way back; it is an autopilot steering artefact, not a soft-lock. Score has no time penalty, so +500 points is free. |
| B3 | Fjord harder than Alpine for non-experts | **Fixed, then overshot** (see N1) | Relaxed Sprint average: 0/5 → **10/13** (Alpine 8/13). Cautious: 0/5 → 3/13 (Alpine 4/13). The `environment: null` isolation now changes outcomes (1/8 average Relaxed, 1/8 average Normal, 1/8 cautious Relaxed on fresh seeds). |
| B4 | Signature mechanics had no effect | **Largely fixed** | Blind skilled against reader (fresh Sprint, environment on): 146.0 against 142.7 s. The environment costs the blind expert 2.5 s and the reader 0.4 s (Sprint, fresh); Standard is consistent with the developers' 10.8 s. Squall lanes, 27 lanes × 8 arrival phases: onshore drift median 0.30 m (mostly dormant arrivals), p90 3.13 m, max 3.79 m. A blind line-follower ends on the lee rock core in 51/216 passes. Never more than LANE_HALF, never toward the sea. Rock core at 20 m/s without a tuck: −1.37 m/s median (max 1.62); the developers' 2.0–2.6 is with a tuck. The way round costs 0.20 m/s. The airborne squall is unchanged (N3). |
| B5 | Ridgeline shortcuts generic and worthless; no gaps | **Partially fixed** | Usable spines (what `altRoutes` returns, which is also what the surface and `altRouteX` use): **8 of 22** Standard ridgeline segments on 8 seeds. Only 3 of 29 ridgelines are ≤ 380 m; the rest are dropped by the `altUseful` filter. The claim "every ridgeline has a spine" does not hold in play. Saving per spine against the route (tucking follower at 24 m/s entry): mean **0.69 s**, median 0.86, range −0.15 to +1.17 s; 0 crashes. Gaps: see N3. |
| B6 | Windsock pole near the line | **Fixed** | Minimum pole distance to the route over 8 Sprint seeds is 5.65 m (rule: ≥ 4.5 m). |
| B7 | Viewpoint ids not unique | **Fixed** | 136/136 ids unique across lengths and seeds (`vp-<seed36>-<len>-<z>`). |
| B8 | Hard near-miss bleed on flat stretches | **Fixed** | Hard Sprint skilled: Fjord **13/13** (5 RB, 8 fresh), with 7 direct hits in 231 throws against Alpine's 9 in 232. Hard intermediate 9/13 (Alpine 8/13). |

---

## 5. What works

- **Rim safety is robust.** The airborne updraft (`RIM_GUARD`) and the out-of-bounds relocation (`SkierPhysics.relocate`) live in the physics/environment layer, so headless simulations and the game behave the same way. The relocation is a clear, fair penalty: crashed, 6 m upslope, with a title and caption.
- **Squall lanes are a good mechanic for a 2/5 location:**
  - always onshore (+X, away from the cliff), with a 3 m/s cap;
  - only while the gust blows, telegraphed 1.3 s ahead, with a caption;
  - resisted by edging (`SLIP_EDGE`), and never a crash or knock.
  The lee rock makes the cost legible. Readers are measurably faster than in Alpine.
- **Fairness.** 814 full-course runs (2 locations × 3 difficulties × 6 styles × 4 lengths plus Endless) produced **0 environment-caused crashes**. The only crashes were 3 boulder strikes by one bot on one seed (N4).
- **Determinism:** byte-identical results, events and placements across runs and with the far end generated first (`det.test.ts`, Normal and Hard).
- **Alpine is unchanged.** The new knobs are optional, golden tests pass, my Alpine RB rows equal round 1's, and `tsc` is clean.
- **Performance:** the Fjord environment's headless cost dropped to 1.06× Alpine (from 1.4×).

## 6. Brief compliance: Fjord gameplay bullets (Reviewer B scope)

| Brief item | Status | Evidence |
|---|---|---|
| Large open downhill runs | **done** | Width ×1.08, gradient ≥ Alpine's (now steeper: N1). |
| Scenic branching paths | **partial** | Spines bow about 10–12 m seaward; there is no separate scenic branch past a view. |
| Optional shortcuts along ridgelines | **partial** | 8 of 22 ridgelines have one; they save 0.69 s on average (B5). |
| Gentle coastal crosswinds | **done** | Grounded squall lanes: bounded (≤ 3.8 m drift), telegraphed, skill-resistible. The airborne part remains negligible (N3). |
| Exposed coastal rocks | **done** | Rock on the line (about 1 per km) and in the lee of lanes: −1.4 m/s through the core, −0.2 m/s going round. The margin to obstacles is thin (N4). |
| Small terrain gaps and jumps | **partial** | 5 gaps in 8 Standard courses, 0 in Sprint, and no risk (N3). |
| Optional exploration bonuses at viewpoints | **partial** | They are free (0 in chase, outcomes unchanged, +500 points), but there is only 1 per Sprint or Standard course, at the start (N2). |
| Not mandatory detours | **done** | The racing line never passes through a viewpoint, and skipping one costs nothing. |
| No punishment for the fastest descent | **done** | The fastest line wins; readers are fastest. |
| Never a faster Yeti per biome (§2, §4) | **done** | `yetiSpeed` comes from difficulty only; Yeti tuning is shared. |
| Relaxed approachable / Hard challenging (§2) | **done** | Relaxed average Sprint 10/13. Hard average and cautious lose everywhere; Hard intermediate wins 9/13. |
| Alpine remains easiest; sensible ladder (§3, §10) | **missing** | Fjord is easier than Alpine at Standard and Endurance on fresh seeds (N1). |
| Hazards fair, telegraphed, testable (§4) | **done** | 0 hazard crashes; 1.3 s telegraph plus caption; unit tests in `fjord_gameplay.test.ts`. |
| No invisible failure zones / out-of-bounds recovery (BIOMES §5) | **done** | B1. |
| Coastal shelters as refuges (§5) | **done** | Endurance (3 encounters) and Endless 20 km complete for skilled and intermediate drivers on Relaxed and Normal. |
| Deterministic seeds (§10) | **done** | `det.test.ts`. |

## Reproduction

All commands are run from `/home/claude/sf-fjord`. Results are in `scratch/review-b-r2/out/`.

```
npx tsc --noEmit
npx vitest run tests/unit/fjord_gameplay.test.ts tests/unit/fjord.test.ts tests/unit/biome.test.ts tests/unit/capabilities.test.ts   # 84 pass
PART=s|l|m npx vitest run --config scratch/review-b-r2/vitest.config.ts scratch/review-b-r2/balance.test.ts
node scratch/review-b-r2/table.mjs scratch/review-b-r2/out/balance-*.jsonl
TAG=B POPS=0.05,0.3,0.7,0.95 VS=18,28,34,42 SEEDS=RB1,RB2,RB3,R2A,R2B,R2C npx vitest run --config scratch/review-b-r2/vitest.config.ts scratch/review-b-r2/cliff.test.ts
P=S|R|V npx vitest run --config scratch/review-b-r2/vitest.config.ts scratch/review-b-r2/probes.test.ts --disableConsoleIntercept
P=G|V npx vitest run --config scratch/review-b-r2/vitest.config.ts scratch/review-b-r2/extra.test.ts --disableConsoleIntercept
npx vitest run --config scratch/review-b-r2/vitest.config.ts scratch/review-b-r2/{p2,slope,det,cliff2,wayround,boulder}.test.ts --disableConsoleIntercept
```

# Fjord Coast, round 1: Reviewer B (Physics & Gameplay Engineer)

- **Reviewer:** B, Physics & Gameplay Engineer
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `f8519ca` (branch `pass4-fjord`; `git diff --stat f8519ca HEAD -- src tests` is empty, so the source I read and simulated is that build)
- **Date:** 2026-11-10
- **Method:** I read the source (`src/world/biomes/fjord/*`, `src/world/coast.ts`, `src/world/capabilities/*`, `src/world/hazards/*`, `src/physics/SkierPhysics.ts`, `src/world/profile.ts`, `src/game/simulate.ts`, `src/game/GameSession.ts`, `src/yeti/YetiAI.ts`). I ran the unit suite and wrote my own headless simulations under `scratch/review-b/` (`balance`, `probes`, `cliff`, `cliff2`, `look2`, `look3`, `iso`, `rb2`, `slope`, `det`). I looked at screenshots 04, 04b and 09. I did not use a browser, Playwright or a build.

---

## 2. Verdict: **FAIL** against the 9/10 targets

The Fjord physics is clean and safe. There is one environment hook. Alpine stays bit-identical. Runs are fully deterministic. Across 186 full-course simulations no hazard ever crashed anyone. Nothing in the biome punishes the player at random. The design still misses the brief in three ways:

1. **The Fjord-specific mechanics make almost no difference to play.** The crosswind and the signature sea squall move a jump's landing by a median of 0.29 m (max 1.45 m). A scoured-rock patch costs a median of 0.19 m/s. Every chase outcome I checked was the same with the whole Fjord environment switched on or off.
2. **The difficulty runs the wrong way and comes from the wrong place.** The 2/5 "scenic" Fjord is much harder than Alpine for everyone below expert level. On Relaxed, the "average" and "cautious" autopilots win 0 of 10 Sprints in Fjord, against 6 of 10 in Alpine. The cause is gentler, powder-heavier terrain against an unchanged Yeti, not any environmental decision the player makes.
3. **The exploration features undercut themselves.**
   - Every viewpoint on every length sits inside a Yeti chase window (114 of 114). Taking one gets a skilled skier caught in 8 of 10 runs, on Relaxed as well as Normal.
   - The "ridgeline shortcuts" are the generic Alpine alternate-line chord. Across 3 courses only 1 of 8 ridgelines got one, and it saves 0.02 s.
   - A charged jump at the cornice can carry the skier over the cliff crest. In 8 of 675 attempts they then dropped up to 9.6 s, landed without a crash and were stuck 85–400 m below the piste with no way back and no fail state.

---

## 3. Scores (from the physics/gameplay point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7 (low confidence) | Only 04/04b/09 viewed. The windsock telegraph is bold and readable. The rock patch reads as "no snow here". Judging the art is Reviewer A's job. |
| Environmental uniqueness | 6 | The scenery is clearly not Alpine, but the skiing is: sims with and without the Fjord environment give the same outcomes, and the branching, kickers and cliff bands are the shared Alpine profile features. |
| Skiing and hazard mechanics | 5.5 | The controls are unchanged and the code is well built (bounded, telegraphed, deterministic). But wind and squall drift is sub-metre, rock costs ~0.2 m/s, and the cornice can be jumped into a soft-lock. Nothing here rewards mastery. |
| Difficulty and fairness | 5 | Fair: nothing random or unavoidable, 0 hazard crashes in 186 runs. But Relaxed is not approachable here (0/10 average/cautious Sprints against 6/10 in Alpine), the gap comes from terrain rather than environment, and exploring is a run-ender. |
| Cinematics | n/a (low confidence, 6) | Not in my scope. I did not assess it. |
| Performance and stability | 7 (low confidence) | Headless Fjord costs ~1.4× Alpine per simulated second (27.7 vs 19.9 ms per simulated s, both under the same 2-process load). Hazard streaming peaks at 6 bands. Endless 20 km is stable. |
| Accessibility and controls | 7 (low confidence) | The same controls as Alpine. Hazards have visual and audio cues and never knock you down. The cliff soft-lock has no recovery other than restarting from the menu. |
| Overall player experience | 5.5 | It looks scenic, but a non-expert is caught early, the viewpoints cost the run, and the signature hazard barely registers. |

---

## 4. Defects

**B1. Major: a charged jump at the cornice launches the skier over the cliff; they land unhurt on the fjord wall and are soft-locked.**
- **Where:** `src/world/biomes/fjord/biome.ts:45-58` (the cornice is surface drag, applied only while grounded) and `src/physics/SkierPhysics.ts:382-405` (landing only checks impact speed normal to the surface).
- **Evidence (`scratch/review-b/cliff.test.ts`, `cliff2.test.ts`):**
  - Setup: 675 runs on 3 Standard seeds, starting in the sea-side half of the piste at 18/28/34 m/s, holding a heading 0.3–1.1 rad toward the sea, with a charged pop as soon as `guard > 0.05`.
  - Result: 8 went over the crest, up to 91.8 m beyond the rim.
  - Airtime was up to **9.6 s**, the landing **did not crash**, and the skier ended at speed 0, 85–400 m below the start height.
  - With 150 s of trying to steer back to the route afterwards: "back on piste: never", in all 3 traced cases (for example RB3 z0=1610: 79 m beyond the rim, 242 m below the piste, v = 0).
  - Without the pop, 0 of 675 crossed (closest approach 8.8 m inside the crest). The guard therefore works on the ground, but not in the air.
  - `GameSession` has no out-of-bounds or stuck detection (no match for stuck, respawn or out of bounds). The brief's BIOMES §5 says "no invisible failure zones".
- **Side effect:** a 9.6 s fall scores as BIG AIR (`air*120` points, ×1.5 if clean), so it doubles as a style-points exploit.
- **Fix:**
  - Make the crest a physics boundary: if `beyondRim > -4` while airborne, apply a strong +X correction (an invisible wind wall), or end the run with a "fell from the cliff" crash and respawn on the route at the same z.
  - Also make `land()` treat a long drop (air > ~2.5 s, or a fall height > ~15 m) as a crash.
  - Add a unit test that pops at the cornice from every heading and speed.

**B2. Major: all viewpoints sit inside Yeti chase windows, so taking the "optional exploration bonus" usually ends the run.**
- **Where:** `src/world/coast.ts:336-366`. `busy()` only excludes cave shelves and ±330 m around refuges, so the chases themselves are never avoided.
- **Evidence (`scratch/review-b/look3.test.ts`):**
  - Viewpoints inside `[triggerZ, chaseEnd]`: Sprint 10/10, Standard 34/34, Endurance 70/70 (5 seeds each).
  - Skilled autopilot that detours to the first viewpoint of the chase on Standard: **caught in 4/5 runs on Relaxed and 4/5 on Normal**. The same seeds without the detour win 5/5 (min gap 43–56 m).
  - A sensible detour costs a median of **+9.7 s**, p90 14.2 s, max 19.5 s (34/34 reached; `look2.test.ts`). The Yeti covers about 250 m in that time.
  - The reward is +250 style points (`GameSession.ts:716-721`).
- The brief asks that scenic routes "reward exploration". In practice exploring is a trap, and only players willing to throw away a run can collect viewpoints. A naïve "steer at it" approach also stalls dead in deep snow on the uphill side in 3/21 cases (`probes.txt` P4). The existing test only checks the first 4 viewpoints of one course, braking and outside any chase.
- **Fix:**
  - Place viewpoints in the post-refuge and pre-cave stretches, outside chases (Sprint needs a pre-cave one).
  - Or let a discovered viewpoint pay back the time it costs: a small Yeti-gap bonus, or a downhill exit chute that rejoins the line with speed. Lower the allowed `rise` (now < 14 m) so the skier is not stalled.
  - Add a chase simulation test with a detour.

**B3. Major: the Fjord (2/5) is far harder than Alpine (1/5) for non-expert skiers, Relaxed is not approachable, and the cause is terrain rather than environment.**
- **Evidence (`scratch/review-b/out/balance-*.jsonl`, `iso.test.ts`):**
  - Sprint, 5 seeds, "average" autopilot: Fjord **0/5 on Relaxed** and 0/5 on Normal; Alpine 4/5 on Relaxed and 2/5 on Normal.
  - "Cautious" autopilot on Relaxed: Fjord 0/5, Alpine 2/5.
  - Hard Sprint, "intermediate": Fjord 0/5, Alpine 4/5. Hard "skilled": Fjord 4/5, Alpine 5/5.
  - Standard, 3 seeds: average and cautious are caught at 1.3–2.1 km on Relaxed.
  - Isolation test: the same runs with `environment: null` give identical results (same catch point to ±0.03 km). So the gap is entirely terrain.
  - Measured route gradient (`slope.test.ts`, 5 seeds): Fjord Sprint mean 14.5° with 30% of the route under 12°; Alpine 16.4° with 20% under 12°. The Fjord mix is basin/powder-heavy (powder 16% of Standard against 10% for Alpine).
  - The Yeti is unchanged (`yetiSpeed` scales only with Relaxed/Normal/Hard, as the brief requires). A skier who doesn't tuck therefore loses ground on every flat or powder stretch.
- This breaks the brief's §2: "A difficult biome on Relaxed should be approachable"; "Difficulty must emerge primarily from the environment and the decisions it forces". The in-repo balance test (`tests/unit/fjord.test.ts:460`) only asserts skilled-wins and careless-loses, so it cannot catch this.
- **Fix:**
  - Retune the Fjord segment weights or slope ranges so the gradient matches or exceeds Alpine's (or move powder off the racing line).
  - Or apply the existing per-encounter `speedMul` from terrain, not from biome rating.
  - Add a balance assertion: on Relaxed, "average" finishes Sprint on ≥ 3/5 seeds; Fjord win rates at each difficulty and style are ≥ Alpine's minus a stated tolerance.

**B4. Major: the signature mechanics (crosswind, sea squall, scoured rock) are bounded but have no measurable effect, so there is no skill to express.**
- **Evidence (`scratch/review-b/probes.test.ts` P2/P5):**
  - Setup: 325 kicker jumps (3 seeds × 5 gust phases), each compared with an identical calm run (coupling 0).
  - Landing drift: median **0.29 m**, p90 0.54 m, max **1.45 m**. On squall kickers specifically: median 0.32 m.
  - Crashes caused or prevented by wind: 0. The lateral speed at landing (~1.7 m/s at 22 m/s) is far below the 0.3 rad needed to cost a "clean" landing.
  - Scoured rock skied straight through the centre: exit speed loss median **0.19 m/s**, max 4.29 m/s; 0 crashes.
  - Grounded wind is zero by design (`coupling.balance: 0`).
- Result: the windsock and squall streamers telegraph something that cannot change a run. "Wait for the lull or take the kicker on its upwind side" (`hazards.ts:6`) never matters.
- **Fix:**
  - Make the squall matter while staying fair. Examples: ~3–5 m drift during the active phase toward a flagged hazard such as rock beside the landing; a style or speed bonus for a clean landing in a gust.
  - Or give grounded skiers a small, telegraphed crosswind on exposed ridgeline segments (balance coupling ~0.15). A good skier then holds an edge into it.
  - Make rock patches cost something you notice (~2–3 m/s at the core), which still never crashes.

**B5. Major: "optional shortcuts along ridgelines" and "scenic branching paths" are effectively the generic Alpine alternate-line chord.**
- **Where:** `src/world/profile.ts:786-789`, `922-955`. The only Fjord change is adding `ridgeline` to `altTypes` (`biome.ts:135`).
- **Evidence (`probes.txt` P3, 3 Standard seeds):**
  - 12 alternate lines in total; all are faster (median 1.39 s saved, 0 crashes on either line).
  - Ridgeline segments: 8. Ridgelines carrying a useful alternate line: **1**, which saves **0.02 s**.
  - Alternate lines are a straight chord across the same piste (clamped to `halfWidth − 9`). None runs toward the rim or a view, so none is "scenic" or a separate branch.
  - "Small terrain gaps and jumps" likewise use the shared kickers and 3.5–6 m cliff bands. I found no Fjord-specific gap.
- **Fix:**
  - Author a real ridgeline branch: a raised, narrower spine with its own surface (wind-packed), a measurable time saving (2–4 s), and its own risk (exposure to the crosswind from B4).
  - Route a scenic branch along the rim past a viewpoint, rejoining downhill (this also fixes B2).
  - Add 1–2 actual gap jumps per arm (a gully or rock cleft) with a safe ride-around.

**B6. Minor: the squall windsock pole is visual only; one in 44 stands within 2 m of the racing line and can be skied through.**
- **Where:** `src/world/biomes/fjord/views/hazardViews.ts:50-53` places the pole at `h.x − 0.6r − 1.5`, `h.z − 8`. There is no collider (`probes.txt` P2b: 1/44).
- **Fix:** keep the pole ≥ 4 m from both `routeX` and `altRouteX`, or register it as a thin solid obstacle.

**B7. Minor: viewpoint ids are `lookout-<n>` with no course identity.**
- **Where:** `coast.ts:363`; `achievements.ts:135` stores `fjord:lookout-0`.
- **Effect:** the `scenic` set therefore merges the same index across all courses and seeds. A future "discover N viewpoints" goal would saturate early.
- **Fix:** include the course seed or id, or the rounded z, in the stored key.

**B8. Minor: Hard-mode near misses repeatedly bleed speed on slow Fjord stretches.**
- Hard "skilled" (dodging) Sprint RB2 is caught at 1.99 km with 0 direct hits. It took 12 "near" knocks while doing 13–16 m/s through a flat section (`rb2.test.ts`). Environment on or off gives the same result, so this comes from B3's terrain plus the existing near-miss knock (not Fjord code).
- **Fix:** re-check `SNOWBALL.nearKeep` against the flatter Fjord gradient once B3 is retuned.

---

## 5. What works

- There is a single physics hook (`physics/environment.ts`). Alpine stays bit-identical (241/241 unit tests pass, including the golden heights and identity tests). The controls are exactly the same in the Fjord, as the brief requires.
- Crosswind and squall are bounded, act only while airborne, and always push +X, toward land and away from the cliff. They never knock anyone down. The cornice stopped all 675 grounded runs aimed straight at the sea (median 20.8 m short of the crest). Its friction never touches the racing line, the alternate lines or any kicker: guard > 0 at only 0.9% of samples 3 m inside the sea-side piste edge, with a max of 0.04.
- **Determinism:** the same course gives byte-identical results, environment events, viewpoint and hazard placements across runs and across streaming orders (far end generated first). This holds on Normal and on Hard with snowballs (`det.test.ts`).
- **No random unavoidable punishment:** 186 full-course runs across 5 lengths × 3 difficulties × 5 styles produced 0 hazard crashes. The only crashes were 2 "hard landings" in one skilled Endurance run. Squalls telegraph for 1.3 s with a windsock that is readable from far off (04_signature_hazard.png). Hazard alerts start 150 m ahead.
- **Hard-mode skill expression works:** dodging skilled skiers take 4/87 hits in Sprint, against 25/42 for non-dodging intermediates.
- **Refuges and Endless:** skilled and intermediate drivers survive 3 encounters to 20 km on Relaxed and Normal. Expedition 50 km skilled wins on all three difficulties.

## Measured chase balance (headless, `scratch/review-b/balance.test.ts`; Custom seeds RB1–RB5)

Wins out of runs. Snowballs on Hard only, with the skilled driver dodging. "Caught at" gives km.

| Length | Difficulty | skilled | intermediate | average | cautious | careless |
|---|---|---|---|---|---|---|
| Fjord Sprint (5) | Relaxed | 5/5 (gap 46 m) | 5/5 | **0/5** (0.8–2.0) | **0/5** (0.8–1.4) | 0/5 (0.4) |
| Fjord Sprint (5) | Normal | 5/5 | 5/5 | 0/5 (0.6–1.3) | 0/5 | 0/5 |
| Fjord Sprint (5) | Hard | 4/5 (RB2 at 2.0) | **0/5** | 0/5 | 0/5 | 0/5 |
| Alpine Sprint (5) | Relaxed | – | – | **4/5** | **2/5** | – |
| Alpine Sprint (5) | Normal | 5/5 | 5/5 | 2/5 | 0/5 | 0/5 |
| Alpine Sprint (5) | Hard | 5/5 | 4/5 | – | – | – |
| Fjord Standard (3) | Relaxed / Normal | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 |
| Fjord Standard (3) | Hard | 2/3 | 1/3 | 0/3 | 0/3 | 0/3 |
| Alpine Standard (3) | Normal | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 |
| Fjord Endurance (1) | R / N / H | 1/1 each | 1, 1, 0 (H: 9.8 km) | 0/1 each | – | – |
| Fjord Expedition (1) | R / N / H | 1/1 each | N 1/1 | N 0/1 | – | – |
| Fjord Endless 20 km (1) | R / N | 1/1, 3 refuges | 1/1 | 0/1 | – | – |
| Fjord Endless 20 km (1) | H | 19.6 km at the 1000 s simulation cap (not caught) | caught 8.7 | caught 1.2 | – | – |

---

## 6. Brief compliance: Fjord gameplay bullets (Reviewer B scope)

| Brief item | Status | Evidence |
|---|---|---|
| Large open downhill runs | **partial** | Piste width ×1.08, but the route is flatter than Alpine (mean 14.5° against 16.4°) and powder-heavy, which drives B3. |
| Scenic branching paths | **partial** | Generic alternate-line chords (12 per 3 courses, median 1.39 s saved). None is scenic or a separate branch (B5). |
| Optional shortcuts along ridgelines | **missing (in effect)** | 1 of 8 ridgelines has one, worth 0.02 s (B5). |
| Gentle coastal crosswinds | **partial** | Gentle, bounded and safe, but only airborne and ≤ 1.45 m drift. Not perceptible as a mechanic (B4). |
| Exposed coastal rocks | **done** (light) | Rock obstacles ×1.7, lane kept clear, 0 crashes. Scoured-rock patches cost ~0.2 m/s (B4). |
| Small terrain gaps and jumps | **partial** | Shared kickers and cliff bands only; no Fjord gap feature (B5). |
| Optional exploration bonuses at viewpoints | **partial** | 34/34 reachable (+9.7 s median), +250 pts and an achievement. But all are inside chases, and detours get caught 8/10 (B2). |
| Not mandatory detours | **done** | The racing line never passes through one (lane > 20 m). Score does not penalise skipping them. |
| Scenic routes skiable, no punishment for the fastest descent | **partial** | The fastest descent is not punished. Exploring is (B2), and the rim can be jumped into a soft-lock (B1). |
| Never a faster Yeti per biome (§2, §4) | **done** | Yeti tuning is shared; `yetiSpeed` comes from difficulty only. |
| Hazards fair, telegraphed, testable (§4) | **done** | 1.3 s telegraph, audio cues, deterministic, 0 hazard crashes, unit-tested. |
| Relaxed approachable / Hard challenging (§2) | **missing** | 0/10 average and cautious Relaxed Sprints, against Alpine's 6/10 (B3). |
| Coastal shelters as refuges (§5) | **done** | `refuge: coastal-shelter`; Endless 20 km passes 3 refuges on R and N. |
| Deterministic seeds (§10) | **done** | `det.test.ts`: identical across runs and streaming orders. |

## Reproduction

All commands are run from `/home/claude/sf-fjord`:

```
npx vitest run                                              # 13 files, 241 tests pass
npx vitest run tests/unit/fjord.test.ts tests/unit/capabilities.test.ts   # 61 pass
PART=a npx vitest run --config scratch/review-b/vitest.config.ts scratch/review-b/balance.test.ts   # and PART=b
npx vitest run --config scratch/review-b/vitest.config.ts scratch/review-b/<probes|cliff|cliff2|look2|look3|iso|rb2|slope|det>.test.ts --disableConsoleIntercept
```

The raw outputs are in `scratch/review-b/out/` (`balance-a.jsonl`, `balance-b.jsonl`, `probes.txt`).

# Fjord Coast, final round (3): Reviewer B (Physics & Gameplay Engineer)

- **Reviewer:** B, Physics & Gameplay Engineer
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `aba21bc` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`; only untracked evidence files differ from the commit)
- **Date:** 2026-11-10
- **Method:**
  - I read the round-2 → round-3 diff for `fjord/hazards.ts`, `fjord/biome.ts`, `coast.ts` (lookouts, gaps, near rim), `capabilities/environment.ts`, `SkierPhysics.ts` (ground follow), `simulate.ts` and `Snowballs.ts`.
  - I ran my own headless simulations under `scratch/review-b-r3/`, all on **fresh seeds `B3F1`–`B3F12`** (and `B3DET`). These seeds were never used by the developers, who used T*, R3H* and R3V*.
  - Balance: 1,092 full-course runs. Probes covered spines and gaps, squall lanes, airborne squalls, rock, viewpoint detours, the cornice, caves and determinism. Raw data is in `scratch/review-b-r3/out/*.jsonl`.
  - `npx tsc --noEmit` is clean. `npx vitest run tests/unit/fjord_r3.test.ts tests/unit/fjord_gameplay.test.ts tests/unit/fjord.test.ts` passes (50/50).
  - Screenshots viewed: `final/04_signature_hazard.png`, `04b_hazard_rock.png`, `04c_hazard_rock_mid.png` and `09d_pursuit_rim.png`.
  - No browser, Playwright or build was used.
  - `round-3/REMEDIATION_gameplay.md` was treated as claims only.

---

## 2. Verdict: **FAIL** against the 9/10 targets (close; one regression and one engine bug block it)

Round 3 fixes most of what I raised in round 2, and I verified each fix on unseen seeds:

- **The difficulty ladder is no longer inverted.** At Standard and Endurance, the Fjord is clearly harder than Alpine on Normal and Hard.
- **The signature mechanic now matters.** A hazard-blind skier pays 6.2 s per Sprint on Normal; a hazard reader pays 1.9 s.
- **Viewpoints are plentiful.** Sprint averages 3.2 per course and Standard 7.5. The chase-side ones never changed a Normal outcome.
- **Airborne squalls are now real:** up to 4.9 m of drift.
- **The way round a rock is clear of boulders.**
- Determinism, the refuges and the long modes are all solid.

Two problems keep my categories below 9:

1. **The cornice now traps skiers (regression of round-1 B1).** Making the cornice "firmer" (`CORNICE` friction 6 → 10, drag 0.05 → 0.12) creates a dead zone between the crest and the 1.5 m relocation threshold. A skier who stops there cannot skate or steer out, and only jumping frees them.
   - With a charged pop at the cornice: 87 of 5,600 approaches get stuck.
   - Skiing straight at the rim without a pop: 2 of 5,600 get stuck.
   - Round 2 had 0 stuck in 7,200 pops.
2. **Engine bug: cave cliff walls launch the skier.** Skiing into a cave's cliff wall launches the skier at up to 59 m/s vertical speed, for 4–8.5 s of air. The bug is in the ground-follow code and is equally present in Alpine. It now sits on the Fjord's sea side, where it is reachable on the run-in to every cave.

Beyond those two:

- The Sprint ladder is thin: Normal is +0.3 % for the reader and +2.8 % for the blind skier.
- On Relaxed, the hazards are scaled to 0.25, so the Fjord is effectively Alpine on Relaxed, which weakens "biome difficulty separate from game difficulty".
- Gaps only bite a skier who reaches the lip below about 12 m/s.

---

## 3. Scores (from the physics/gameplay point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7.5 (low confidence) | Only 04, 04b, 04c and 09d were viewed. The windsock and spindrift telegraph is bold and readable, and the rock patches read clearly from close up and at about 100 m (04b and 04c fix my round-2 N5). The rock slabs look like splayed blades rather than natural outcrops. Reviewer A owns this category. |
| Environmental uniqueness | 8.5 | Squall lanes (3–7 per Sprint), lee rock, jump squalls with landing rock, spines with gaps, and chase-side viewpoints make the Fjord play measurably unlike Alpine. Spines and gaps are still modest: under 1 s saved on average, and the gap stake disappears at racing speed. |
| Skiing and hazard mechanics | 7.5 | The hazards are bounded, telegraphed, deterministic and skill-rewarding (blind skier 6.2 s against reader 1.9 s per Sprint). But the cornice soft-lock is back in a new form (defect 1), the cave-wall launch is reachable on the sea side (defect 2), and slow gap entries crash although the developers claim they do not (defect 5). |
| Difficulty and fairness | 8 | 0 environment-caused crashes in 1,092 runs, and the ladder is right at Standard and Endurance. Sprint is at parity to +3 %. Relaxed is Alpine-equivalent by design (defect 3). Hard Endurance jumps steeply (defect 6). The cornice trap is a fairness defect. |
| Cinematics | n/a | Not assessed; outside my scope. |
| Performance and stability | 8.5 (low confidence) | Headless Fjord costs 9.4 ms per simulated second against Alpine's 9.3 (Endurance runs, interleaved). Expedition 50 km and Endless 20 km complete with 6 peak bands. Byte-identical determinism holds forward and with the far end generated first, at every difficulty. Not GPU-measured. |
| Accessibility and controls | 8 (low confidence) | The controls are the same as Alpine. The telegraph is visible in 04. The cornice trap's only escape (pop) is not taught anywhere, which is an accessibility issue too. |
| Overall player experience | 8 | A fair, distinctive 2/5 location that rewards reading the wind. It is held back by one regression an exploring player can hit (the cornice) and one launch glitch near caves. |

---

## 4. Defects

### Defect 1. **Major: cornice dead zone traps the skier (regression of round-1 B1, introduced by the round-3 retune)**

**Evidence:** `scratch/review-b-r3/strand2.test.ts`.
- Setup: 10 fresh Standard seeds, starting 4 m seaward of the line, headed 0.5–1.4 rad toward the sea at 14–45 m/s, tucked.
- When a run stopped within 0.5 m of the crest or beyond it without being relocated, the bot then tried to escape for 25 s: turn inland (heading +0.9) with the tuck held, which is the skate push (`SkierPhysics.ts:289–291`).

| Approach | Runs | Relocated | Stuck (no escape in 25 s) | Stop position |
|---|---:|---:|---:|---|
| Charged pop at the cornice | 5,600 | 349 | **87** (1.6 %) | −0.48 to +1.44 m from the crest |
| Straight at the rim, no pop | 5,600 | 9 | **2** | |

- **What the trap looks like** (`strand.test.ts`): six cases on B3F1, B3F2 and B3F4. Idle, inland skate and downhill tuck all leave the skier at 0.00–0.01 m/s after 25 s.
- **Only jumping escapes** (`strand3.test.ts`): repeated pops while turning inland or downhill free the skier in 1.3–2.9 s.
- **Why it happens:** relocation needs `beyondRim > RIM_GUARD.over` (1.5 m, `capabilities/environment.ts:200`). Between the crest and +1.5 m, the guard is at 1.0 with `CORNICE = { dragAdd: 0.12, friction: 10 }` (`fjord/biome.ts`, raised from 0.05/6 this round), and the skate push cannot overcome that.
- **Round 2:** 0 stuck in 7,200 pops with the old values.
- **Developer claim:** "162 charged pops: 3 relocations, none stranded". That test stops at standstill and does not try an escape.
- **Effect:** in a chase, the Yeti catches the skier, a loss caused by an invisible rule. Outside a chase (run-in, refuge stretches, Endless), the player is soft-locked unless they think to jump.
- **Brief:** BIOMES §5 "no invisible failure zones"; §4 "recovery rules"; Reviewer B "reject … unavoidable punishment".
- **Fix:** any one of these:
  - relocate when the skier is grounded and slower than about 2 m/s for more than 1.5 s with `beyondRim > −1`;
  - lower `RIM_GUARD.over` to about 0.3 m;
  - cap the cornice friction when speed is below about 3 m/s, so the skate push always beats it.
- **Test to add:** after any stop in the guard zone, 10 s of inland skate must reach `beyondRim < −5` or relocate.

### Defect 2. **Major (engine-wide, pre-existing; now on the Fjord's sea side): steep cliff walls launch the skier vertically**

**Evidence:** `cliffe.test.ts` trace, B3F5 Standard, starting at z 910, 38 m/s, heading −1.1:
- At z−cave = −7, x−route = −59 (the cave cliff base), speed goes from **15.2 to 59.7 m/s in one 1/60 s tick, with vy = 58.3 m/s**.
- The skier then flies **8.5 s, peaking 84.5 m above the ground**, and lands in a "sideways landing" crash.
- B3F4 shows the same thing: 7.5 → 39.6 m/s, 6.6 s of air.

**Sweep** (`cavelaunch.test.ts`): 1,080 approaches toward the cave side around every cave, on 8 seeds × Sprint/Standard/Endurance.

| Location | Runs with more than 3 s of air | Peak vertical speed |
|---|---:|---:|
| Fjord | **118** | 59 m/s |
| Alpine (mirrored) | **123** | 91 m/s |

So this is not a Fjord regression. But Fjord caves moved to the sea side this round (R4), which puts the wall where an exploring player who heads for the sea view on the run-in will meet it.

- **Cause:** `SkierPhysics.ts` around lines 311–336. Ground follow snaps `pos.y` to `heightAt`, then sets `pathSlope = (hNew − prevY)/hd`. A wall that rises 10–20 m within one step (`cavespike.test.ts`: about 20 m over 2 m at the mouth) produces a huge `pathSlope`. On the next step, `fallAway > 0` and the takeoff sets `vel.y = pathSlope × hs`. Energy is created.
- **Fix:**
  - cap the per-step rise (treat a rise greater than about `0.6 × hd` as a wall: block or deflect the horizontal velocity and do not climb);
  - clamp `pathSlope` (for example to tan 60°) before using it as the launch direction;
  - add a property test that speed never rises by more than g·dt plus the slope term in one grounded step.

### Defect 3. **Minor (design compliance): hazard intensity per game difficulty makes the Fjord equal to Alpine on Relaxed; "separate concepts" is only partly respected**

**What the code does:**
- `fjord/biome.ts:202` sets `intensity: { relaxed: 0.25, normal: 1, hard: 1.0 }`.
- Hard is identical to Normal. The comment above it ("a little more than half as hard on Relaxed, on Hard a little harder") is stale.
- `docs/BIOMES.md:27–29` says game difficulty "scales the Yeti" and does not mention hazard scaling.

**What it does on Relaxed** (`probes.test.ts P=R`, 8 Sprint seeds × all lanes × 8 arrival phases = 344 passes):

| Measure | Relaxed | Normal |
|---|---|---|
| Blind skier drift, median / p90 | 0.22 / 0.98 m | 1.36 / 4.71 m |
| Blind skier ends in the lee rock | 10/344 | 128/344 |
| Rock-core loss at 20 m/s | 0.35 m/s | 1.33 m/s |
| Airborne drift, p90 | 1.1 m | 2.6 m |

**The ladder on Relaxed** (my balance, fresh seeds):

| Length | Fjord against Alpine (competent drivers) | Average driver wins, Alpine / Fjord |
|---|---|---|
| Sprint | **−0.4 % to −1.3 % (the Fjord is faster)** | 5/12 and 5/12 |
| Standard | +0.6 % to +1.3 % | |
| Endurance | +1.4 % to +2.4 % | |

**Counterfactual** (`INT=0.6`, Relaxed Sprint, 12 seeds): competent times come out at −0.3 % to +1.0 % against Alpine, and the average driver still wins 3/12. Approachability is kept and the ladder holds.

Scaling the biome's hazards with the game setting is defensible ("approachable on Relaxed"), but at 0.25 it switches the biome off.

**Fix:**
- Relaxed intensity about 0.5–0.6.
- Either make Hard > 1 or say plainly that it is not.
- Document the coupling in BIOMES.md.
- Add a fresh-seed assertion: Fjord competent time ≥ Alpine's on Relaxed Sprint, pooled over at least 20 seeds.

### Defect 4. **Minor: thin Sprint ladder on Normal**

**Evidence:** `bal-sprint.jsonl`, 12 fresh seeds, Normal, paired seeds both locations won:

| Driver | Fjord against Alpine |
|---|---|
| Reader | **+0.3 %** (Fjord slower on 8/12 seeds) |
| Skilled | +2.8 % |
| Intermediate | +1.7 % |

- Per-seed course variance is −18 to +15 s, larger than the environment's effect.
- Hard is clearly harder: +2.4–3.9 %, and the intermediate driver wins 4/12 against Alpine's 6/12.
- This matches the developers' own "open issue 1". The round-2 inversion is gone, so this is now Minor.
- **Fix:** more decisions per km on Sprint, or a slightly higher Normal intensity on short lengths. Add the pooled-seed assertion from defect 3.

### Defect 5. **Minor: the gap's stake only exists below about 12 m/s, and slow entries crash, contrary to the developers' claim**

**Gap counts:**
- Sprint: 9 gaps on 8 of 10 courses (round 2: 0 of 8).
- Standard: 25 gaps on 10 of 10 courses.

**The stake** (`gap.test.ts`, 17 Standard gaps):

| Approach | Lip speed (median) | Dropped into the gully | Crashes |
|---|---:|---:|---:|
| Starting 15 m before the lip at 6 m/s | 8.9 m/s | 17/17 | 4 ("hard landing") |
| Starting 15 m before the lip at 9 m/s | 10.4 m/s | 10/17 | 4 |
| Starting 15 m before the lip at 12 m/s | 12.4 m/s | 1/17 | 1 |
| Lip speed 14.5 m/s or more | ≥ 14.5 m/s | **0/17** | 0 |
| Starting 70 m before the lip, 9 m/s, untucked | 15.5 m/s | **0/17** | 0 |

- Speed lost through a gap at racing speed is 1.3–2.4 m/s whichever way it is taken.
- The developers' "falling in below ~18 m/s untucked" and "−3.6 m/s at 10 m/s" counts first ground contact on the long run-out ramp as "in". By real gully depth (more than 0.8 m), a racer never drops in.
- `gap2.test.ts`: the slow crashes are "hard landing" at 7–11 m/s. One idle 6 m/s entry (B3F6, gap at z 6436) sat on the gully floor for 43 s until skating. That is not a soft-lock, because tuck/skate frees it.
- The unit test (`fjord_r3.test.ts:114–151`) never asserts that the slow run lands "in".
- **Fix:** if the gap is meant to ask something of a racer, make the clear distance speed-sensitive at 18–24 m/s (longer gully or lower kicker). Make slow drop-ins a no-crash landing (the floor ramp should absorb a 2 m drop at ≤ 11 m/s), or say in the copy that a slow drop-in crashes.

### Defect 6. **Minor: steep Hard Endurance step from Alpine (1/5) to Fjord (2/5)**

**Evidence:** `bal-end.jsonl`, 10 fresh seeds, Hard:

| Driver | Alpine wins | Fjord wins |
|---|---:|---:|
| Reader | 7/10 | **4/10** |
| Skilled | 7/10 | **3/10** |

- Mean minimum Yeti gap: Alpine 23–26 m against Fjord 8–13 m.
- Normal Endurance (+3.3 % to +6.6 %) and Relaxed are fine.
- Because Hard intensity equals Normal's, this is the 20 km accumulation of environmental cost. It leaves little room for locations 3–5.
- **Fix:** watch this when tuning defect 3/4. A Hard intensity of about 0.85 on Endurance and longer, or a fixed per-refuge budget, would smooth the step.

### Defect 7. **Minor: the jump-squall landing rock is only weakly tied to the gust**

**Evidence:** `probes.test.ts P=A`, 510 squall-kicker jumps on 6 Standard seeds × 6 phases, Normal.

| Takeoff | Landed in the landing rock |
|---|---:|
| With the squall | 118/510 |
| **In calm** | **90/510 (18 %)** |

- `JUMP_ROCK_INSET 2.5 + 0.55 r` puts the patch's inner edge about 0.5 m inside the straight landing line.
- One wind run of 510 drifted into a log (B3F1, z 5113; "tripped on a log"). The calm run did not.
- **Fix:** move the landing rock 1.5–2 m further onshore so a calm or upwind takeoff clears it.

### Defect 8. **Minor (documentation): stale comment and undocumented coupling**

- `fjord/biome.ts:200–201` describes intensities that are not the values used.
- `docs/BIOMES.md` does not mention `HazardSetup.intensity`.

### Round-2 (and still-open earlier) defects: status from my own measurements

| # | Finding | Status | My numbers (fresh seeds) |
|---|---|---|---|
| N1 | Fjord easier than Alpine at Standard and above | **Fixed** at Standard and Endurance; **partially** at Sprint and Relaxed (defects 3, 4) | See the ladder table below. Route gradient: Sprint 15.2° against Alpine 15.8°, Standard 16.1° against 16.7°, Endurance 15.4° against 16.3° (`P=G`, 10 seeds). |
| N2 | One viewpoint per Sprint or Standard | **Fixed** | See the viewpoint notes below this table. |
| N3 | Gaps rare and riskless; airborne squall negligible | **Partially fixed** | Gaps: see defect 5. Airborne drift on Normal over uniform arrival phases: median 0.57 m, p90 **2.62 m**, max **4.90 m** (round 2: p90 0.54 m). Airborne crash differences: 1 in 510 (defect 7). |
| N4 | The way round a rock runs into boulders | **Fixed** | 167 rock-on-line patches on 12 seeds; clearance from the way round to the nearest obstacle: min **3.39 m**, p10 9.9 m (round 2: min 0.92 m). The reader driver never crashed into a boulder in 1,092 runs. |
| N5 | 04b showed no rock | **Fixed** | `final/04b_hazard_rock.png` shows a rock patch in close-up; `04c` shows two patches and the windsock from about 100 m. |
| B1 (r1) | Cornice soft-lock | **Regressed** (defect 1) | Relocation itself still works (349 relocations, max 3.5 m beyond the crest), but 87 of 5,600 pops get stuck. Route-to-rim distance is now median 60 m, p10 54 m, min 49 m (round 2: 105 m). |
| B4 (r1) | Signature mechanic slight | **Fixed** | See the squall and rock notes below this table. |
| B5 (r1) | Spines sparse and worthless | **Partially fixed** | Spines on Sprint: 13 of 13 exposed segments. Standard: **34 of 41** (the developers claim 41 of 41). Saving for a tucking follower entering at 24 m/s: Sprint mean 0.46 s (−1.26 to +2.37), Standard mean 0.76 s (−0.90 to +2.47). 0 crashes on spines. |
| B6 (r1) | Windsock pole near the line | **Fixed** | Minimum pole distance to the route is 5.17 m (Sprint) and 4.59 m (Standard); the rule is ≥ 4.5 m. |
| B7 (r1) | Viewpoint ids not unique | **Fixed** | Ids are unchanged in form; ids from round 2 were unique. |
| B8 (r1) | Hard near-miss bleed | **Fixed** | Hard Sprint: reader and skilled win 11/12 in both locations. |
| — | Snowball landing clamp into the cornice (developers' open issue 5, merged fix) | **Fixed** | 0 of 56,400 clamped landing points are in the guard zone. |
| — | Sea-side caves (R4) | **Done (mechanics)** | 50 of 50 caves are on the sea side. The guard is 0 on the line and 6 m seaward across the whole ±150/250 m cave zone. Endurance wins all survive 3 encounters. Defect 2 sits at the cave wall. |

**N2 detail (viewpoints).** 10 seeds per length.
- Per course:
  - Sprint: **3.2** on average (1–4), of which 2.2 are chase-side.
  - Standard: **7.5** (5–10).
  - Endurance: **13.6** (10–18).
- Chase-side detours (`vp.test.ts`, the bot enters 3 m inside the radius and comes back):

| Difficulty and driver | Viewpoints reached | Wins with detours | Wins direct | Outcome flips | Cost per viewpoint (median) |
|---|---:|---:|---:|---:|---:|
| Normal skilled | 22/22 | 9/9 | 9/9 | 0 | 2.1 s |
| Hard skilled | | 8/9 | 8/9 | 0 | |
| Hard intermediate | | 3/9 | 4/9 | 1 win → loss | |

- My crude line pays about 2 s per viewpoint. The developers measure ≤ 0.3 s for a tight swerve.
- The run-in viewpoints sit before the trigger, so they are free in chase terms. My bot stalled in deep snow 45–75 m off the line beside several of them (a bot artefact; a human skates).

**B4 detail (signature mechanic).**
- Lanes per Sprint: 3–7 (min 3; round 2: 0–3). Lanes per Standard: 21–26.
- On Normal, a blind tucking follower drifts onshore by a median of 1.36 m, p90 4.71 m and max 5.64 m. It ends in the lee-rock core in 37 % of passes. A pass costs a median of 0.24 s (max 1.62 s).
- A 3.5 m upwind hold cancels the drift (median 0.00 m).
- Rock core at 20 m/s: −1.33 m/s; going round costs −0.15 m/s.
- Environment on minus off, Sprint, Normal: the blind skilled skier pays **+6.17 s** and the reader **+1.88 s**. On Hard: +7.3 s against +4.2 s.
- No environment-caused crash in 1,092 runs.

---

## Difficulty ladder (my fresh seeds, environment on)

Paired Fjord − Alpine times are on the seeds both locations won. Wins are Alpine / Fjord.

**Sprint, 12 seeds (`B3F1`–`B3F12`):**

| Difficulty | Reader | Skilled | Intermediate | Average (wins) |
|---|---|---|---|---|
| Relaxed | −0.7 % (12/12, 12/12) | −0.4 % | −1.3 % | 5/12, 5/12 |
| Normal | **+0.3 %** | +2.8 % | +1.7 % | 1/12, 0/12 |
| Hard | +2.4 % (11/12, 11/12) | +3.9 % (11/12, 11/12) | 6/12, **4/12** | 0, 0 |

**Standard, 10 seeds:**

| Difficulty | Reader | Skilled | Intermediate | Average (wins) |
|---|---|---|---|---|
| Relaxed | +1.2 % | +1.3 % | +0.6 % | 1/10, 0/10 |
| Normal | +2.5 % | **+5.3 %** (Fjord slower on 10/10 seeds) | +4.4 % (10/10 seeds) | 0, 0 |
| Hard | 8/10, 8/10 (+2.9 %) | 9/10, **6/10** (+4.4 %) | 1/10, 1/10 | 0, 0 |

**Endurance, 10 seeds:**

| Difficulty | Reader | Skilled | Intermediate |
|---|---|---|---|
| Relaxed | +2.1 % | +2.4 % | +1.4 % |
| Normal | +3.3 % | +6.6 % (10/10 seeds) | +5.5 % (10/10 seeds) |
| Hard | 7/10, **4/10** | 7/10, **3/10** | 0, 0 |

- **Fjord environment cost (on minus off), Sprint:**
  - Relaxed: 0.3–1.3 s.
  - Normal: reader 1.9 s, blind 5.8–6.2 s.
  - Hard: reader 4.2 s, blind 7.3 s, with 4 win→caught flips for the intermediate driver.
- **Crashes:** Fjord 6 "hard landing" (bots on jumps and gaps), Alpine 0. No hazard-caused crash.
- **Weaker drivers** (cautious, careless) lose everywhere in both locations, as in Alpine.

## 5. What works

- **The squall lanes are now the signature they were meant to be.** They are dense (≥ 3 per km), telegraphed (windsock and spindrift, `04_signature_hazard.png`), always onshore, and capped. They never knock the skier down, and a 3.5 m upwind hold counters them completely. The skill gap (6.2 s against 1.9 s per Sprint) is real skill expression at 2/5.
- **The ladder is fixed where it matters most.** Standard and Endurance are harder than Alpine at every difficulty on unseen seeds. This comes from terrain at parity (the Fjord route is 0.6–0.9° flatter) plus the environment, not from the Yeti (`yetiSpeed` is still per game difficulty only).
- **Viewpoints are free and plentiful,** including chase-side ones, with no outcome change at Normal.
- **Rock placement is clean**, with ≥ 3.4 m clearance on the way round. The snowball clamp keeps out of the cornice zone.
- **Determinism:** byte-identical runs, events, viewpoints and hazard layouts (relaxed, normal and hard; forward and with the far end generated first). The layout is identical across difficulties, so course codes stay valid.
- **Long modes and performance:** Expedition 50 km (8 encounters) and Endless 20 km run clean. Headless performance is at parity with Alpine. `tsc` is clean and 50/50 Fjord unit tests pass.

## 6. Brief compliance: Fjord gameplay bullets (Reviewer B scope)

| Brief item | Status | Evidence |
|---|---|---|
| Large open downhill runs | **done** | Width ×1.08; gradient at Alpine parity (15.2–16.1°). |
| Scenic branching paths | **partial** | Spines bow seaward on 34 of 41 Standard exposed segments. They are short alternates, not branches past a view. |
| Optional shortcuts along ridgelines | **partial** | Present almost everywhere, but they save 0.46–0.76 s on average and some are slower. |
| Gentle coastal crosswinds | **done** | Lanes, gust drag and airborne push are bounded (≤ 5.6 m drift), telegraphed and counterable. |
| Exposed coastal rocks | **done** | Rock on the line, in the lee and at landings; −1.3 m/s through the core, −0.15 m/s going round. |
| Small terrain gaps and jumps | **partial** | Present on 8 of 10 Sprints. No stake at racing speed; slow entries crash (defect 5). |
| Optional exploration bonuses at viewpoints | **done** | 3.2 per Sprint and 7.5 per Standard; free at Normal. |
| Not mandatory detours / no punishment for the fastest line | **done** | The racing line never needs a viewpoint, and the readers are fastest. |
| Never a faster Yeti per biome (§2, §4) | **done** | Yeti speed comes from game difficulty only. |
| Biome difficulty separate from game difficulty (§2) | **partial** | Hazard intensity is scaled 0.25 / 1 / 1 by game difficulty, so on Relaxed the Fjord ≈ Alpine (defect 3). |
| Relaxed approachable / Hard challenging (§2) | **done** | Relaxed average driver wins 5/12 Sprints. On Hard, the Fjord is challenging at every length, steeply so at Endurance (defect 6). |
| Alpine remains easiest; sensible ladder (§3, §10) | **partial** | Done at Standard and Endurance on Normal and Hard. Parity at Sprint Normal and Sprint Relaxed (defects 3, 4). |
| Hazards fair, telegraphed, testable (§4) | **done** | 0 hazard crashes in 1,092 runs; unit tests exist. |
| No invisible failure zones / out-of-bounds recovery (BIOMES §5) | **missing (regressed)** | Cornice dead zone (defect 1). |
| Coastal shelters as refuges (§5) | **done** | All 67 Fjord Endurance wins survive 3 encounters. Endless 20 km and Expedition 50 km complete. |
| Deterministic seeds (§10) | **done** | `probes.test.ts P=D`. |

## Evidence the set lacks

- No screenshot of a gap jump (gap-marker poles) or a spine.
- No screenshot of a stranded or relocated skier at the rim.

These are needed to judge whether the gap and the cornice are readable to a player.

## Reproduction

Run from `/home/claude/sf-fjord`. Logs are in `scratch/review-b-r3/out/`.

```
OUT=scratch/review-b-r3/out/bal-sprint.jsonl LENS=sprint SEEDS=B3F1,...,B3F12 npx vitest run --config scratch/review-b-r3/vitest.config.ts scratch/review-b-r3/balance.test.ts
#   (+ ENV=off BIOMES=fjord; LENS=standard|endurance SEEDS=B3F1..B3F10; INT=0.6 DIFFS=relaxed BIOMES=fjord)
node scratch/review-b-r3/table.mjs scratch/review-b-r3/out/bal-*.jsonl
P=S|R|A|V|C|K|D|G NSEEDS=10 npx vitest run --config scratch/review-b-r3/vitest.config.ts scratch/review-b-r3/probes.test.ts --disableConsoleIntercept
npx vitest run --config scratch/review-b-r3/vitest.config.ts scratch/review-b-r3/{strand,strand2,strand3,cliffd,cliffe,cavelaunch,cavespike,gap,gap2,vp,wayround,long,obst}.test.ts --disableConsoleIntercept
```

# Whiteout Ridge, round 1: Review B (Physics & Gameplay Designer)

- **Reviewer:** B, Physics & Gameplay Designer. Owns category 3 (Skiing and hazard mechanics) and category 4 (Difficulty and fairness).
- **Nature:** model-based reviewer, **not a human playtester**. I did not play the game in real time. Every judgement about feel is inferred from code, headless simulation and still frames.
- **Build:** `3f7bc45` (branch `pass5-whiteout`). Per `CANDIDATE.md`, `src/` is identical to `0f04659`.
- **Examined:**
  - Source: `src/world/biomes/whiteout/{hazards,storm,biome}.ts`, `views/hazardViews.ts`, `src/world/capabilities/environment.ts`, `src/physics/SkierPhysics.ts` (slip, drag, knock, pop, relocate), `src/yeti/YetiAI.ts` (speed model), `src/game/CourseConfig.ts` (`DIFFICULTY`), `src/game/GameSession.ts` (hazard captions, weather HUD).
  - Data: every `.jsonl` file in `balance/w034/`, which I recomputed myself, and `round-1/courses.json`.
  - Frames: `evidence/05_storm.png`, `evidence/18_hard_snowball_fog.png`, `baseline/04_signature_hazard.png`.
- **My own experiments:** I copied the committed harness (`tests/sim/balance.ts`, `whiteoutDriver.ts`) to `/tmp/expB` and changed only the import paths. It reproduces the published rows bit-for-bit (for example W034-01 Normal blind: caught, 135.3 s, 2021 m). Every number below marked **[B]** is my own measurement. Numbers marked **[dev]** come from developer documents and were re-derived from the raw data unless I say otherwise.
- **Measurement limit:** the driver sees through fog. Nothing here measures the human cost of low visibility, and that cost can only make the fairness findings worse.

## Verdict: **FAIL** (cat. 3 and cat. 4 are below 9)

| # | Category | Score | One-line justification |
|---|---|---|---|
| 1 | Visual art direction | 7 (lc) | Only three frames viewed. The storm frame reads well. Outside my speciality. |
| 2 | Environmental uniqueness | 7 (lc) | Fronts, ridge and drifts are distinct from Alpine and Fjord in code. Not assessed in depth. |
| **3** | **Skiing and hazard mechanics** | **5** | Well built and deterministic, but the weather decisions do not pay. An unadvertised hop beats every intended choice. Drift visuals do not match drift physics. |
| **4** | **Difficulty and fairness** | **4** | Hard's weather is gentler than Normal's (0.65 < 0.8). There is a Normal cliff after Fjord. The signature Classic course loses on Normal. Most blizzard knocks arrive without the "stand up" warning. Relaxed is knocked more often than Normal. |
| 5 | Cinematics | 7 (lc) | Not examined beyond the manifest. |
| 6 | Performance and stability | 7 (lc) | Not examined. The simulations were deterministic and threw no errors. |
| 7 | Accessibility and controls | 6 (lc) | Blizzard warnings depend on a caption that most knocking cells never trigger (F3). |
| 8 | Overall player experience | 6 (lc) | A strong premise, but on Normal skill has no visible payoff. |

## Findings

### F1 (Major): The weather decisions do not reward good play (confirms W-035 independently, and the problem is wider than reported)

**Recomputed from the raw W-034 data** (Normal Sprint, 24 seeds, wins against the weather-blind driver; paired results are wins gained / lost):

| Policy | Wins | Paired vs blind |
|---|---|---|
| blind | 15/24 | n/a |
| informed (all three decisions) | 14/24 | +2 / −3 |
| sheltered line in storms only | 17/24 | +4 / −2 |
| stand up in blizzards only | 16/24 | +1 / 0 |
| steer for drift gaps only | 12/24 | 0 / −3 |
| early drift reader | 13/24 | n/a |

The other difficulties tell the same story:
- **Relaxed:** informed play is 22/24 against blind 24/24, and informed runs are **4.4 s slower** when both win.
- **Standard Normal:** informed 4/12, blind 6/12.

The developers' claim that informed play keeps a larger safety margin (median minimum gap 31 m against 17 m) does reproduce. But among victories only, the medians are 42 m and 38 m, so the claim mostly reflects how many runs were caught, not a wider margin within wins.

**[B] Is this a driver artifact?** The driver stands up whenever its heading error exceeds 0.16 rad (`whiteoutDriver.ts`, the `tuckTol` setting). That alone could explain why detours look expensive. I added a policy that holds the tuck at all times and steers early for the gap (`gapTuck`), and compared it with a tuck-held blind driver:

| Difficulty | gapTuck | blindTuck | Paired | Time when both win |
|---|---|---|---|---|
| Normal | 14/24 | 15/24 | +1 / −2 | 1.5 s faster |
| Relaxed | 22/24 | 24/24 | 0 / −2 | 2.2 s slower |

So even a skier who keeps the tuck gains nothing from taking the gap. This is a design result, not a quirk of the driver.

**Why the decisions don't pay (verified in code):**
1. **The Yeti sits at the skier's speed.** `YetiAI.ts:243` gives the Yeti a base speed of 16.5 m/s. The blind skier's mean speed on Whiteout Normal Sprint is 16.52 m/s (Alpine 20.4, Fjord 18.3). Normal therefore sits on a knife edge, and the outcome is set by the sum of the flat costs, not by any single decision.
2. **The sheltered line exists only on the alternate-line stretches.** `whiteoutExposure` (`storm.ts:339-345`) depends only on the segment type, plus the alternate lane where one exists. There is no sideways shelter within a segment. The sheltered driver logs 0 samples on alternate lines against 92 for the exposed driver (about 16% of the course). The front caption's advice to "take the sheltered line" (`GameSession.ts:1185`) is actionable less than a fifth of the time.
3. **The flat costs ignore what the player does:**
   - **Skid drag** is computed from the raw slip, before the stance and edging factors in `SkierPhysics` (`environment.ts:262-269`). Edging or standing up cannot reduce it. At full exposure it adds up to `0.0028 × 2.2 × 0.8 ≈ 0.005` to the drag coefficient. That is more than the whole tuck drag coefficient (0.004).
   - **Headwind** drag (`environment.ts:242`) is applied regardless of tuck and heading, although its comment says "upright skier".
   - **The blizzard cell's slip** has no exposure term (`hazards.ts:152-153`), although the file header says "more on exposed ground" (`hazards.ts:10-12`).
   - **Blizzard placement:** cells sit on `routeX` with an effect radius of r + reach = 84 m (`hazards.ts:138-140`). Every measured piste half-width is narrower than that, so there is no lateral escape. The only response is the stance.
4. **Ablation (re-derived):** with all weather removed, Normal wins 24/24; removing only drifts and blizzards gives 23/24; removing the headwind gives 20/24; removing slip and skid drag gives 19/24. The difficulty is made of costs the player cannot avoid.

**Fix direction (within the owner's constraints):** make the costs avoidable rather than smaller, keeping the cost to a blind skier about the same, so that informed play pulls ahead.
- Scale skid drag by the same factors as the slip itself (`SLIP_EDGE`: edging resists it).
- Scale headwind by stance and exposure, so standing up in shelter is cheaper than tucking on the crest.
- Give the sheltered line a real lateral meaning inside a segment: lee-side exposure from the crest distance, which `terrain.ridge` already has.
- Give the drift gap a scoured hard-pack lane (lower friction), so taking it *gains* speed rather than merely avoiding a loss.
- Optional, needs owner sign-off: let the Yeti pay drift drag on rows that cross its line, mirroring its existing canopy and powder penalties (`YetiAI.ts:7, 233`). This never raises Yeti speed.

### F2 (Major): An unadvertised dominant strategy. Hopping drift rows beats every intended choice, and the skier clips through the mounds

The drift effect returns nothing for an airborne skier (`hazards.ts:113`: `if (!c.inside || !c.grounded) return null`). The mound is not part of the terrain height (`heightAt`); it exists only as a view. A full pop (`TUNING.popBase + popCharge` = 4.4 m/s, `SkierPhysics.ts:615-623`) carries the skier about 1 m above the slope for about 0.9 s, roughly 17 m at speed. That clears a mound core.

**[B]** A driver that holds the tuck and pops about 0.35 s before each drift row on its line (no gap steering) scored:

| Difficulty | hop | blindTuck | Paired | Time when both win | Crashes |
|---|---|---|---|---|---|
| Normal | **20/24** | 15/24 | **+5 / −0** | **4.4 s faster** | 0 |
| Relaxed | 24/24 | 24/24 | n/a | 2.9 s faster | 0 |

That is about 13 pops per Sprint. It is the only weather response I found that clearly pays, and nothing in the game teaches it: no caption, hint or document mentions jumping drifts.

The visual heights are also a problem. The drift view builds a mound **1.7–2.2 m** high (`hazardViews.ts:93`), while the pop apex is about 1 m. A hopping skier passes through the drift mesh. A grounded skier rides *inside* a 2 m mound, because the terrain height under the mound is unchanged. This is inferred from code; no evidence frame shows it.

**Fix direction:** decide whether the hop is intended.
- **If yes:** make it a readable, timed skill. Put the mound into the physics (a smooth height field, so the crest is a kicker and the lee is a landing) and say it in the drift caption.
- **If no:** apply a reduced drift effect on landing inside the core and a short-range height check.

Either way, the mound geometry and the physics must agree.

### F3 (Major): Most blizzard knocks hit players who were never shown the warning

A knock keeps only **58%** of speed (`BLIZZARD.knockKeep`, `hazards.ts:54`); at 20 m/s it removes about 8 m/s. The "stand up out of the tuck" caption is attached only to the `hazard-telegraph` event (`GameSession.ts:814-817`). That event fires only if the cell enters the tracked window (≤150 m ahead, `HAZARD_ALERT_RANGE`) while it is in its telegraph phase. A cell first seen already active emits only `hazard-active`: a roar cue, and no caption or advice.

**[B]** I instrumented `env.listen` on the blind driver over the W-034 seeds (24 Sprint and 12 Standard per difficulty):

| Run | Knocks | Knocks from cells that never telegraphed | Cells first reported active |
|---|---|---|---|
| Sprint Normal | 22 | **13 (59%)** | 20 of 49 |
| Standard Normal | 47 | **32 (68%)** | 40 of 106 |
| Standard Relaxed | 71 | **49 (69%)** | 57 of 148 |
| Sprint Hard | 10 | 6 | 13 of 27 |

The registration rule `MIN_TELEGRAPH_S` is met for each cell in isolation, but it is not met from the player's seat. In a storm (fog at about half strength around 80 m, ×4.2 inside a cell, `hazards.ts:56`), the active curtain may be the first thing a human sees, about 4 s out. Deaf and hard-of-hearing players get no warning at all for these cells.

**Fix direction:**
- On first sight, warn about any cell whose remaining active time will overlap the skier's arrival, not only cells in the telegraph phase. Caption `hazard-active` the same way.
- Or base the alert range on arrival time: speed × (telegraph + active).
- Or extend the alert range for blizzards specifically.

### F4 (Major): The difficulty ladder is inverted on the weather axis and has a cliff at Normal

**1. Hard's weather is gentler than Normal's.** `biome.ts:147` sets `intensity: { relaxed: 0.5, normal: 0.8, hard: 0.65 }`. Commit `816ad73` explains: "Hard carries snowballs". But the measurement sets `dodge: true` (`balance.ts`), and in the data snowball hits are **0 of 1,409 throws** across all Whiteout Hard rows (my recount). The snowball cost to a human in fog is unmeasured. The measured extra difficulty of Hard comes from the global Yeti ×1.07 alone. Choosing Hard on a weather-themed map gives the player a *weaker* storm: lower drift drag, blizzard slip and skid drag (the headwind is equal on Normal and Hard, `storm.ts:179`).

**2. A cliff at Normal (re-derived):**

| Course | Alpine | Fjord | Whiteout |
|---|---|---|---|
| Normal Sprint | 24/24 | 23/24 | **15/24** |
| Normal Standard | 12/12 | 12/12 | **6/12** |
| Hard Sprint | 12/24 | 8/24 | 6/24 |
| Hard Standard | 2/12 | 0/12 | 0/12 |
| Relaxed (Sprint and Standard) | all wins | all wins | all wins |

On Normal, Whiteout (rating 3) is about as hard as **Alpine Hard**, for a fog-proof bot with a 0.25 s reaction time. That leaves little room for Frozen (4) and Volcanic (5). The Hard Standard result (0 to 2 wins in 12) is a shared-engine matter and outside Whiteout scoring.

**3. [B] The signature course** (`CLASSIC-SPR@WHITE`, the fixed Classic mountain most players meet first), Normal:

| Policy | Outcome |
|---|---|
| blind | wins, minimum gap 19.6 m |
| **informed** | **caught at 1,145 m** |
| **sheltered line only** | **caught at 1,116 m** |
| drift-gap policies | caught at about 2.3 km |
| stand-up only | wins with a 6.4 m minimum gap |

On `CLASSIC-STD@WHITE` Normal, **all six policies are caught**; Fjord and Alpine win there. `courses.json` agrees: the skilled autopilot is caught on CLASSIC-SPR, CLASSIC-STD and 5 of 7 Daily Standard courses.

**Fix direction:**
- Hard intensity should be at least Normal's.
- Make Hard distinct through harsher *decision* penalties (shorter clear windows, more off-line drift rows), not through a lighter storm.
- Bring Normal back toward "skilled reader wins clearly, blind skier often loses" by converting flat costs (F1). That raises informed wins without lowering the weather, and the Yeti speed stays untouched.

### F5 (Minor): Relaxed is knocked more often than Normal

The knock threshold (`w > 0.7`, speed > 17 m/s) and `knockKeep` 0.58 are not scaled by difficulty intensity; only the wobble is (`hazards.ts:156`). Relaxed skiers are faster, so they cross 17 m/s more often:
- **Recomputed knocks per run, blind:** Relaxed Sprint 1.46 against Normal 0.92; Relaxed Standard 5.92 against Normal 3.92.
- **[B] Trace of W034-14, Relaxed, drift-gap policy:** speed fell from 19.7 to 11.8 m/s at z ≈ 590 (consistent with a knock). The skier never got back above about 12 m/s on the gentle ground that followed and was caught at 830 m.

**Fix:** scale `knockKeep` toward 1 with intensity, for example `keep = 1 − 0.42 × I`.

### F6 (Minor): Drift visuals do not match drift physics

- **Physics:** a circle of radius r with the effect at zero beyond r (`hazards.ts:115`). Mounds are spaced 1.64–1.9 r apart, so a row has nearly free seams between them.
- **View:** a mound with half-length **1.5–2.1 r** along the row and half-depth 0.75 r (`hazardViews.ts:91-92`). The row reads as one continuous wall (compare `baseline/04_signature_hazard.png`).
- **The gap:** the view tapers into it. At 0.8 L the mound still stands about 0.75 m high, which leaves a visible opening of only about 2–4 m, against a physical clear corridor of about 6.6 m (`gapHalf` 4.8 m − 0.2 r on each side).

**[B] Expected loss for an untargeted crossing** (1D integration over random row layouts, Normal, hard pack, 18 m/s): mean **4.4 m/s**, 90th percentile 6.7 m/s. A crossing through a mound centre loses about 7.1 m/s.

**Fix:** make the view's footprint match the physics, or the physics match the view, and draw the gap at its real width.

### F7 (Minor): The drift-gap override can leave the piste (latent)

In `hazards.ts:98-99`, `gapX` is clamped to the piste and then forced to `rx ± 12` when it lands within 12 m of the line, with no second clamp. **[B]** A scan of 120 Standard courses (3,748 rows) found **0 fully blocked rows** and 2 off-line rows whose best interior gap is under 6 m:
- 59% of rows cover the line (matching the design);
- the median sideways move to the edge of a clear corridor is 8.6 m (90th percentile 14.1 m).

Low risk today, but worth a second clamp.

### F8 (Minor): A terrain step inside the piste

**[B]** On W034-24 (z 526–553) there is a 5–6 m step about 8–10 m beside the route line, inside the nominal piste. The Relaxed drift-gap driver ran into it at 17 m/s, stopped, and was caught at 542 m. Driver behaviour contributed, but a step of that height that close to the line is risky in 80 m visibility. Reviewer A should check it in a frame.

### F9 (Minor): Documents contradict the code

- `hazards.ts:13` says the blizzard "never knocks or crashes by itself", but the kind is registered with severity `knock` (`hazards.ts:127`).
- `hazards.ts:10-12` says the slip is "more on exposed ground", but the cell's slip has no exposure term.
- `environment.ts:241` says "upright skier", but the headwind applies in the tuck too.

### F10 (Evidence gap)

The round-1 visual suite has **no frame of a drift row with its gap, and none of a blizzard cell in its telegraph or active phase**. These are the two signature hazards, so the claims that they are "visible from far off" and that the "wall is seen coming in from upwind" (`hazards.ts:7, 10`) cannot be verified. Combined with the fog-blind driver, the readability of every weather decision is unmeasured.

## What is good

- **Engine:** clean and pure. Hazard placement and fronts are deterministic, and every `courses.json` row passes `roundTrip` and `deterministic`. The pass-report fix after W-034 is sound.
- **Hazard behaviour:**
  - Blizzards never crash the skier and do not slow them outright: speed in a cell is 17.2 m/s against a 16.5 m/s run mean.
  - No drift row fully blocks the piste.
  - Ridge-rim relocation is rare: 0–0.17 crashes per run.
  - The HUD front forecast (`STORM IN n s` with a direction arrow) is a good telegraph.
  - The storm frame `05_storm.png` stays readable: wands, lamps and the HUD pill are all visible.
  - The Hard snowball ring shows through the fog (`18_hard_snowball_fog.png`).
- **Honest self-measurement:** W-034 states its own negative result (W-035) and the fog limit, and its numbers reproduce.
- **The terrain itself is fair:** with all weather removed, the same driver wins 24/24.

## What would raise my scores to 9

**Category 3 (Skiing and hazard mechanics):**
- **F1:** each weather decision shows a measured paired benefit. Suggested bar: informed beats blind by at least +3 net wins out of 24 on Normal Sprint and by at least 2 s when both win, with blind's win rate roughly unchanged.
- **F2:** the hop is either designed and taught (mound in the physics) or closed.
- **F6:** the drift view's footprint matches the physics.
- **F9:** the documentation contradictions are fixed.

**Category 4 (Difficulty and fairness):**
- **F3:** at least 90% of blizzard knocks are preceded by a captioned warning at least 3 s before the knock, measured with the listener method above.
- **F4:** Hard intensity is at least Normal's. The signature Classic Sprint and Standard courses are winnable by the informed driver on Normal. Normal Whiteout lands clearly between Fjord Normal and Alpine Hard.
- **F5:** Relaxed knocks no more than Normal.
- **Evidence:** a fog-aware driver (perception limited to visibility) or human playtest data confirms that the weather can still be read in a storm.

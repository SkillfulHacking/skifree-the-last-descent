# Review B — Gameplay & Physics Director

> **Internal multi-agent review — separate agent instance of the same model family; not an external/independent human approval.**

## What was inspected
`src/physics/SkierPhysics.ts`, `src/physics/obstacles.ts`, `src/world/course.ts`, `src/yeti/YetiAI.ts`, `src/yeti/spawn.ts`, `src/game/simulate.ts`, `src/game/GameSession.ts` (fixed step, event handling), `src/debug/autopilot.ts`, `src/input/Input.ts`, `src/camera/FollowCamera.ts`, `docs/DESIGN.md`. I measured behaviour with throwaway Vitest scripts: planar-slope rigs, the real course and obstacles, and whole-run pursuit sims with injected crashes, reaction lag and recovery delay. All scripts have been deleted. No source files were modified.

## Evidence observed
**Terminal speed (packed snow), upright / tuck:** 8° 10.7/15.6 · 13° 14.6/21.3 · 18° 17.7/25.8 · 20° 18.7/27.3 · 26° 21.5/31.4 m/s. Going 0→20 m/s on 18° takes 9.5 s in a tuck and never happens upright. The Yeti's base speed is 16.5 m/s, so an upright skier on the main 17–20° pitches is only 1–2 m/s faster than it.

**Steering at full lock, 0.5 s window:**
| v (m/s) | carve: travel turn / radius / lat-g | tuck | drift | pizza |
|---|---|---|---|---|
| 10 | 88°/s, 5.8 m, 1.4 g | 44°/s, 12 m | 65°/s, slip 67° | 80°/s |
| 20 | 61°/s, 16.6 m, 1.9 g | 30°/s, 36 m | 44°/s, 18.8 m | 57°/s |
| 30 | 42°/s, 35 m, 1.95 g | 21°/s, 77 m | 30°/s, 43 m | 39°/s |

Carve slip angle is only 6–8°. Velocity tracks the skis almost rigidly at about 1.9 g regardless of speed.

**Keyboard:** effective steer reaches 50% at 117 ms and 90% at 250 ms. A full right-to-left reversal takes 333 ms. That is two stacked filters: the Input ramp and the physics `damp(...,14)`.

**Pizza from 20 m/s:** at 10° it stops in 8.1 s. At 15° it takes **17.9 s / 90 m**, and after 3 s you are still at 9.8 m/s. At 18°, 22° and 26° it **never stops**: the speed settles at 3.0, 6.6 and 9.2 m/s. You can still turn while braking (85% of carve rate). A brake+drift+steer hockey stop is excellent: 10–11 m on 15–22°.

**Drift:** it needs 9 m/s to activate. Drift turns *less* sharply than carving at every speed (44 vs 61°/s at 20 m/s) and bleeds about 2.5× more speed. On a sine slalom on 18°: carve 20.4–21.2 s, drift **32.3–34.5 s**, and gate accuracy is no better.

**Kickers (14):** airtime 0.56–1.0 s at 10 m/s and 0.85–1.86 s at 28 m/s, peak height 0.9–6.9 m. None of them crash you. These are good numbers. Landings from drops up to 5.5 m never crash. They are flagged "hard" and cost 15–36% of your speed.

**Unintended micro-takeoffs (air < 0.15 s):** 0 over full runs for skilled, intermediate and average drivers, 0 through the mogul fields at 14 and 22 m/s, and 0 along piste-edge lines. Clean. But see M3.

**Trees:** aimed head-on, a 6 m/s approach crashed 6/20 times; 10, 16 and 24 m/s crashed 20/20. **After a head-on tree crash, 20 of 20 cases stayed pinned against the trunk for more than 4 s, whatever the input.** I tested escape tactics over 10 s: pivot perpendicular + skate failed 14/20 (median escape time over 10 s); pivot 45° + skate failed 9/20; repeated pops gave a median 6.5 s and failed 1/20. Each pin produced about 750–950 `impact` events, roughly one per 120 Hz step.

**Camera (real course, skilled line):** the designed boom is 7.0–7.6 m. The measured skier-to-camera distance is **11.3–14.3 m at 20–26 m/s**, and camera height above the skier is 4.3–6.6 m against a design of about 2.9. On a crash the camera lurches in from 14.2 m to 9.6 m over 1 s.

**Pursuit (default seed):**
- Baseline: the skilled driver wins with a minimum gap of 56 m. The gap grows to **289 m** at chase+50 s, then falls to 171 m over the run-out. The average driver is caught at z = 2911, **89 m from the finish**, after a 101 s chase.
- With the sims' instant recovery, the skilled driver survives one or two crashes at 10/30/60 s, 10+50 or 20+40. A crash at chase+5 and +15 s gets it caught at 10.5 s. One crash costs **111–125 m** of distance over 12 s; DESIGN.md claims 50–70 m.
- With human-like recovery (R pressed at 1.4 s), crashes at 60 and 75 s get the skilled driver **caught at z = 2851**.
- If R is never pressed (auto-recover at 3.2 s), a single crash at chase+10 s gets the skilled driver caught at 16.9 s.
- An autopilot with 0.25 s reaction lag weaves and is caught 6 s into the chase. That is partly controller instability in the bot, so it is not conclusive.

## Critical defects
1. **Tree-trunk pin / soft-lock** (`SkierPhysics.ts:573-577`, `421-437`). In light contact, `vel *= 0.94` runs every 120 Hz step, which is a frame-rate-coupled decay of about 7.4/s. Gravity pushes the skier back into the trunk on every step. `recover()` then points the skis down the fall line, straight at the tree. During a chase a pin means death. Escape is unreliable even with expert input.
2. **Impact-event spam while pinned** (`SkierPhysics.ts:578` → `GameSession.ts:360-366`). Each step emits a sound, a branch snap, 14 particles and a camera shake, about 120 times per second. Nothing throttles this.

## Major weaknesses
- **M1 — Drift is strictly worse than carving** except as a hockey stop. Grip 1.7 cannot turn the velocity even though the skis yaw at 143°/s, so drifting is cosmetic sliding with no tactical value.
- **M2 — Pizza cannot stop on most of the course.** The course is 17–26° from z 300 to 2330, and pizza never stops above 18°. It takes 90 m on 15°.
- **M3 — Terrain has no dynamic effect.** Ground-follow re-projects velocity while *conserving speed* (`SkierPhysics.ts:289-294`). Compressions, moguls and rollers cost no energy and produce no load or absorption cue. This is exactly the "rigid object sliding" feel.
- **M4 — The camera spring lags in world space.** The critically damped spring at ω=9 lags by about 2v/ω, which is 6.7 m at 30 m/s (`FollowCamera.ts:169`). The skier shrinks and reads as slow at the speeds that matter most, and the speed-dependent boom is meaningless.
- **M5 — Pursuit tension collapses mid-chase.** Pressure caps at +6.5 m/s (`YetiAI.ts:171`), so good players open 200–290 m (out of sight) for about 40 s. The **run-out (z 2700–3000, 14°→4°) is then a Yeti-favoured trap**: every profile loses 100+ m there, and late crashes or average players die within 50–150 m of the finish.
- **M6 — The fairness evidence is optimistic.** The autopilot always holds `recover` (`autopilot.ts:21`, `GameSession.ts:271`), so the sims never pay the 1.0–3.2 s of human recovery delay. Measured crash cost is about 2× what DESIGN.md states.

## Minor issues
- Keyboard reversal takes 333 ms. At 25 m/s that is 8 m travelled before the turn takes effect.
- Carving reaches about 1.95 g at all speeds, with no edge-chatter or grip limit at speed.
- A 5.5 m drop never crashes. Landing risk is purely a speed tax.
- Auto-recover after 3.2 s silently punishes new players who do not know about R.
- `FollowCamera.ts:154` allocates a `new THREE.Vector3()` every frame.
- Yaw lag (λ=3.2) plus the position spring stack two lags during turns.

## Recommended corrections
| Where | Change |
|---|---|
| `SkierPhysics.ts:573-578` | Light contact: remove only the inward normal component. Apply tangential friction as `vel *= Math.exp(-1.5*dt)`, add an outward separation of 0.6 m/s, and emit `impact` only on a new contact (track with a `solidTouching` set like `touching`) or when `vn > 1.5`. |
| `SkierPhysics.ts:428-434` (`recover`) | If a solid obstacle lies within 2.5 m along the fall line, set the heading to fall line ±60° away from it and nudge the skier 0.3 m outward. |
| `SkierPhysics.ts:33,35,43` | `gripDrift 1.7→3.8`, `driftEfficiency 0.5→0.68`, `driftDecel 1.1→0.6`. Target: drift turns about 1.3× tighter than a carve and costs about 15% speed per turn. |
| `SkierPhysics.ts:41-42` | `brakeBase 2.3→3.8`, `brakeSpeed 0.09→0.12`. Pizza then stops on slopes up to about 24° and from 20 m/s on 15° in about 45 m. |
| `SkierPhysics.ts:290-294` | Lose speed on compression: `sp0 *= 1 - clamp(0.12*Δvn/sp0, 0, 0.08)`, and feed `landImpact`/`wobble` from Δvn so the body and camera react. |
| `Input.ts:227` / `SkierPhysics.ts:159` | Keyboard attack 6→9, reversal 14→22, and steer damp 14→22. Target is 90% steer in about 150 ms. |
| `FollowCamera.ts:169` | Spring the offset from the skier instead of the world position: `springTo(off, offVel, goal - t.pos, 9, dt); pos = t.pos + off`. Alternatively feed the velocity forward with `goal + t.vel*(2/9)`. Do the same for the look target at line 170. |
| `YetiAI.ts:26,171` | `catchUpGap 90→60` and pressure `6.5→9`, capped at 27 m/s, so the Yeti stays visible. Add a gentle-slope cap: `desired = min(desired, 13 + 0.5*slope)` below 12°. |
| `course.ts:46-49` | Steepen the run-out: `[2740,14],[2930,12],[2990,6]`. |
| `autopilot.ts:21` | Hold `recover` only after `crashTime > 1.4`. Add regression sims for crashes at chase+60/75 s and for no-R recovery. |

## Scores
- **Core skiing mechanics: 6/10.** Momentum and tuck trade-offs are solid and kickers are good. Against that: a trunk soft-lock, a useless drift, a pizza that cannot stop, and lossless rigid terrain-following.
- **Third-person camera: 6/10 (code-level only; visual verification unavailable).** Clearance, horizon, FOV and reduce-motion handling are good, but world-space spring lag nearly doubles the boom at speed.
- **Pursuit gameplay: 5/10.** The pressure model is sound in principle, but tension disappears mid-chase, the run-out kills unfairly, and the fairness tests flatter the design.

## Pass/fail vs 9/10 gate
**FAIL** on all three categories.

## Unverified evidence
I cannot play by hand. All feel judgements come from numeric sims with scripted drivers, and humans take wider, laggier lines. I did not render the camera numbers; I only computed them. The 0.25 s-lag result may be mostly autopilot oscillation. Pursuit runs used only the default seed. Crash injection forced the internal `crash()` with speed ×0.3, which approximates a tree hit.

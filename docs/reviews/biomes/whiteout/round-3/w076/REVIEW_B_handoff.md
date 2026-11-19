# W-076 focused review: Reviewer B (Physics & Gameplay)

**I am a model-based reviewer, not a human playtester.** I did not play the game or watch it run in real time.
**Build:** branch `pass5-whiteout`, commit **2d3618c** (W-076 in `789c23f`, plus the Timeline fix). I read the whole of `git diff 1218f06 2d3618c`.
**What I examined:**
- Code: `caveHandoff.ts`, `CaveCinematic.ts`, `Timeline.ts`, `GameSession.ts` (the cave phase, `finishCave`, `cineBlend`, the fixed-step loop), `YetiAI.ts`, `spawn.ts`, `simulate.ts` and `seaCaveCinematic.ts`.
- Measurement and tests: `skip-handoff/` (README and both JSON files), `cave_handoff.test.ts`, `cave_skip.spec.ts`, `/home/claude/e2e_skip.log`, and the hand-off strip `manifest.json`.
- My own headless experiments under `/tmp/rb` (Vitest, 2–3 minutes in total). The repository was not modified; this file is the only thing I wrote there.

## Verdict: **PASS** for W-076, physics and gameplay

- **One start.** In the game, the chase start no longer depends on when the player leaves the cinematic. `CaveCinematic.finish()` (CaveCinematic.ts:320–328) always calls `startCanonicalChase` with the same spawn. Nothing in that path reads the timeline time or the filmed Yeti's state.
- **Speed rules untouched.** The Yeti speed rules, the Hard multiplier and the slow-start code are byte-for-byte unchanged: `YetiAI.ts` and `CourseConfig.ts` are not in the diff, and `speedMul` is still set in `beginCave` (GameSession.ts:733).
- **The start is fair.** The canonical start is the old skip start, and by my own measurements it is fair. It is also generous.
- **W-056 not credited.** W-056 is correctly left OPEN (DEFECTS.md:76), and the commit and README say it is not resolved.

**Remaining issues:**
- The unit test's "watched = skipped" check is tautological and never exercises the game's hand-off.
- The simulation does not model the game *exactly*: there is a 0.9 m spawn difference and a sub-frame ordering difference. Both are negligible in measured outcomes.

## Findings

### B1 (Minor, but this is the regression guard): the unit equivalence check cannot fail for the game's hand-off
**Evidence:**
- `tests/unit/cave_handoff.test.ts:27` defines `const GAME = (ai, sp, _leftAt, h) => startCanonicalChase(ai, sp, h)`. The leave moment is ignored, so the six "same start and same pursuit" cases and the Endless case compare a deterministic function with itself.
- The test imports neither `CaveCinematic`, `GameSession` nor `Timeline`.
- It uses `yetiSpawnAfterCinematic(m, e.anchor)` (lines 53, 102, 125), not the game's ledge spawn.
- If `finish()` were reverted to the old three-branch hand-off, this suite would still pass. The "8/10 fail on legacy" result (`handoff_legacy_run.txt`) only shows that the comparison works when it is fed a time-dependent function.
- The retry case builds a fresh `YetiAI` rather than going through a session retry. The comment says "the same AI instance".

**Verified myself:**
- The two unit files pass: 12/12.
- The only test that exercises the real path is `cave_skip.spec.ts`. It passed (`e2e_skip.log`: 2 passed, 15.3 min), but the log carries no commit SHA, and the `w076logs/e2e_*.log` files named in the brief do not exist (the folder holds only `strip.log`).
- The e2e coverage is Alpine and Whiteout, Classic Sprint, Normal, one arrival speed (~14 m/s), and skips at 1, 9 and 14.3 s.
- Not covered by the e2e: Fjord, Hard, Daily or Custom courses, Endless encounters, slow or stopped arrivals, and in-session retries.

**Player impact:** none today. My code reading shows `finish()` is time-independent. Every field the AI reads in the chase is reset by `place` and `startChase`: pos, heading, vel, vy, airborne, delay, extraDelay, chaseTime, startSkierSpeed and syncClock. Nothing updates the AI during the cinematic. The risk is a silent future regression that only the 15-minute browser test would catch.

**Fix direction:** add a unit or integration test that drives `CaveCinematic` (or a `finish()` with a stub stage) at several timeline times through `Timeline.skip()` and `advance()`, and compares `yetiAI` state using the cave's real `ledge`. Re-label the current cases as determinism checks.

### B2 (Minor): the simulation's spawn is not the game's spawn
**Evidence:**
- The game passes the cave's ledge (CaveCinematic.ts:326: `yetiSpawnAfterCinematic(m, anchor, st.world.cave.ledge)`).
- `simulate.ts:167`, the measurement test and the unit test do not, so they use the "3 m outside the mouth" fallback.
- I built the real `Cave` headlessly for 12 encounters across all three locations (sprint and Endless encounters 0–2). The game spawn is consistently **0.92 m** away in the horizontal plane (0.9 m in z, 0.2 m in x) and **±0.2 m** in height.
- The leap's vz is +0.4 m/s higher in the game. The landing target is identical and the flight time differs by ≤0.013 s.
- The Alpine value I computed, (108.81, −33.43, 260.10), matches the strip manifest's hand-off frame `alpine_05` exactly, which confirms that the game uses the ledge.
- Full-course runs with the sim spawn against the ledge spawn: 3 locations × {Classic Sprint, Daily 2026-11-19 Sprint, Daily 2026-12-03 Standard, Custom "yeti" Sprint} × {Normal, Hard} × {skilled, cautious}, 48 pairs.
  - The outcome is identical in **48/48** pairs.
  - The end time differs by ≤0.3 s, the first-encounter gaps at 1/3/5/10 s by ≤0.5 m, and the minimum gap by ≤0.3 m.

**Impact:** negligible, but the README's claim that the simulation calls "the same start" holds only to within about 1 m. Its claim that `canonical.json` is "identical" holds for the simulation, not for the game.
**Fix direction:** either pass the ledge in `simulate.ts` (a headless ledge without the mesh is cheap: `chamberPoint(-2.2)` and the floor height), or document the 0.9 m tolerance.

### B3 (Minor, pre-existing, not introduced by W-076): the start-of-chase timing differs between the game and the simulation by a few physics steps
**Evidence:**
- In the game, `beginCave()` runs inside `fixedStep` (GameSession.ts:460–461).
- The `while (this.acc >= PHYS_DT && steps < 12)` loop (line 307) does not re-check `run.simulating`. The skier therefore keeps integrating for the rest of that frame's sub-steps after the cinematic has started:
  - at 60 fps, 0–1 extra steps of 1/120 s;
  - after a 100 ms hitch, up to 11 steps (about 1.8 m at 20 m/s).
- The Yeti's first update then comes one frame after the hand-off (the `handoffFrame` rule).
- The simulation starts the chase and updates the Yeti on the trigger step itself.

**Impact:** this is identical whether the cinematic is watched or skipped, so it does not affect W-076. It is a small sim-versus-game difference that depends on frame rate.
**Fix direction:** break out of the sub-step loop when `beginCave` fires.

### B4 (Minor, design observation): the head start is generous and depends on location; for a skilled skier the closest approach is at the landing
**Measured myself:**
- The chase began from the canonical start, with a skier placed 1 m past the trigger at 0/2/5/8/11/16/22 m/s and then driven by the autopilot for 20 s.
- Cases: 3 locations, Sprint and Endless encounters 0–3, Normal and Hard; 56 rows of 7 speeds.

**Separation at hand-off:**
- It varies from **39 to 62 m** with the cave's geometry. For example, Fjord Classic is 40.3 m, Alpine Classic 61.1 m, and Fjord Endless encounter 1 is 39 m.
- Most of it is lateral: Alpine's spawn is 56 m off the route line.

**Slow-start behaves as specified:**
- The extra delay is 1.60 s at 0 m/s, 1.30 s at 5 m/s, about 0.1 s at 11 m/s and 0 at 16 m/s or more.
- It is added to the 0.6 s delay that counts from the landing.
- The flight lasts 2.00–2.27 s.

**Gaps and catches:**
- Gap at landing: 12–64 m. The tightest is a stopped arrival at Fjord Endless encounter 1: 12 m at 2.09 s, before 2.2 s of standing roar.
- The 'skilled' policy was **never caught** within 20 s in any of its 196 cases (28 encounter and difficulty combinations × 7 arrival speeds). Its minimum gap always equalled the landing gap, so the pursuit never gets closer than the landing.
- The 'cautious' policy is caught mainly in Endless encounters 2–3 and on Hard (as early as 7.4 s after a standstill at Whiteout Endless encounter 0). That follows the AI's escalation, not the hand-off.

**Compared with before:** the old watched start, 6–11 m away with the Yeti already running at 9 m/s (README; my check of `legacy.json` against `canonical.json`: the canonical rows equal the old skip-at-3-s rows, 0 field differences), cost Whiteout the run at about 4 s. The new start is clearly fairer.

**Impact:** a skilled, fast arrival gets no close call in the first encounter's first 20 s; the tension comes later from terrain and weather. This was the owner's stated choice ("keep the generous head start"), so it is not a defect. It is worth an owner look, given the 1.6× spread between locations.

### B5 (Minor, evidence gap): no visual evidence of the leap played by the AI
**Evidence:**
- The hand-off strip contains 6 of the 14 intended frames, for Alpine only (`manifest.json`; `strip.log` ends at `alpine_05 chase -1.00 0.00`). Fjord and Whiteout are missing.
- No frame covers the chase's first 1.6 s, the leap the AI now flies.
- `yetiPos` reads (0, 0, 0) on the cinematic frames because it reports the AI, not the model, so those entries cannot be checked against the images.
- The one chase frame, `alpine_05`, agrees with the physics: airborne, mode `leap`, on the ledge spawn, and the camera unchanged from `alpine_04` (the blend starts at k≈0).

**Impact:** from the strip I cannot confirm that the 2.1 s AI leap reads correctly on screen. Reviewer A owns presentation; I am noting the gap only because the physics claim "no teleport or second leap" depends on it.

## Claims checked

| Claim | Status |
|---|---|
| Same chase start, watched or skipped at any moment | **Verified by code**. The e2e passed for Alpine and Whiteout (log, SHA unknown). The unit evidence does not count (B1). |
| Canonical start = the old skip start | **Verified**: canonical equals legacy skip, 0 differences. |
| The canonical start is fair | **Verified** (B4). |
| Speed rules, Hard modifiers and slow-start unchanged | **Verified**: not in the diff. The extra `vel`/`speed` zeroing in `startCanonicalChase` has no effect, because `speed` is unused while airborne and overwritten at landing. |
| Delay counted from the landing | **Verified** (YetiAI.ts: the airborne branch returns before `delay -= dt`). |
| Balance numbers model the game | **True to within about 1 m and a few sub-steps** (B2, B3). Outcomes unchanged in 48/48 pairs. |
| W-056 not claimed as resolved | **Verified**. My Classic Sprint Normal Whiteout runs are still caught (skilled 50.7 s, cautious 46.9 s) with either spawn. |

## What would change my verdict
- **To FAIL:**
  - a `cave_skip` run at 2d3618c showing a difference above 1e-3 for Fjord, Hard, Endless encounter 1 or later, or a slow (<5 m/s) arrival;
  - any path where `finish()` is skipped or called twice (for example, a skip on the same frame as the 14.6 s event), giving a second leap.
- **To an unqualified PASS:** a test that drives the real `CaveCinematic` and `finish()` at several leave moments using the ledge spawn (B1), and the simulation using the ledge (B2).

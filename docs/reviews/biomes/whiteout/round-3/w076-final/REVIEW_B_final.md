# W-076 final hand-off — Review B (Physics & Gameplay)

**Commit reviewed:** `6264e6d` (branch `pass5-whiteout`); changes since the previous focused review: `git diff 471227d 6264e6d -- src/cinematic src/game src/camera src/yeti`.
**Question:** has any gameplay advantage or difference returned between watching and skipping the cave cinematic; is the hand-off state identical and fair; are the presence cues presentation-only?

## Verdict: **PASS — 9/10** (physics & gameplay fairness of the hand-off)

The gameplay state at hand-off is the same whether the cinematic is watched or skipped at any moment. The skier's physics is frozen in the same way on both paths. Both paths go through the same `finishCave()` → `CaveCinematic.finish()` → `startCanonicalChase()`, on the same hand-off frame. The physics accumulator is zeroed on that frame and the chase clocks start at 0. Making the cinematic 1.1 s longer (`CAVE_LEAP_AT` 14.6 → 15.8) does not advance any physics-clock system: Whiteout fronts, hazards and `env.clock` all run on `SkierPhysics.s.time`, which is frozen. The presence cues only read the gap and write to audio and the HUD.

I found no physics, AI, clock or distance difference. The four findings below are all Minor. Three are presentation or fairness-of-information edges, and one is about the evidence. None gives a measurable gameplay advantage.

---

## Findings

### 1. Minor: If look-back (C / pad B) is held when the cave triggers, control returns on a backward-facing camera that differs between watching and skipping
- **Evidence:**
  - `FollowCamera.snap()` (`src/camera/FollowCamera.ts:82`) only clears `initialized`. `lookBackS` stays damped (`:127`), so it is not reset.
  - During the cinematic, `follow.lookBack` keeps the value from the last gameplay frame. The frame loop only sets it outside `caveCinematic` (`GameSession.ts:354-359`).
  - The watched path calls `gameplayPose()` (`GameSession.ts:196-210`, via `CaveCinematic.ts:153`). It sets `follow.lookBack = 0` and snaps once more, so the watched path gets two damped snaps. The skip path gets one snap, with `lookBack` still 1.
  - `gameplayPose()` is documented as "camera left untouched" (`Stage.ts`), but it changes follow state: `lookBack`, `lookBackS`, `fov`, `airY`, trauma decay and `shakeT`.
  - Scratch probe `/tmp/revb/handoff_probe.test.ts`: Alpine, 16 m/s, C held for 1 s before the trigger:

    | | orbit's last frame `dir.z` | hand-off frame `dir.z` | frames until the view faces downhill after C is released |
    |---|---|---|---|
    | watched | −0.77 | −0.577 | 17 |
    | skipped | — | −0.918 | 20 |

    Watched vs skipped camera: **32.2° apart**. The swing also ends on a pose that is not the hand-off frame's, so there is a visible jump. With C not held, both paths match exactly (0°; FOV differs by 0.009°).
- **Player impact:** This is an edge case: the player must be holding look-back as they cross the trigger. In that case decision 1 is not met. Control returns looking uphill, and the camera turns forward by itself over about 0.3 s. Physics and AI are unaffected, and skipping gives no advantage.
- **Suggested fix:**
  - In `finishCave()` (both paths) and in `gameplayPose()`, clear the transient look-back before snapping (`follow.lookBack = 0` plus a reset of `lookBackS`, e.g. a `FollowCamera.resetTransient()`). Alternatively, make `snap()` set `lookBackS = lookBack`.
  - Make `gameplayPose()` save and restore the follow state, or compute the pose with a pure `idealPose`.
  - Add the "C held at the trigger" case to `tests/unit/handoff_camera.test.ts` and/or `tests/e2e/cave_skip.spec.ts`.

### 2. Minor (pre-existing, not changed by this commit): On Whiteout, the weather the chase opens in depends on when the cinematic was skipped
- **Evidence:**
  - The storm cave's squall (`src/world/biomes/whiteout/views/stormCave.ts:177-213`) writes `world.weatherOverride` from `extra.update(dt, t)`, which is called only on watched frames (`CaveCinematic.ts:249`).
  - `Timeline.skip()` does not call it. `finish()` → `extra.dispose()` (`CaveCinematic.ts:326`) → `world.releaseWeather(7)` then fades from whatever the override held on the last watched frame. The fade runs on frame time (`World.ts:594`).
  - The physics weather is not overridden (`World.ts:583`, `env.clock` = physics time). This is a visibility-only difference.
  - Scratch probe: squall weight `k` at the moment the player leaves, with the fog it hands back on a fair base (Whiteout `fogDensity` 0.00085, FogExp2):

    | left at | k | visibility × | distance where fog reaches 50 % | fog at 100 m |
    |---|---|---|---|---|
    | ≤ 5 s (skip) | 0 | 1.00 | 979 m | 0.7 % |
    | 9–12 s (skip) | 1 | 5.20 | 188 m | 17.7 % |
    | 14 s (skip) | 0.36 | 2.52 | 389 m | 4.5 % |
    | ≥ 14.4 s / watched (15.8 s) | 0.30 | 2.26 | 433 m | 3.6 % |

  - The 1.1 s extension does not change the watched value. The lull ends at 14.4 s, and the old 14.6 s leap gave the same 0.30.
- **Player impact:** This is small but goes against "one canonical state". For about the first 7 s of the chase, a player who skips mid-reveal skis into thicker fog and snow than one who watched. One who skips early skis in clear air. Obstacles within ~60 m (≈3 s of travel) are barely affected (< 7 % fog), so I measured no physical advantage. It is still a difference in what the player can see, on the location whose rules (W-056) say every chase opens on a fair stretch.
- **Suggested fix:** In `CaveCinematic.finish()`, call `this.extra?.update?.(0, CAVE_LEAP_AT)` before `dispose()`, so every path hands back the weather of the leap beat. Add an assertion that `world.weather` on the hand-off frame is the same when watched and when skipped at 9 s.

### 3. Minor: The distant-call caption can replace Hard mode's first snowball instruction on the caption line
- **Evidence:**
  - `updatePresence()` (`GameSession.ts:1248-1258`) shows `'[a roar, far behind you]'` on the hard (Yeti) caption line.
  - Hard's first throw shows `'[the Yeti hurls a snowball — watch the red marks]'` on that same line (`GameSession.ts:713`). It is up to about 4.3 s of reading time.
  - Calls happen only beyond 110 m (`PRESENCE.callBeyond`), but throws happen up to a 150 m gap (`SNOWBALL.maxGap`, `src/yeti/Snowballs.ts:52`). In the 110–150 m band a call can overwrite the instruction.
  - I verified this from the code paths only. I did not measure how often it happens.
- **Player impact:** It affects caption users only, on Hard: they can lose the one-time explanation of the red landing marks. The marks themselves still show. Audio, AI and physics are unaffected.
- **Suggested fix:** Skip or delay a call while the hard caption line is busy, or for a few seconds after a throw. Alternatively, put the call on the soft line at ambient priority.

### 4. Minor (evidence): The real game path's parity has no completed proof in this commit's evidence
- **Evidence:**
  - `tests/unit/cave_handoff.test.ts` is model-level. Its `GAME` hand-off ignores `leftAt` (line 28), so "watched = skipped" holds by construction and would not catch a `GameSession` regression (e.g. `handoffFrame`, the accumulator, events).
  - Only `tests/e2e/cave_skip.spec.ts` runs the real path. The log in this folder (`e2e_cave_skip.txt`) is from a `dist` built at `1d88f0a`, and it is truncated: 5 of 6 cases started, no pass/fail lines.
  - The README's `strip/` is not in the folder.
  - No `src/cinematic|game|camera|yeti` file changed between `1d88f0a` and `6264e6d` (`git diff --stat 1d88f0a 6264e6d -- src/` touches only world/hazard/profile/material files), so a completed run on `1d88f0a` would still apply.
  - The e2e checks neither the weather (finding 2) nor held look-back (finding 1).
- **Player impact:** None directly. The risk is that a regression would not be detected.
- **Suggested fix:** Attach the completed e2e result, and the strip it cites, before sign-off. Extend the e2e state vector with `world.weather` (visibility/snowfall/storm) and add a "C held at the trigger" case.

### Notes (checked, not defects for this review)
- **Trigger frame:** after `beginCave()` fires inside `fixedStep()` (`GameSession.ts:477`), the remaining sub-steps of that frame's accumulator loop still run. That is up to one 1/120 s step at 60 fps. They happen before the cinematic exists, so they are identical on both paths. The orbit pivot `P` is captured before them, which is cosmetic.
- **Headless simulation spawn:** `simulate.ts:167` spawns the Yeti outside the mouth (`yetiSpawnAfterCinematic(m, e.anchor)`, no ledge), while the game spawns him at `cave.ledge`. This is pre-existing and the same on both of the game's paths. It means the tension and skip-handoff "start gap" figures describe the model's spawn, not the exact in-game ledge.

---

## What I verified, and how

| Claim | How | Result |
|---|---|---|
| Physics frozen identically during the cinematic | `RunState.simulating` (false in `caveCinematic`); `frame()` accumulates `acc` only when simulating (`GameSession.ts:317`); `mapInput` zeroes input when not controllable | ✔ No skier step in either path while the cinematic runs |
| Same hand-off frame and accumulator | Skip (`:294`) and watched (`tl.done`) both reach `finishCave()` and `handoffFrame = true` (`:308`) in the same frame branch; `acc = 0` and no step that frame (`:316`) | ✔ |
| One canonical Yeti start | `CaveCinematic.finish()` always calls `startCanonicalChase(yetiSpawnAfterCinematic(…, cave.ledge))`; `YetiAI.startChase` resets `chaseTime`, `delay = startDelay`, `extraDelay`, `startSkierSpeed = NaN`, airborne leap; `RunState.chaseTime` only advances in `fixedStep` | ✔ Same position, heading, velocity, airborne state, delay and slow-start inputs |
| `leapPending`, `RUN.` and landing are the same both ways | `finishCave()`: `showRunTitle()` on the first controllable frame, `leapPending = yetiAI.airborne`, `yetiLanded()` from the physics step | ✔ |
| No re-fired cinematic sounds/particles on skip | `Timeline.skip()` marks events fired without running them; `tl.duration = CAVE_LEAP_AT` clips location beats equally | ✔ |
| The 1.1 s longer cinematic does not move time-based gameplay | `env.clock = q.t = s.time` (`environment.ts:193`, `SkierPhysics.ts:406/427`); fronts/hazards/HUD weather read `env.clock`; session `this.time` is only used for presentation and the debug autopilot | ✔ Whiteout fronts do **not** advance during the cinematic. Only the presentation fade (finding 2) runs on frame time |
| Retry / Endless / several encounters | New session on retry; per encounter `beginCave()` sets `speedMul`, `finish()` restarts the chase, `snowballs.reset()`, new `ChasePresence(seed + index)` | ✔ Same on both paths |
| First viewing pauses, not skips | `cavePausable = caveCinematic && !recordsSeenCave`; skip requires `recordsSeenCave`; a paused frame returns before anything advances | ✔ |
| Presence cues are presentation-only | `src/yeti/presence.ts` is pure (seeded jitter, no `Math.random`, no game imports); `updatePresence()` reads `yetiAI.distance` and writes only `presenceCue`, audio and the caption; `yetiClosing` goes only to the HUD; suppressed while `leapPending` / outside `chase` | ✔ Nothing touches the AI, physics or the run |
| Presence did not change outcomes (independent re-check) | Python diff of `balance/tension/baseline_872ac4d.jsonl` vs `after_presence.jsonl`, all fields except `calls`/`closingS` | Only the 12 rows of the redefined `competent` driver differ; every other row is identical ✔ |
| Unit tests | `npx vitest run tests/unit/cave_handoff.test.ts tests/unit/handoff_camera.test.ts tests/unit/presence.test.ts` | 3 files, **31/31 passed** (18 s) |
| Sim measurement | `npx vitest run --config vitest.sim.config.ts tests/sim/skipHandoff.measure.test.ts` | Passed (86 s). For every row, watched and all skip moments give identical Yeti state and identical gaps at 1/3/5/10 s (model level) |
| Camera parity probe (finding 1) | `/tmp/revb/handoff_probe.test.ts` (FollowCamera, reproducing `gameplayPose` + `finishCave` snaps) | Not held: 0° difference. Held: 32.2° difference, hand-off faces uphill |
| Squall hand-back probe (finding 2) | Same file, real `STORM_CAVE` constants | Table above |
| Orbit (right stick/mouse) at the trigger | `/tmp/revb/orbit_probe.test.ts` | Not an issue: the look target ignores `orbitYaw`; `dir.z` stays 0.87–0.98 |

Browser e2e was not run by me (as instructed); see finding 4.

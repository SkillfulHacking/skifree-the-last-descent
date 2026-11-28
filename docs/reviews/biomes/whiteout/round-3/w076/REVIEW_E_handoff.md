# W-076 review E: QA and accessibility (skip, pause, restart, controller)

- **Reviewer:** E, QA and Accessibility Lead. I am a model-based reviewer, not a human playtester. I played nothing.
- **Build:** `pass5-whiteout` @ **2d3618c** (W-076 in 789c23f, Gitar `Timeline.apply` fix in 2d3618c). I read the whole change with `git diff 1218f06 2d3618c`.
- **What I examined:** `GameSession.frame` (cave branch, pause gate, `cineBlend`, `finishCave`, `debugFrames`), `App.pause`/`loop`/`framesLive`/`installDebug`, `Input.gameplay`/`menu`/`poll`, `Menu.update`/`pop`, `Timeline`, `caveHandoff.ts`, `CaveCinematic.ts`, the Fjord/Whiteout cinematic extras, `YetiAI.place/startChase`, `Hud.ts` (Yeti label), `tests/unit/cave_handoff.test.ts`, `tests/unit/timeline_fallback.test.ts`, `tests/e2e/cave_skip.spec.ts`, the diff to `tests/e2e/whiteout_rerun.spec.ts`, `tests/e2e/game.spec.ts`, every log in `/home/claude/` that bears on this change, the handoff strip (`round-3/handoff/`, 6 PNGs and `manifest.json`), and running processes.
- **What I ran:** one Vitest experiment under `/tmp/w076e` that drives the real `Input` class. I started no browser job.

## Verdict: FAIL (in my area)

Reading the code, the hand-off itself is right. Watched or skipped, at any moment, `finishCave` calls `startCanonicalChase`. Escape pauses on the first viewing and skips on later viewings. A skip is not a pause.

It fails in my area for three reasons:
1. **The controller's Start button does not behave like Escape.** One Start press in the pause menu resumes the game and also counts as a new pause or skip in the same frame. On a first viewing the pause menu reopens at once. On a later viewing that was paused by losing focus, Start resumes and skips the cinematic.
2. **The browser evidence is not from the SHA under review.** The only cave-skip browser run finished before either commit existed. The changed `whiteout_rerun.spec.ts` has not been run. The visual strip is incomplete: Alpine only, and it stops at chase t = 0.
3. **The unit test does not test the game.** The equivalence test that the "every location / Endless / retry" claims rest on is a tautology.

## Findings

### F1 (Major): Controller Start resumes and re-pauses (or skips) in one press. Pre-existing, but it breaks "the controller's Start does the same"
**Evidence (verified by code and by experiment):**
- In `App.frame` (App.ts:822-825), `menu.update(input.menu(dt))` runs first. If that resumes the game, `session.frame(dt, input.gameplay(dt))` runs in the same frame, because the second `if` is not chained to the first.
- `Input.menu` clears the keyboard queue (`pressedQ.clear()`, Input.ts:324). Pad edges are different: `padPressed` (`padNow && !padPrev`) does not consume the press, and `poll()` runs only once per frame.
- So in one frame, Start is read as `menu.back` (Input.ts:302) and again as `pausePressed` and `skipPressed` (Input.ts:271-272).
- My experiment `/tmp/w076e/start.test.ts` used the real `Input` class with one Start press and one poll. Output: `PAD menu.back true gameplay.pause true skip true` and `KEY menu.back true gameplay.pause false skip false`.

**What the player sees:**
- First viewing: Start pauses, as intended. Pressing Start again to resume reopens PAUSED in the same frame (GameSession.ts:256-258, `cavePausable`). The player has to use B or select Resume with A.
- Later viewing: the cinematic cannot be paused by a button, but App pauses it on `blur` or `visibilitychange` (App.ts:119-124). Resuming with Start then skips the cinematic.
- Normal play: the same re-pause happens.
- Escape does none of this. This is an accessibility and consistency defect for controller players. It predates W-076, but it is squarely inside the goal "the controller's Start does the same".

**Fix direction:** consume pad edges once per frame, for example by copying `padNow` into `padPrev` after a menu read, or by giving `menu()` a consumed set. Or skip gameplay input on the frame the pause menu closes. Add a regression test: pause on a first viewing, then resume with Start, and expect `mode === 'playing'`.

### F2 (Major): The browser results do not come from the reviewed build
**Evidence (verified):**
- `/home/claude/e2e_skip.log` (cave_skip, 2 passed) was last written at 23:51:38. Commit 789c23f is dated 23:53:59 and 2d3618c is dated 00:02:12, so the run used an uncommitted tree before either commit and without the Gitar fix.
- `/home/claude/w076logs/` holds only `strip.log`. The brief's `e2e_*.log` files do not exist.
- The `whiteout_rerun` log (`/home/claude/e2elogs/`) is from Nov 18 02:27, before the test was changed, so the changed test has never been run.
- No `game.spec.ts` run after the change exists.
- `tools/handoff_strip.mjs` was still running at 00:16 (pid 2568). Its manifest has 6 Alpine frames, from cinematic 13.63 s to chase t = 0. There are no Fjord or Whiteout frames, and no frame after the blend starts.

**Impact:**
- "Tested in the browser" is unproven for 2d3618c.
- The camera blend over the chase's first 1.2 s has no visual evidence at all.
- Fjord, the only location where the Gitar fix changes the frame the blend starts from, has no browser coverage of any kind.

**Fix direction:** re-run `cave_skip`, `whiteout_rerun` and `game.spec` on 2d3618c. Finish the strip for all three locations, out to chase t = 1.6 s.

### F3 (Major): `cave_handoff.test.ts` equivalence is tautological; it never calls the game's hand-off path
**Evidence (verified):**
- `GAME = (ai, sp, _leftAt, h) => startCanonicalChase(ai, sp, h)` ignores `leftAt`.
- `equivalent(GAME, ...)` therefore compares `startCanonicalChase` with itself seven times. It touches neither `CaveCinematic`, `GameSession.finishCave`, `Timeline.skip` nor input.
- The "every location", "slow/fast arrival" and "Endless encounters 1–3" cases cannot fail, whatever the cinematic does. If `CaveCinematic` reintroduced its own filmed leap, every one of them would stay green.
- The LEGACY case proves only that the comparator detects a *model* of the old code (`tests/support/legacyCaveHandoff.ts`), not the old code.
- The retry case's comment says "a retry reuses the session's Yeti". That is false: `startRun` builds a new `GameSession`, which builds a new `YetiAI` (GameSession.ts:151). The test covers a situation the game never produces.

**Impact:** the claims "every location, Endless, retries" have no real-path test behind them. Real-path coverage is the e2e only: Alpine and Whiteout, Classic Sprint, Normal (and see F2).

**Fix direction:** in Node, drive `GameSession.frame` with a stub stage, or add cave_skip runs for Fjord, for Hard, and for an Endless second encounter. Describe the unit test honestly, as "the canonical start is deterministic".

### F4 (Minor): Judged on its own, `cave_skip.spec.ts` is a good real-path test
I checked this from code. I did not run it.
- The Escape and pad Start presses go through the real `Input`/`GameSession` path (`framesLive`).
- The first-viewing pause and the resume in the live menu are real.
- It asserts that a later-viewing skip is not a pause.
- The skip runs come after a completed encounter in a new session, which partly covers "restart after a completed encounter".
- It would fail on the old code: at the old 18.0 s hand-off the Yeti had landed, so `expect(watched.yetiAirborne).toBe(true)` fails, and the 1e-3 comparison against a skip at 1 s fails by tens of metres.

Gaps:
- No first-viewing controller Start (pause) check, which would have caught F1.
- No pause during a later viewing (via blur).
- No check that a skip fires no sound or particles.
- No camera or blend assertion.
- No Fjord, Hard or Endless runs.
- `yetiMode` is not compared. That is harmless: GameSession.ts:1020 sets the mode from the AI each chase frame.

### F5 (Minor): The camera blend: pause, crash, retry, teleport (from code, untested)
- **Pause:** `frame` returns before the follow branch, so `B.t` freezes and the blend resumes intact.
- **Crash:** the phase stays `chase`, so the blend continues, which is correct.
- **Caught, retire or results:** a phase change sets `cineBlend = null`.
- **Retry or Restart Run:** a new session starts with `cineBlend = null`.
- **Teleport:** debug only. The blend sweeps from the old cinematic pose to the new follow pose.
- **Feedback loop:** there is none. `FollowCamera` keeps its own `pos` and `fov` (FollowCamera.ts:217) and does not read `camera.position`.
- **Skip:** the skip path hard-cuts to the follow camera (`!skipped`), as before.
- **Reduce motion:** `reduceCameraMotion` is not consulted. The 1.2 s swing plays for reduce-motion users. The old timeline's 16.95–18.0 s swing did the same, so this is not a regression. Suggested fix: cut, or shorten the swing, when `reduceCameraMotion` is on.
- None of these cases has a test.

### F6 (Minor): The HUD reads "YETI Infinity m" on the hand-off frame
**Evidence (verified):** frame `alpine_05.png` (chase t = 0), top centre. `handoffFrame` skips the first AI update, so `yetiAI.distance` is still `Infinity`, and Hud.ts:386 prints `Math.round(d)`.

**Impact:** one frame in normal play. The label stays up if the game is paused on that frame, and screen-reader or caption users may get the label. The skip path already had this before the change; now the watched path shows it too.

**Fix direction:** hide the label while `!isFinite(d)`.

### F7 (Minor): `whiteout_rerun.spec.ts` was modified, mildly weakened, and not re-run
**Evidence:** the W-031 frame moved from cinematic 15.2 s (the leap shot camera) to chase t + 0.6 s. That frame is mid-`cineBlend`, about 50 % of the way to the follow camera. The comment's luminance calibration ("healthy ≈ 40 at the same camera") no longer describes the same camera.

On the other side, the added `yetiAirborne === true` check is stricter. The haze collapse it guards against was whole-frame, so the test probably still catches it. The calibration is unverified, and the test has not been run (F2).

### F8 (Verified): debug `framesLive` is confined to `?debug`
- `framesLive` is defined only inside `installDebug`, which runs only with `?debug` (App.ts:173, :1028).
- Normal play never calls it.
- The double `poll()` it adds only matters if the live loop also runs (`hold(false)`), which can only happen in debug.
- Progress tracking is already off under `?debug` (`!this.debugHarness`, App.ts:307), so its not setting `debugUsed` does not matter.

### F9 (Verified): the strip frames match their manifest entries
I checked all 6 frames:
- 00 is the roar close-up (fov 30).
- 01 is the cut to the reaction camera at 13.83 s. The camera moves 58 m at the intended cut.
- 02–04 are the over-the-shoulder shot, letterboxed, with the Yeti at the cave mouth.
- 05 (chase t = 0) has the HUD and "RUN." on screen. The camera has moved 0.03 m from frame 04, so there is no jump at the hand-off. `yetiPos` (108.8, −33.4, 260.1) is at the mouth, and `yetiAirborne` is true.
- The manifest's `yetiPos` reads [0,0,0] during the cinematic because it records the AI, not the actor. That is harmless but misleading.

## What would change my verdict
- A fix for F1, with a test for resuming with Start on a first viewing and after a blur pause.
- `cave_skip`, `whiteout_rerun` and `game.spec` passing on 2d3618c (or on the fix commit), with logs.
- A finished strip for Alpine, Fjord and Whiteout, out to chase t = 1.6 s, that shows no camera jump.
- A real-path test for Fjord and an Endless second encounter, in the browser or in Node through `GameSession.frame`.

With those, I would pass W-076 in my area.

This change does not resolve W-056.

# W-076 focused review: Reviewer F (Hostile Critic), cave hand-off fairness and tension

- **Reviewer:** F, Hostile Critic. I am a model-based reviewer, not a human playtester. Statements about what a player "sees" come from frames, code and simulation, not from play.
- **Build:** `pass5-whiteout` @ **2d3618c** (W-076 in `789c23f`, Gitar Timeline fix in `2d3618c`); the change examined is `git diff 1218f06 2d3618c`.
- **Examined:**
  - code: `caveHandoff.ts`, `CaveCinematic.ts`, `Timeline.ts`, `GameSession.ts` (cave phase, `finishCave`, `cineBlend`), `YetiAI.ts`, `spawn.ts`, `simulate.ts`, `seaCaveCinematic.ts`, `Hud.ts:386`;
  - data: `balance/skip-handoff/{README.md,legacy.json,canonical.json,handoff_legacy_run.txt}` and `balance/round3/`;
  - evidence: the hand-off strip as it stood at 00:18 (see N5) and `/home/claude/e2e_skip.log`;
  - my own headless runs: `/tmp/w076f/handoff.test.ts`, Classic Sprint, the `skilled`/`average`/`cautious` autopilot, Relaxed/Normal/Hard, legacy-watched vs canonical, first encounter, about 40 s of wall time in total.

## Verdict: **FAIL** (in my area)

- **What works.** The mechanical goal is met, and I verified it. Watched and skipped give the same chase: in `canonical.json` all 6 leave-moments are identical for every location and driver, and my runs reproduce those rows. W-056 is correctly *not* claimed as fixed.
- **Why it still fails my area:**
  1. **The leap's payoff is gone for the watcher.** The watcher, and that includes every first-time player, now gets a worse climax than before. The leap plays under a full HUD and the "RUN." title, which hides the Yeti in the frames. The landing happens off-screen, with no impact.
  2. **The difficulty change is not owned.** For every player's first chase it is a large easing. The developers present it as "the balance results stand", not as a change to what shipped players experienced.
  3. **Alpine and Fjord have no tension left for a competent player.** At the canonical start a competent player there never has the Yeti within 39–54 m on any difficulty.

## Findings

### F1: Major. The watched leap is no longer a payoff: the title hides it and it lands off-screen without impact
- **Evidence I verified:**
  - **Cinematic beats** (`CaveCinematic.ts` diff):
    - The leap shot (14.6–16.95 s) and the swing-back (16.95–18.0 s) are deleted.
    - The filmed landing is deleted: `shake(0.5)`, the footstep and a 60-particle burst.
    - Fjord's dedicated sea-framed leap shot is deleted too (`seaCaveCinematic.ts` diff).
  - **The chase AI's landing** (`YetiAI.ts:166-171`) only sets `airborne=false` and mode `run`. It has no shake, burst or sound.
  - **Flight time** (my runs): the Yeti is airborne for **2.07 s** of chase time in all three locations. `cineBlend.dur` is 1.2 s (`GameSession.ts`), so he lands 0.9 s after the camera has fully returned to the downhill follow view, behind the player.
  - **Frame `alpine_05`** (chase 0.0): the letterbox, the full HUD and the large "RUN." title all appear on the same frame. The title sits directly over the cave mouth. The HUD reads "YETI Infinity m" (see F4).
  - **Frame `alpine_06`** (0.2 s): a "BEHIND YOU" inset appears over the upper centre. The Yeti, mid-hop, is just under the "U/N" letters.
  - **Frame `alpine_07`** (0.4 s, manifest `yetiAirborne: true`, y = −32.03, 1.4 m above the ledge): the Yeti is **not discernible**. The crop of region x 300–640, y 180–300 shows only the title letters over the cave mouth.
- **What a first-time player sees:**
  1. about 14 s of build-up;
  2. a 0.5 s reaction shot (`alpine_02`);
  3. a 0.4 s distant view of a ~25 px Yeti standing upright in the cave mouth (`alpine_03/04`);
  4. then the HUD pops in, "RUN." covers him, and the camera swings away while he is in the air.

  The leap the whole sequence builds to is seen for a few frames at most. The landing, which was the moment of contact and threat, is never seen.
- **Fix direction:**
  - Delay "RUN." and the inset until the AI reports `airborne=false`, or place the title away from the Yeti's screen position.
  - Keep a blend long enough (≥ flight time, about 2.1 s) so the landing is framed.
  - Fire the landing impact (shake, burst, footstep) from the AI's landing transition in the game, not the cinematic. That gives both watched and skipped players the same landing, and the simulation stays unchanged.

### F2: Major. A large difficulty change for every first chase, not owned as one
- **Shipped players always watched their first chase.** `canSkip = recordsSeenCave` is persisted in the records book (`App.ts:521-523`; `GameSession.ts:256`, where Escape pauses). So in the shipped build every player's first cave encounter used the *watched* hand-off.
- **First chase, watched in the shipped build (legacy) vs now (canonical).** My runs use chase seconds, Normal unless noted:

| Location / driver | Caught at (s), shipped watched → now | Yeti first < 30 m (s) | Min gap (m), shipped → now |
|---|---|---|---|
| Alpine cautious | 10.3 → **43.0** | 0 → 21.2 | 2.8 → 3.0 |
| Alpine average | 13.3 → **67.4** | 0 → 62.0 | — |
| Fjord cautious | 6.0 → **31.5** | 0 → 15.4 | — |
| Fjord average | 6.0 → **53.9** | 0 → 24.5 | — |
| Whiteout skilled | 4.1 → **21.9** | 0 → 10.4 | — |
| Whiteout cautious | 3.3 → **11.9** | 0 → 5.6 | — |
| Alpine skilled | win → win | never | 11.4 → **53.6** |
| Fjord Hard cautious | 5.3 → 20.4 | — | — |
| Whiteout Hard cautious | 3.2 → 9.6 | — | — |

- **Size of the change.** Time to capture rises **3–9×**. The separation on the first controllable frame rises from 6–11 m to 40–61 m (my runs and `legacy.json` vs `canonical.json` agree).
- **What the developers say.** The README says "the balance results in `balance/round3/` stand, because they already used this start". That is true of the simulations, which I verified in the `simulate.ts` diff. It is not true of what players of the shipped build got on their first run. The DEFECTS row and the commit describe this only as removing a skip advantage.
- **The opposite reading is defensible:** the game now matches the start it was tuned against. But it should be stated as a deliberate easing of the first chase, with these numbers, and signed off by the product owner. The owner's complaint was the size of the difference, not a request to make every first chase easier.
- **Fix direction:**
  - Add a "player-facing change" line to DEFECTS and the README with the table above.
  - Get the product owner's explicit acceptance, or choose a middle start (for example a leap aimed closer to the skier) and measure it.

### F3: Major (tension). Alpine and Fjord give a competent player no threatening moment at all
- **The Yeti never gets close** (my runs). With the `skilled` driver his closest approach is:

| Location | Relaxed | Normal | Hard |
|---|---|---|---|
| Alpine | 53.6 m | 53.6 m | 53.6 m |
| Fjord | 38.8 m | 38.8 m | 20.4 m |

- **The early trajectory, Alpine Normal:** 61 → 54 m during the leap, then 64 / 78 / 97 m at 3 / 5 / 10 s. So:
  - the "— MOVE!" warning (`Hud.ts:386`, under 25 m) never shows;
  - he never comes within lunge range (13 m);
  - Hard modifiers do not change the closest approach on Alpine.
- **Before:** the shipped watched start had a real first-seconds scare (11 m at hand-off, opening to 30 m by 3 s).
- **Why this matters for the brief.** The goal "keeps the generous head start the skip gave, *if it is fair and tense*" was asserted, not evidenced. No tension measure, such as time-under-30 m or the closest approach, appears in `skip-handoff/README.md`.
- **Whiteout is the opposite case.** It is tense, but this start does not make it fair: Classic Normal is caught at 12–22 s (W-056, still open). In my runs the skilled *autopilot* is caught even on Relaxed (24.1 s). The round-3 `blind` policy wins Relaxed, so that is driver-specific.
- **Fix direction:** report a tension metric per location and difficulty. If "never within 40 m for a clean skier" is the intended feel, say so. If not, tune the leap target so a competent player is threatened, for example once, at about 20–30 m in the first 5 s.

### F4: Minor. "YETI Infinity m" on the first controllable frame
- **Evidence:**
  - Frame `alpine_05` shows the readout. `YetiAI.distance` starts as `Infinity` (`YetiAI.ts:81`) and is not updated on the hand-off frame (`handoffFrame`, `GameSession.ts:295-302`).
  - `Hud.ts:386` prints `Math.round(d)` without a guard.
  - In Endless the value from the previous encounter would show instead (inferred, not observed).
- **Likely pre-existing.** I have no old-build frame to confirm.
- **Player impact:** a broken HUD readout on the most-watched frame.
- **Fix:** compute `distance` in `startCanonicalChase`, or hide the label when the value is not finite.

### F5: Minor (evidence). The hand-off strip was incomplete when I reviewed it
- **What existed at 00:18:** `tools/handoff_strip.mjs` was still running. There were 8 of the 42 frames (`alpine_00…07`, up to chase 0.4 s). **No Fjord or Whiteout frames existed**, so the Gitar fix for Fjord's final-frame camera snap (`2d3618c`) has no visual evidence.
- **Manifest vs images, frames 00–07:**
  - Phase, cinematic time and chase time agree with what the frames show (letterbox up to 04, HUD from 05).
  - In 00–04, `yetiPos` is `[0,0,0]`: it is the AI's position, not the rendered model's, so it cannot be used to check for a teleport.
  - Visually, the Yeti is at the same screen spot in 04 and 05, so I saw no teleport at the hand-off.
  - The camera is continuous from 04 to 05 (pos (49.7, −44.6, 284.6) in both).
- **Further evidence gaps:**
  - `/home/claude/e2e_skip.log` (2 passed: Alpine and Whiteout) is time-stamped **23:51**, before `789c23f` (23:53) and `2d3618c` (00:02). It does not test the build under review.
  - Fjord has no e2e test.
  - `/home/claude/w076logs/` contains no `e2e_*.log`.

### F6: Minor. Developer descriptions of the final shot are not supported by the frames
- **"An over-the-shoulder shot of him crouched on the ledge leads into it"** (README, commit):
  - in `alpine_03/04` the skier is not in frame;
  - the Yeti stands upright, with manifest `yetiMode: "roar"`;
  - mode `leap` is set only on the final cinematic frame (`tl.at(CAVE_LEAP_AT)`);
  - the shot lasts 0.4 s (14.2–14.6).
- **Fix:** add a crouch/anticipation pose for 0.3–0.5 s and frame the skier's shoulder, or correct the description.

### F7: Minor. The simulation and the game do not spawn the Yeti at the same point
- **Evidence:**
  - `simulate.ts` calls `yetiSpawnAfterCinematic(m, e.anchor)` without `cave.ledge`; the game passes `st.world.cave.ledge` (`CaveCinematic.ts`).
  - On Alpine Classic the hand-off Yeti is at (108.81, −33.43, 260.10) in the game (manifest `alpine_05`) and at (109.01, −33.52, 261.00) in the simulation (`canonical.json`). That is about 0.9 m apart.
- **Impact:** negligible for balance. But the claim that the game and the simulation start "the same chase" holds only approximately.
- **Fix:** pass the ledge, or note the difference.

## Not found (checked)
- Skipping does not award distance or fast-forward the skier: the skier's z and speed are the same across all canonical rows.
- Speed rules, Hard modifiers and slow-start are unchanged. `YetiAI.ts` is not in the diff. `extraDelay` 0.06 / 0.18 for the cautious driver appears identically in the legacy skip rows and in the canonical rows.
- W-056 is not credited as fixed: the README, the commit and DEFECTS (W-056 still OPEN) all say so.

## What would change my verdict
1. The Yeti is visible and unobscured for its whole flight in watched play, and the landing is framed with an impact: frames for all three locations, including Fjord after the Gitar fix.
2. A written, owner-accepted statement that the first chase is deliberately easier than in the shipped build, with the F2 numbers.
3. A tension metric per location and difficulty showing the Alpine/Fjord start is intended, or a re-tuned leap target that produces one early threat for a competent player.
4. e2e results re-run on 2d3618c, including Fjord.

F4–F7 alone would not hold the verdict at FAIL.

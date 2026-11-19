# Whiteout Ridge, round 2: Review C (Cinematic and Animation Director)

- **Reviewer:** C, Cinematic and Animation Director. I own category 5 (Cinematics).
- **Nature:** I am a model-based reviewer, not a human playtester. I did not play the game. I judged it from still frames, source code and evidence files.
- **Build:** candidate `b70a793` (branch `pass5-whiteout`), compared against round 1 `3f7bc45` (`git diff 3f7bc45 b70a793 -- src`). The strip and evidence manifests record SHA `b70a793`.
- **What I examined:**
  - `round-2/strip/` (all 24 frames, 0.5–23.5 s, 960×540) and its `manifest.json` (camera poses, skier z, front state).
  - `round-2/evidence/12–26` and 05 and 19 (1280×720) and their manifest notes.
  - Source: `src/world/biomes/whiteout/views/rescueVictory.ts`, `rescue.ts`, `stormCave.ts`, `storm.ts`, `src/cinematic/victory/trophy.ts`, `src/cinematic/EndCinematics.ts`, `src/game/GameSession.ts` (`fixedStepVictory`, `updateYetiStormLook`, `weatherAudio`), `src/game/World.ts`, `src/world/Environment.ts`, `src/ui/Hud.ts`, `src/yeti/YetiModel.ts`, `tests/e2e/whiteout.spec.ts`.
  - For comparison: `docs/reviews/biomes/fjord/final/11*.png`, `08d`, and Fjord's `harbourVictory.ts` / Alpine's `alpineResort.ts`. I also read my round-1 report.
- **Limits:**
  - SwiftShader stills at 1 fps show no motion, easing, gait, particle motion or audio.
  - **The capture tool hides the HUD in the cinematic shots, so the letterbox and the title are not in any still.** I checked both from the code only (below).
  - `round-2/e2e.txt` is listed in the round-2 README but is **not in the directory**. So I could not confirm that the browser suite passed on the candidate.

---

## Verdict: FAIL for category 5 (Cinematics), 6.5/10 against the 9/10 target

Round 2 fixes most of the presentation layer:
- The finish now has a letterbox, the HUD hidden, the victory theme, a fanfare and a held title.
- The timing has a settle and a hold.
- The Yeti is hidden until his beat.
- The flinch plays in the close shot, which now shows his face.
- The reveal keeps the station in frame.
- The lantern glows.

Those are real improvements I can see in the code and the frames. The staging underneath is still broken, though:
- The skier stops about 20 m short of his mark, so he never reaches the station. He is never in the welcome shot, and he raises the lantern alone on the open slope about 27 m from the door.
- The lantern flies there with its **stone plinth** attached.
- The door never visibly opens.
- The Yeti's stop ends up about 8 m from the skier, not "at the edge of the light". He covers 38 m in about 2.3 s while playing a walk cycle.
- The searchlight-on-Yeti beat, the story's cause and effect, is still not legible at gameplay resolution.
- Audio: the wind bed keeps howling at storm strength through "the wind drops".

## Scores

| # | Category | R1 | R2 | One-line justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 6 | 6.5 | The storm light is now flat and grey in gameplay (05, 16, 19). The lantern halo reads. The cave cornice and rime "feathers" read as flat cut-outs (12–14), and the reveal is overcast with no sun. |
| 2 | Environmental uniqueness (lc) | 7 | 7.5 | The storm-to-shelter arc, the station, the lantern and the storm cave are unlike Fjord and Alpine. The trophy raise and the crane-to-title template are shared. |
| 3 | Skiing and hazard mechanics (lc) | 6 | 6 | Not examined. |
| 4 | Difficulty and fairness (lc) | 6 | 6 | Not examined. |
| **5** | **Cinematics** | **5** | **6.5** | Presentation, timing, Yeti concealment, flinch framing and reveal framing are fixed. The skier never reaches the station, the plinth flies 27 m, the door never opens, the searchlight beat is invisible and the wind audio does not drop. |
| 6 | Performance and stability (lc) | 6 | 6 | Not examined. The strip manifests show no errors. The round-2 e2e log is missing. |
| 7 | Accessibility and controls (lc) | 6 | 6 | Not examined. The 1 Hz beacon in the finish is unchanged (`rescue.ts:612`). |
| 8 | Overall player experience (lc) | 6 | 6.5 | The ending is now framed and paced as an ending, but its middle (welcome, lantern, light-vs-Yeti) does not show what it says. |

---

## Round 1 → round 2

| R1 | Status | Evidence checked |
|---|---|---|
| **C-1** No letterbox, HUD hide, victory music, fanfare or title | **Fixed (code only)** | See the list below the table. None of it is visible in the stills, because the HUD is hidden. |
| **C-2** Reveal has no station or characters | **Mostly fixed** | Strip 18.5–23.5 and `26_v_reveal` have the station in the lower third (y ≈ 76–90% of frame) and the ridge behind. But we see the hut's **back**: no porch, no door light, no rescuers. The skier is about 10–14 px tall, alone 20 m beyond the hut. There is no "low sun": the sky is flat white overcast. |
| **C-3** The storm is not visible in the victory | **Partly fixed** | `RESCUE_STORM.visibility = 20` (`rescueVictory.ts:31`) is clamped by `maxFogDensity 0.016` (`biome.ts:75`, `Environment.ts:249-252`), which is the same density as the gameplay storm. Strip 0.5–2.5 and 9.5–13.5 now have grey, flat storm light, and 13.5 vs 20.5 shows a real before/after. But the hut at about 45 m is still crisp (about 40% fog), and only a handful of flakes appear in any still. Driving snow is not evidenced. |
| **C-4** Yeti visible before his reveal; never leaves | **Partly fixed** | He is hidden until 8.8 s (`:62, :105`), and absent from strip 0.5–8.5. He is hidden 4 s into the leave (`:215`). But in strip 15.5 / `25_v_break` (16.0 s) he still stands about 10 m from the skier, and he pops out in frame between 16.5 and 17.5 (N-7). |
| **C-5** Door beat framed away from the door | **Partly fixed; new defect** | Shot 2 now frames the porch (strip 3.5–6.5, `21`). But the skier never enters (N-1) and the door never visibly opens (N-3). |
| **C-6** Flinch in the wrong shot; close shot shows his back | **Partly fixed** | Shot 5 starts at 11.0 and the flinch is at 11.4 (`:29, :117`), from the station side. Strip 11.5 and `24` show his face. The searchlight now interpolates (`rescue.ts:631-633`). Still missing: no beam or light pool is visible on him in 11.5, 12.5 or 24 (the developer's README concedes this). The raised arm at 12.5 reads as a wave. Shot 4 has neither the skier's shoulder nor the lantern in frame (strip 9.5, 10.5, `23`). See N-5. |
| **C-7** Cave additions do not read | **Partly fixed** | 12–14 show the new cornice, rime feathers and dense streaks in the mouth, and 13–14 are darker. But the streaks fall vertically like rain, not driven sideways. The roar burst is still a small puff at the top of 14. The lull (`lull 0.7` at 12.2–14.4 s, `stormCave.ts:33`) still gives a bright, clear sky in 15. |
| **C-8** Cave squall can clear an existing storm | **Fixed (code)** | `stormCave.ts:177-180` now takes `Math.max(base, target)`. |
| **C-9** No storm-pursuit evidence | **Not fixed** | `16_storm_chase` now has real storm air and the HUD, but the Yeti is 114 m back (HUD bar) and there is no rear-view inset. `17_yeti_silhouette` has **no Yeti in it at all**. The pursuit's silhouette and eye-glow look remains unevidenced. |
| **C-10** Lantern does not glow; pole in the same hand; shared pose | **Partly fixed** | The halo sprite and the swelling light (`rescue.ts:529-552, 638-643`) read clearly in `22` and strip 8.5. The pole is still in the lantern hand (`22`). The both-arms-up pose is the same as Fjord `11_victory_trophy`. The plinth now flies along with it (N-2). |
| **C-11** Arrival shot does not match its intent | **Mostly fixed** | Strip 0.5–2.5 and `20` frame the skier from behind and beside, heading to the hut, with the rescuers visible. The warm lights still are not the dominant colour. |
| **C-12** Compressed timing, no settle | **Fixed (code)** | Settle at 18.6, title at 19.2, results at 23.6 (4.4 s hold). Strip 18.5–23.5 confirms the camera is near-static. |

How I verified C-1 in code:
- `rescueVictory.ts:66-71`: `gameplayWidgets(false)`, `letterbox(true)` and `setMusicMode('victory')` at t = 0.
- `:125-128`: fanfare and cheer at 14.0 s.
- `:145`: title "RESCUED" / "Whiteout Ridge — through the storm to the rescue station", class `victory scrim`, 4.8 s.
- `:146-149`: `letterbox(false)` at 23.6 s.
- `Hud.ts:122-129` and `:186-192` toggle the classes as expected.

**Storm-look reset (`GameSession.updateYetiStormLook`, `:1158-1170`): holds.**
- The victory phase is neither `chase` nor `caught`, so the first victory frame takes the reset branch: shade 1, glow 0, flag cleared.
- Hiding the Yeti (`rescueVictory.ts:62`) does not bypass that, because `updateYetiStormLook` runs unconditionally (`:1005`) and `setShade`/`setEyeGlow` do not depend on visibility.
- The e2e test (`whiteout.spec.ts:150-169`) asserts `{shade:1, eyeGlow:0}` 300 frames into the victory. It also asserts that the next run starts with the Yeti hidden and shows him in the chase.
- I could not see that test's result (no e2e.txt).
- Visually, strip 9.5–13.5 shows a pale pelt and no eye glow. So the Yeti who walks out of the storm in the victory is deliberately not given the storm look. Hiding him until 8.8 s is now what makes the reveal work. That is acceptable, but it costs the "eyes first" image the run sets up.

---

## New findings

### N-1 (Major, release-blocking): The skier stops about 20 m short of his mark, so the station staging collapses
- **Evidence (code):**
  - The stop point is `door + faces·8` (`rescue.ts:587`).
  - `fixedStepVictory` starts the hockey stop as soon as `d < 22` (`GameSession.ts:544`).
- **Evidence (strip manifest):**
  - The skier's z freezes at 3004.6 from 2.5 s to the end.
  - From the shot-1, shot-2 and shot-6 camera poses I solved `faces ≈ (0.55, −0.83)` and `door ≈ (−12.5, 3029.8)`.
  - That puts the skier about **27 m from the door and about 20 m from the stop point**. Frame scale agrees: in strip 7.5 the 1.8 m rescuers are about 50 px tall at FOV 39, which is about 27 m from the camera.
- **Consequences in frame:**
  - (a) Shot 2, "the skier glides into frame and up to the deck" (3.4–6.6 s): the skier is **never in frame** (strip 3.5–6.5, `21`).
  - (b) Shot 3, "the skier in the warm doorway lifts the lantern": he does it on open snow with the hut far behind (strip 7.5, 8.5, `22`).
  - (c) The Yeti's stop (`door + faces·30 ± across·12`) lands about 8 m from the skier, not at the edge of the station's light. Strip 15.5 and `25` show the two figures side by side out on the slope.
  - (d) The reveal shows the skier as a speck 20 m uphill of a hut whose back faces the camera.
- **Player impact:** the story is "you made it to shelter", but the hero never reaches the shelter. The welcome is a shot of two strangers on a porch.
- **Fix:**
  - Let the victory auto-steer brake later, for this finish or in general (for example, trigger the hockey stop at `d < 6`, or lerp the skier onto the stop point during shot 2).
  - Re-derive the Yeti's stop from the skier's actual position, so he stays at least 25 m out.

### N-2 (Major): The lantern flies 27 m through the air with its stone plinth attached
- **Evidence:**
  - `TrophyHandoff.start/update` (`trophy.ts:21-51`) flies the whole trophy group for 1.2 s and hides non-first children only on arrival.
  - The Whiteout trophy group contains the stone plinth (`rescue.ts:554-557`).
  - In strip 7.5 a dark grey stone block with the lantern on top hovers at head height beside the skier.
  - On arrival the plinth is made invisible, so it also vanishes from the porch.
- **Why it happens:** the shared handoff assumes the skier is standing at the podium (as in Alpine and Fjord). N-1 turns it into a 27 m arc.
- **Player impact:** a visibly broken prop at the emotional "lantern" beat.
- **Fix:**
  - Fly only `trophy.children[0]`, and leave the plinth in place.
  - Better: have the skier walk to the plinth, or have a rescuer hand the lantern over.

### N-3 (Major): The door never visibly opens and no warm light spills out
- **Evidence:**
  - `doorOpen` ramps from 3.8 to 4.7 s (`rescueVictory.ts:168`). `rescue.ts:619` sets `doorLeaf.rotation.y = −1.6·doorOpen`, and `doorLight` rises to 46.
  - In strip 3.5, 4.5 and 6.5 (crops compared side by side), the door panel is identical: closed, brown, with no orange doorway (the `warm` MeshBasic frame behind it, `rescue.ts:335`) showing. `21` (5.2 s) is the same.
  - The only warm spill I can find is a faint pink tint on the snow in front of the porch in 3.5.
- **Not determined:** why the leaf does not show as rotated. The rotation sign and hinge look correct to me on paper. It needs a direct check (log `doorLeaf.rotation.y` and capture with the leaf hidden).
- **The notes:** the manifest note for `21` ("as it opens, skier arriving") does not match its image.
- **Fix:** make the open door and the bright orange doorway the subject of shot 2, with the skier in front of it.

### N-4 (Major, motion; from code): The Yeti comes in at about 16 m/s while playing a walk cycle
- **Evidence:**
  - From 8.8 s he starts 38 m beyond his stop (`rescueVictory.ts:60`).
  - The step `v = max(2.5, dist/(B.flinch − 0.3 − t))·dt` (`:191`) solves to a constant of about 38/2.3 ≈ **16.5 m/s**. The animation runs `speed = 5` in `walk` mode (`:192`), and `YetiModel.ts:278-290` derives gait frequency from `anim.speed`.
  - So the feet cycle for 5 m/s while the root moves at about 16.5 m/s: roughly a 3× foot-slide during the "shape comes in from the storm" shot.
  - Strip 9.5 → 10.5 is consistent with this: about 26 m → about 9.5 m from his stop in one second.
- **Player impact:** "a shape lumbers out of the white" becomes a sliding figure. The emergence is over in about 1.5 s of screen time.
- **Fix:**
  - Show him earlier (about 7.5 s) or start him closer (about 15 m).
  - Drive `yetiAnim.speed` from the actual root speed.
  - Let him slow into the stop.

### N-5 (Major): The light-drives-off-the-Yeti beat is still not legible at gameplay resolution
- **Evidence:**
  - No searchlight beam, pool or rim light is visible on him in strip 10.5–12.5, `23` or `24`, despite `uK 0.42` and intensity 420 (`rescue.ts:634-636`). The developer's README concedes this.
  - The lantern (which does now read) is never in a frame with the Yeti. Shot 4 is meant to be "past the skier's shoulder and the raised lantern", but the camera sits 1.6 m on the hut side of the skier at FOV 34→28 (`:110-111`), and the skier is out of frame: only a dark sliver at the right edge of strip 9.5.
  - The `disgust` pose at 12.5 (one open palm raised, mouth open) reads as a wave or greeting, not recoil from light.
- **Player impact:** the climax has no visible cause. A Yeti walks up, waves, and leaves.
- **Fix:**
  - Put the lantern halo and the skier's silhouette in the foreground of shot 4.
  - Make the beam a visible volumetric cone with a bright pool on the snow at his feet, and over-expose him (emissive or rim boost) while it is on him.
  - Use a recoil pose that shields the eyes and turns the head away from the light source.

### N-6 (Major; audio, from code): The storm wind keeps roaring through "the wind drops" and the reveal
- **Evidence:**
  - `weatherAudio()` feeds `storm: this.victory ? f.s : 0` from the **live front** (`GameSession.ts:1267`), not from `world.weatherOverride`.
  - The strip manifest shows the live front in `storm` at s = 0.80–0.91 for the whole 0.5–23.5 s, while the override clears to storm 0 at 18.6 s.
  - `windTargets` (`audio/logic.ts`) adds `0.55·w` to the low gain and raises the whistle and gusts accordingly.
  - So the howl stays near full storm level under the clearing, the fanfare and the title.
- **Not verified:** the mix balance against the victory theme. The round-2 `audio.json` has no victory rows.
- **Fix:** take `storm` from `world.weather.storm` (which the override sets) whenever an override is active.

### N-7 (Minor): The Yeti pops out of frame mid-crane
- He is still visible at 16.5 s (strip 16.5, left of the skier) and is gone at 17.5. `root.visible = false` fires at `leave + 4 s` = 17.0 s (`rescueVictory.ts:215`) while he is in frame, as the fog thins and makes him *more* visible.
- **Fix:** fade him out, walk him over a rise, or hide him only once he is out of the frustum.

### N-8 (Minor): The crane opens on a dead frame
- Strip 14.5, the first second of the storm-break shot, shows marker poles, the akja and the hut cut off at the right edge. There is no subject.
- **Fix:** start the crane on the porch, with the skier and rescuers in frame.

### N-9 (Minor): The title over a pale sky is unverified
- The `victory` title is cream (#fff8e6) at top 22%, over the near-white overcast of strip 19.5–23.5, with a scrim shadow (`styles.css:127, 134-135`). Contrast cannot be judged because the HUD is hidden.
- **Fix:** capture at least one victory frame with the HUD on, as for Fjord (`11c`).

### N-10 (Minor, evidence integrity): Several manifest notes do not match their images
- `21` "door opens, skier arriving": neither happens.
- `22` "lantern raised in the doorway": it is raised 27 m from the doorway.
- `24` "in the searchlight beam": no beam is visible.
- `26` "title": the HUD is hidden.
- `17` "Yeti silhouette": there is no Yeti in the frame.
- `round-2/e2e.txt` is listed but missing.
- The strip manifest does not record `yetiVisible`, although the session exposes it.

---

## Distinctness vs Fjord and Alpine

- The concept stays the most distinctive of the three endings: storm to shelter, light against the monster, the weather breaking. In tone and palette it is clearly separate from Fjord's sunny harbour gag (`fjord/final/11f`) and Alpine's party.
- What converges is mechanical and template-level: the same both-arms-up trophy raise, and the same crane to a titled wide shot with a `victory scrim` title.
- The cave encounter still uses the shared camera with weather layered on. Compared with Fjord's `08d` roar burst (large sprite puffs against black), Whiteout's `14` burst is smaller and less legible.

## What would raise Cinematics to 9

1. Get the skier to the porch (N-1). Everything else in the middle act depends on it: the welcome two-shot, the lantern in the doorway, and the Yeti at 25–30 m in the light.
2. Fly only the lantern (N-2) and make the door open on screen with an orange doorway and spill (N-3).
3. Make the light-vs-Yeti beat legible (N-5): the lantern and skier in the foreground of shot 4, a visible beam and pool on him, and a recoil pose. Pace his approach so the gait matches the root speed (N-4).
4. Couple the wind audio to the override, so the storm audibly breaks with the fanfare (N-6).
5. Polish: no pop-out (N-7), a crane that opens on the porch (N-8), the front of the station or the lit porch in the reveal, and some warm sun in the clearing.
6. Cave: sideways-driven spindrift, a burst that reads at 1280×720, and a gentler lull.
7. Evidence: one victory frame with the HUD and letterbox on, a storm-chase frame with the Yeti within 30 m and the rear view, and the missing e2e log.

## Verified myself vs taken from developer material
- **Verified myself:**
  - Every frame description (I viewed all 24 strip frames, evidence 05, 12–26 and the Fjord comparison frames, and cropped the door region in strip 3.5, 4.5 and 6.5).
  - Every file:line reference.
  - The fog clamp arithmetic.
  - The skier, door and Yeti-stop geometry solved from manifest camera poses (approximate, ±a few metres).
  - The Yeti approach speed derived from code.
  - The storm-look reset path.
  - The live-front values that feed the wind audio.
- **From developer material and not confirmed:** that the e2e test passes (no log), and the beat intentions in code comments (used only as the stated intent).
- **Not verifiable from stills:** motion, foot-slide, flinch and walk animation, particle motion, cut rhythm, music, fanfare and wind mix.

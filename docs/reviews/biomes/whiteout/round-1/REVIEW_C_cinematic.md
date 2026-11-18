# Whiteout Ridge, round 1: Review C (Cinematics Director)

- **Reviewer:** C, Cinematics Director. I own category 5 (Cinematics).
- **Nature:** I am a model-based reviewer, not a human playtester. I did not play the game. I judged it from still frames, source code and the evidence files.
- **Build:** `3f7bc45` (branch `pass5-whiteout`). The evidence `manifest.json` records SHA `6d0cdfa`. I checked `git diff --stat 6d0cdfa 3f7bc45 -- src` and `git diff --stat 0f04659 3f7bc45 -- src`, and both are empty, so the evidence frames come from the candidate's `src/`.
- **What I examined:**
  - Evidence frames 12–26 (SwiftShader, 1280×720), `evidence/manifest.json` (cinematic times, camera poses, front state) and the capture script `tools/whiteout_evidence.mjs`.
  - `src/world/biomes/whiteout/views/rescueVictory.ts`, `rescue.ts`, `stormCave.ts` and `index.ts`.
  - The shared code: `src/cinematic/EndCinematics.ts`, `src/cinematic/victory/alpineResort.ts`, `src/game/World.ts` (weather override and release), `src/world/Environment.ts` (fog), `src/game/GameSession.ts` (storm look, skip, rear view) and `src/world/biomes/whiteout/storm.ts`.
  - For comparison, the Fjord victory (`src/world/biomes/fjord/views/harbourVictory.ts`) and the frames `docs/reviews/biomes/fjord/final/11_victory_trophy.png` and `11c_victory_reveal.png`.
  - The spec: `docs/BIOMES.md` §finish and `docs/DESIGN.md` §Cinematics.
- **Limits:** SwiftShader stills show no motion. I could not see easing, camera handheld, animation (wave, cheer, flinch, roar), particle motion, cut rhythm, audio, or how long each beat feels. Where a finding depends on motion, I say so.

---

## Verdict: FAIL for category 5 (Cinematics), 5/10 against the 9/10 target

The concept for the rescue victory is strong and specific to Whiteout: storm to shelter, a lantern, the Yeti driven back by the light, then the storm breaking. The execution does not deliver it. The frames show five problems:
- There is no visible storm during the "storm" beats.
- The door and warm-light beat is never in frame.
- The Yeti is visible before his reveal.
- The flinch plays in the wrong shot.
- The final "reveal" frame contains neither the station nor any character.

From the code, the Whiteout victory script also never does the following, while the Alpine and Fjord scripts do all of it:
- turns on the letterbox;
- hides the gameplay HUD;
- switches the music to victory;
- plays the fanfare;
- shows a title card.

The cave encounter is the shared sequence with weather and particles layered on. Its signature additions (the squall, the roar burst) barely read in the frames. I found no storm-pursuit evidence that actually shows a storm.

## Scores

| # | Category | Score | One-line justification |
|---|---|---|---|
| 1 | Visual art direction (lc) | 6 | The station is well dressed (mast, windsock, snowcat, signage). The storm air in the victory frames is flat grey, with no driven snow and no warm-light contrast. Frame 26 shows a flat white jagged cut-out against blue sky. |
| 2 | Environmental uniqueness (lc) | 7 | The rescue station, searchlight and storm lantern are specific to Whiteout. The rimed cave is a re-skin of the shared cave. |
| 3 | Skiing and hazard mechanics (lc) | 6 | Not examined beyond the frames. No basis for a higher score. |
| 4 | Difficulty and fairness (lc) | 6 | Not examined. `courses.json` shows the normal skilled autopilot caught on both Sprint courses. That is a developer number I did not assess. |
| **5** | **Cinematics** | **5** | A distinctive concept. In the frames the storm, the door, the light-on-the-Yeti and the reveal beats are not legible. The finish has no letterbox, HUD hide, music change or title. The cave additions do not read. |
| 6 | Performance and stability (lc) | 6 | Not examined. The evidence frames have no page errors (`manifest.errors: []`). |
| 7 | Accessibility and controls (lc) | 6 | Not examined. The victory beacon pulses at 1 Hz, and I found no "reduce flashes" gate on it in `rescue.ts:583`. I did not verify this further. |
| 8 | Overall player experience (lc) | 6 | The ending is the weakest of the three locations' endings in the evidence I saw. |

---

## Findings

### C-1 (Major, release-blocking): The Whiteout victory never turns on cinematic presentation (letterbox, HUD hide, victory music, fanfare, title)
- **Evidence (code, verified):**
  - `alpineResort.ts:92-96` and `harbourVictory.ts:247-252` both open with `st.hud.gameplayWidgets(false); st.hud.letterbox(true); st.audio.setMusicMode('victory'); st.audio.playVictoryFanfare(); st.audio.playCrowdCheer(...)`.
  - Both end with a title card: Alpine "YOU SURVIVED THE MOUNTAIN" at 13.0 s, Fjord "YOU REACHED THE SEA" at 24.0 s with a 2.6 s hold. Both turn the letterbox off at the results.
  - `rescueVictory.ts` (all 180 lines) calls none of these. The only audio it plays is `playCrowdCheer(0.4)` through the trophy hook (line 46) and a growl (line 154).
  - The shell `VictoryCinematic` (`EndCinematics.ts:91-114`) does not set any of them either.
  - Apart from the scripts, the only other `setMusicMode` calls are `explore`, `tension`, `chase` and `menu` (`GameSession.ts:181, 277, 506, 745`; `App.ts:338`). So chase music carries on through the whole Whiteout victory.
- **Why the evidence hides it:** the capture script sets `window.__skifree.hud(false)` before the victory (`tools/whiteout_evidence.mjs:240`), so frames 20–26 cannot show whether the HUD widgets and letterbox are present. In the Fjord frames (`11_*.png`) the letterbox bars and "Skip Esc" prompt are visible.
- **Why it matters to the player:** the player's reward lands with gameplay widgets on screen, chase music still playing, no fanfare, and no title to name the achievement. The ending feels unfinished, and it is the one ending that breaks the series' own convention.
- **Not verified:** whether the HUD's own logic hides some widgets when the phase changes. The weather pill hides because `run.simulating` is false (`GameSession.ts:1168`), but I could not confirm the score, speed and distance widgets.
- **Fix:** add the same `tl.at(0, …)` block as Fjord (widgets off, letterbox on, `setMusicMode('victory')`, fanfare). Add a title such as "YOU MADE IT DOWN" or "RESCUED", with the subtitle "Whiteout Ridge — through the storm to the station", after the reveal settles. Hold at least 2 s, then `letterbox(false)` at the results. Re-capture with the HUD on so the letterbox is in evidence.

### C-2 (Major): The final "reveal" frame has neither the station nor any character in it
- **Evidence:**
  - `26_v_reveal.png` (19.3 s) shows only the ridge flank on the left, a band of flat white haze on the right, and a hard-edged white jagged silhouette against blue sky at the top right. There is no hut, skier, Yeti or rescuers.
  - The script's intent (`rescueVictory.ts:16-18`) is "the whole ridge … stands in low sun behind the station".
  - **Geometry (`rescueVictory.ts:111-117`):**
    - The end camera is `hut − faces·61 + across·26`, 38 m up.
    - The end target is `hut + faces·320`, 150 m up.
    - Seen from the camera, the hut is about 30° below horizontal and the target about 16° above. That puts the hut about 46° off the view axis.
    - The vertical half-FOV is 27° (FOV 54).
    - So the hut is about 19° below the bottom of the frame. This is a framing error in the camera setup, not a capture artefact.
  - Frame 25 (15.0 s) already has the roof clipped at the bottom right (x 750–970, y 655–720) and the mast cut at the right edge. The upper half of that frame is empty grey sky.
- **Why it matters:** the last image before the results is the emotional payoff, "you got through, and here is the ridge you came down". Without the station or the skier in it, it reads as a generic landscape, or as the camera having lost its subject. The Fjord reveal (`11c`) keeps the harbour in frame and marks the start.
- **Not verified:** whether "low sun" lighting arrives. Frame 26 shows no warm raking light or long shadows.
- **Fix:** aim the end pose so the hut sits in the lower third: target roughly `hut + faces·200 + up·40`, or raise the camera less. Keep the skier and the lit door readable at the start of the crane. Settle the camera at about 18 s and hold it under the title.

### C-3 (Major): The "storm still rages" is not visible in any victory beat; the override fog is too thin to hide anything
- **Evidence:**
  - The override sets `visibility: 9` (`rescueVictory.ts:60`), which gives a fog density of 0.00085 × 9 = 0.00765 (`Environment.ts:244-247`).
  - With `FogExp2` the transmittance is exp(−(d·r)²): 94% at 32 m (the Yeti's stop point, `rescue.ts:560`), 86% at 50 m and 56% at 100 m.
  - The gameplay storm uses multiplier 11 (`storm.ts:31`) times the hazard visibility, so the cinematic storm is lighter than the gameplay storm the player just skied through.
  - In frames 20–24 the hut, the rescuers, rocks and trees 50–100 m away and the trail-marker lamps are all crisp. I see only a handful of flakes, no driven streaks, and a flat grey sky.
  - In frame 21 the Yeti stands fully legible about 55 m away.
  - Nothing in the warm palette carries the frame either. In 20 and 22 the windows read white or grey, and no warm pool of door light falls on the snow.
- **Why it matters:** the whole arc of the sequence (darkness and storm, then light and safety, then the storm breaking) depends on the contrast. If the opening is not stormy, the "break" at 12.8–16.8 s has nothing to break from. Frames 25 and 26 differ from 20–24 mainly in sky colour.
- **Not verified:** particle streaks in motion. Some driven snow may read in real time even though the stills show little.
- **Fix:**
  - Hold the override at least at the gameplay storm (visibility 11–12 under the cap).
  - Raise snowfall and streaks in the arrival shots.
  - Make the door, window, lantern and searchlight light the brightest elements in the frame, with warm light that visibly falls on the snow.
  - Keep the Yeti's stop point beyond 50% transmittance (about 100 m at the current density, or closer once the density is raised) until the searchlight finds him.

### C-4 (Major): The Yeti is in plain view before his reveal, and he never leaves the frame or the story
- **Evidence:**
  - `21_v_welcome.png` (5.03 s): the Yeti stands at left (x 118–160, y 290–352) in full light while the skier is still skiing in.
  - The code says he is "waiting out in the white, unseen" (`rescueVictory.ts:143-146`), but fog at 55 m hides only about 17% (see C-3).
  - The storm look (darkened pelt, eye glow) is deliberately reset in the victory (`GameSession.ts:1150-1161`), so nothing marks him as a threat either.
  - After the flinch he walks away at 2.2 m/s (`rescueVictory.ts:171`). By 15.0 s he is only about 8.5 m past his stop. In `25_v_break.png` he is clearly visible near the skier (x 540–560, y 612–650).
  - The script never hides him, fades him or plays a vanishing beat.
- **Why it matters:** the "Yeti at the edge of the light" beat (9.4 s) is spoiled 4 s early. The safety beat (25) still has the monster standing near the hero, with no sign that he has been driven off. In the Fjord sequence the Yeti's exit is a resolved gag.
- **Fix:**
  - Keep him beyond visible range, or out of the first two shots' frustums, until 9.4 s.
  - Let him emerge into the beam.
  - After the flinch, have him retreat quickly (3–4 m/s) into fog, and either hide him or let the closing storm swallow him before the clearing starts. A last glimpse of his silhouette on the ridge in the reveal could be a good button.

### C-5 (Major): The door and warm-light beat (3.4–6.6 s) is framed away from the door
- **Evidence:**
  - Shot 2 (`rescueVictory.ts:75-81`) places the camera at `door + faces·3.2..3.6 + across·4.6..5.4`, beside and slightly in front of the porch. It aims at `lerp(skier, door, 0.5..0.6)`, which while the skier is still out on the slope points the camera up the slope, away from the hut.
  - The door opens at 3.8–4.7 s (line 137), entirely behind or beside the camera.
  - `21_v_welcome.png` shows open slope, the small skier and the Yeti. The hut, porch, door and rescuers are all absent.
  - The manifest note "door open, warm light on the snow" does not describe this frame.
  - In `22_v_lantern.png` the door area (x 320–380, y 500–585) is a flat grey panel, with no warm spill on the deck or snow.
- **Why it matters:** "safety and welcome" is the first emotional turn. As framed, the player never sees the door open or the rescuers welcome them in. In frame 20 the rescuers are about 40 px tall.
- **Fix:** frame the door and the skier together. For example, a reverse angle from just inside or beside the door, looking out, as the door swings and light spills onto the snow, with the skier gliding in from the storm. Or a two-shot with the porch in the foreground. Make the warm spill strong enough to read in software rendering.

### C-6 (Major): The flinch plays in the wide shot, and the "close on him" shot shows only his back
- **Evidence (timing, from code):**
  - The Yeti starts at 5.2 s from 26 m beyond his stop and walks at 5.5 m/s, so he arrives at about 9.93 s.
  - He then holds the `disgust` flinch for 1.2 s, to about 11.13 s, and then turns away (lines 143–175).
  - The close shot "as the light hits him: he flinches" begins only at 11.3 s (`RESCUE_BEATS.yeti + 1.9`, lines 101–109). It is placed between the Yeti and the door, 6–7 m from him on the door side, while he walks away from the door.
- **Evidence (frames):**
  - `24_v_yeti_flinch.png` (12.0 s) is the Yeti's back and buttocks filling the frame. No face, no flinch, no light.
  - `23_v_yeti_light.png` (10.4 s, the actual flinch window) shows him lit evenly, mouth open, one arm reaching toward the lens. In a still that reads as a lunge or a roar, not recoil.
  - That shot was meant to be "past the skier's shoulder, the lantern raised toward him". In 23 neither the skier's shoulder nor the lantern is in frame (FOV 30.6).
- **The searchlight:**
  - It snaps to a fixed point (`S.searchTarget = …clone()`, line 100), so it does not swing onto him: `P.lookAt(aim)` has no interpolation (`rescue.ts:595-599`).
  - It never follows him as he backs off.
  - No beam or light pool is visible on him in 23 or 24.
- **Why it matters:** this is the sequence's one character beat and its link to the lantern (light beats the Yeti). The cause and effect (lantern raised, beam hits him, he recoils) is not shown in any single frame or across the cut.
- **Not verified:** the `disgust` and `turnAway` animation in motion.
- **Fix:**
  - Start the flinch when the close shot starts, or move the close shot earlier.
  - Put the close camera on the far side, so we see his face turn from the light, with the beam visibly on him.
  - Interpolate the searchlight onto him over about 0.6 s and keep it tracking him as he retreats.
  - Keep the lantern and the skier's silhouette in the foreground of shot 4.

### C-7 (Major): The cave encounter's signature Whiteout additions do not read in the frames
- **Evidence:** the shared cave camera is unchanged ("no shot changes", `stormCave.ts:147`). Whiteout adds the squall, the brow curtain, the spindrift and the roar burst.
  - `12_cave_mouth` (3.0 s): the brow curtain is a single small puff (x 470–500, y 70–90).
  - `13_cave_emerge` (8.6 s, squall at k ≈ 0.95): I see round soft flakes and no sideways streaks. I cannot see the spindrift at boot height across the mouth. The light is not visibly flatter than in 12.
  - `14_cave_roar` (11.3 s, 0.28 s after the burst): the brow is mostly out of frame. The burst shows as a faint grey smudge (x 860–950, y 95–145). The grains are 0.16 units (`stormCave.ts:110`) and too small at this distance to read as "a cloud blasted off the brow".
  - `15_cave_leap` (15.2 s): the Yeti is about 45×60 px against the rock (readable, but small). The squall has lifted to about 30% (lull 12.2–14.4 s), so the sky is bright and clear. The weather jumps from dark squall (13, 14) to clear (15) within about 3 s of cinematic time.
- **Framing risk:** in 12 the Yeti sits at y 625–715. With the shared cave letterbox on (`CaveCinematic.ts:159`; the Fjord bars are about 11% per edge), he would be under the bottom bar. These captures had the HUD and letterbox hidden, so I could not check this.
- **Why it matters:** the brief sells this as a storm cave, but the frames show the shared encounter with light snowfall. The roar burst, its one new set piece, is framed out.
- **Fix:**
  - Scale the burst up and aim it into frame: larger grains or a sprite puff, and a short whiteout flash across the lens.
  - Use streak particles for the spindrift.
  - Make the squall darken the exposure visibly.
  - Bring the lull back more gradually, so the leap reads without a weather pop.

### C-8 (Major, conditional; frequency not measured): A cave squall that starts in a storm makes the weather clearer
- **Evidence:**
  - `stormCaveCinematic` blends from the current weather (`base`) toward fixed targets: visibility 5.2, storm 0.62 (`stormCave.ts:26, 162-168`).
  - The gameplay storm is visibility 11 (`storm.ts:31`) and storm up to 1.
  - So if an encounter starts in a storm, the "squall rolling in" lowers the fog and storm values. The air clears as the Yeti emerges, then the 7 s release brings the storm back.
  - In Sprint the only encounter falls inside the 22 s calm start (`storm.ts:22`; the audio rows put the encounter at about 8 s). Endurance has 3 encounters (`courses.json`, `*-END*` rows), and nothing I found guarantees that encounters 2 and 3 fall in a clear window.
- **Why it matters:** the intended beat is inverted for some encounters in longer runs.
- **Fix:** make the squall additive or a maximum, e.g. `visibility = max(base, target)` and `storm = max(base, target)`. Or schedule fronts so that no encounter starts inside a storm.

### C-9 (Major for evidence; Minor in play): There is no evidence of the storm pursuit; frames 16 and 17 show clear sky under a "STORM" label
- **Evidence:**
  - `16_storm_chase.png` shows a blue sky with pink-lit clouds, ridges in focus far away, and the HUD pill "STORM ←". The manifest records front `storm`, s = 0.84.
  - `17_yeti_silhouette.png` is the same: the Yeti is lit and clearly visible on the cave face, not a silhouette in snow, with blue sky top left.
  - The cause is in the capture: the script jumps the clock into a storm right after the cave (`whiteout_evidence.mjs:209`). It shoots as soon as the gap is 18–34 m (z = 286, 4 m past the trigger), inside the cave's 7 s weather release (`World.ts:429-434, 590-601`).
  - In 16 the rear-view inset ("BEHIND YOU") frames the cave, but the Yeti is not discernible in it.
- **Why it matters:** the storm look of the Yeti in pursuit (darkened pelt and eye glow, `GameSession.ts:1150-1156`) and the rear view in fog are among the most cinematic moments in gameplay, and neither is evidenced.
- **In play:** after the cave, the HUD can say "STORM" for several seconds while the sky is clear, if a front is in storm when the release starts. That is Minor.
- **Fix:** re-capture 16 and 17 at least 10 s into the chase during a storm. Consider syncing the release to the front, or holding the HUD pill until the visible weather agrees with it.

### C-10 (Minor): The lantern prop does not glow and shares the hand with the ski pole; the trophy pose is the shared one
- **Evidence:**
  - In `22_v_lantern.png` the lantern (x 555–625, y 300–425) reads cream or white, not as a warm light source. It has emissive 2.5 and a 4-intensity point light with 7 m range (`rescue.ts:513, 520`), and no warm light falls on the skier's helmet or jacket.
  - The ski pole's shaft runs straight down from under the lantern (x 585, y 425–640), so the lantern looks mounted on the pole.
  - The raise pose (both arms up) matches the Fjord lighthouse raise (`fjord/final/11_victory_trophy.png`) because `TrophyHandoff` is shared.
- **Why it matters:** in a storm-to-light story, the lantern should be the warmest and brightest thing in the frame. As shown it is an ornament.
- **Fix:**
  - Raise the lantern's glow, or add a sprite halo.
  - Light the skier's face and jacket from it.
  - Drop or stow the pole in that hand.
  - Use a one-arm "lantern held out toward the dark" pose that sets up shot 4.

### C-11 (Minor): The arrival shot does not match its own description
- **Evidence:**
  - The intent is "low, behind the skier … looking at the door" (`rescueVictory.ts:4-7, 62-70`).
  - `20_v_arrive.png` (1.8 s) shows the skier in three-quarter profile heading screen-left, in front of the hut, rather than seen from behind and heading into the light.
  - The beacon, searchlight beam, warm windows and porch light do not register as "the only colour ahead". The whole hut is red, and the porch light is a small glow.
- **Not verified:** the autopilot carve may swing the skier's heading during the move.
- **Fix:** track the skier from behind on the line to the door, and keep the hut's light sources dominant.

### C-12 (Minor): The timing is compressed and the reveal has no settle
- **Evidence:**
  - The results fire at 19.6 s (`RESCUE_BEATS.results`), at the same moment the crane's `ease.inOut` ends, so the final frame is never held.
  - Fjord settles at 23.8 s, shows the title at 24.0 s, and goes to results at 26.6 s.
  - The storm clears from 12.8 to 16.8 s while the camera is mid-crane with the station already leaving the frame, so the clearing is not anchored to the subject.
- **Fix:** about 22–24 s total: storm break about 13–17 s on a held wide shot with the hut and skier in frame, crane done by about 19.5 s, title at about 20 s, results about 2.5 s later.

---

## What is good
- The concept is distinctive and fits the location: from storm to shelter, a light-against-monster beat, and the weather breaking as the payoff. It is a real departure from the Alpine resort party and the Fjord harbour gag, not a swap of props.
- The station dressing is strong and well chosen (frames 20 and 22): mast, beacon, windsock, snowcat, the "MOUNTAIN RESCUE · RIDGE STATION" sign, and rescuers on the porch.
- The weather continuity is technically sound. One override owns the weather for the whole victory and clears on a smoothstep (`rescueVictory.ts:129-136`). The cave hands the weather back over 7 s instead of snapping. The storm look is now reset at the finish (`0f04659`), with an e2e test.
- The beats are named constants (`RESCUE_BEATS`) and the evidence was captured frame-accurately on the cinematic clock, which made this review possible.
- The leap (15) reads: a white figure against dark rimed rock.

## What would raise Cinematics to 9
1. Give the finish the cinematic presentation every other location has: letterbox, HUD off, victory music and fanfare, and a titled, held reveal (C-1, C-12).
2. Make the storm real in the first half: gameplay-strength fog and driven snow, with warm light from the door, windows, lantern and searchlight as the brightest elements in the frame (C-3, C-10).
3. Re-stage the welcome so the door opening and the warm spill are on screen (C-5).
4. Hide the Yeti until the beam finds him. Show the flinch in a close shot with the beam on his face and the lantern in the foreground. Resolve his exit before the clearing (C-4, C-6).
5. Re-aim the crane so the station, skier and ridge share the final frame in low sun (C-2).
6. Make the cave's storm additions legible: a visible roar burst, streaking spindrift, a squall that darkens the frame, and a squall that never lightens an existing storm (C-7, C-8).
7. Re-capture the storm pursuit inside a real storm, and capture with the HUD and letterbox on, so frame composition against the letterbox can be checked (C-9).

## Verified myself vs. taken from developer documents
- **Verified myself:** every frame description above (I viewed the PNGs); every file:line reference; the fog transmittance arithmetic; the geometry of the C-2 camera; the Yeti's arrival and flinch times derived from the code; and the absence of letterbox, HUD, music and title calls in `rescueVictory.ts` and in the shell.
- **Taken from developer material and not independently confirmed:** the beat intentions in code comments and manifest notes (used only as the stated intent I judged against), and the encounter count per course length (`courses.json`).
- **Not verifiable on SwiftShader stills:** motion, animation quality (wave, cheer, flinch, roar), particle movement, cut rhythm, audio and real-time pacing.

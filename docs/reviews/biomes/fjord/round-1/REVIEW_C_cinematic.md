# Fjord Coast — Round 1 — Reviewer C: Cinematic & Animation Director

- **Reviewer:** C, Cinematic & Animation Director
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `f8519ca` (branch `pass4-fjord`; I checked that `git diff --stat f8519ca HEAD -- src` is empty)
- **Date:** 2026-11-10
- **Evidence used:** every Fjord round-1 PNG at 1920×1080. For comparison I used the Alpine baseline `07`, `08`, `11`. Source I read: `src/cinematic/CaveCinematic.ts`, `EndCinematics.ts`, `victory/trophy.ts`, `victory/alpineResort.ts`, `src/world/biomes/fjord/views/{harbourVictory,harbour,seaCave,mist}.ts`, `src/yeti/{Snowballs,SnowballView}.ts`. I ran `npx vitest run tests/unit/fjord.test.ts tests/unit/snowballs.test.ts` and all 34 tests passed.

## 2. Verdict — **FAIL**

The Fjord's establishing imagery is the strongest the project has had so far. The menu preview, the summit shot looking out over the sea, the windsock shot and the closing view back up the fjord all say "coastal fjord" at a glance. The cinematics do not meet the 9/10 bar.

- **Cave encounter is shared, not Fjord-specific.** The cave encounter (`CaveCinematic.ts`) has no biome logic at all. The "sea cave" is the Alpine cave mesh with basalt props added (compare `07_yeti_cave.png` with the Alpine `07`). One of those props blocks a fifth of the frame in the emergence shot.
- **Victory is mostly the Alpine script.** The victory script follows the Alpine beat sheet nearly beat for beat: the same Yeti disgust gag at the same times (4.4/5.6/7.3 s against Alpine's 4.6/5.6/7.4 s), the same trophy that flies into the hand, and the same title text. The new material is a cold-plunge beat and the closing reveal.
- **The après shot is badly staged.** The camera sits about 2 m from the bonfire, guests clip through the tub, and the deck is an untextured brown slab.
- **The reveal does not land fully.** The mountain-reveal idea from the brief is attempted, but the title appears over it 1.5 s in, half the frame is a featureless near cliff, and the camera aims at mid-course rather than the summit.

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **6.5** | Wide shots are strong (`01`, `02`, `03`, `04`). Close-up quality drops a lot: the finish plaza ground is blotchy (`10`, `10b`), the tub deck is a flat brown slab (`11b`), cliff faces show vertical texture streaks and rocks that seem to float (`06`, `11c`), and `06` has a hard-edged peach rectangle in the sky. |
| Environmental uniqueness | **7** | Cliffs, open sea, painted houses and the lighthouse are unmistakably not Alpine. But the cave is the Alpine cave with props, and the victory uses the Alpine beat structure. The "distant islands" read as hundreds of identical ice floes. |
| Skiing and hazard mechanics | **7** (low confidence) | From stills only: the windsock telegraph for the sea gust (`04`) and the snowball light column (`09b`/`09c`) both read clearly. I did not test feel. |
| Difficulty and fairness | **7** (low confidence) | The Hard-mode landing marker is clearly readable from the chase camera. The Yeti's 0.42 s wind-up cannot be read in the rear-view inset (see defect 9). |
| Cinematics | **5.5** | The cave encounter is unchanged across biomes and its emergence frame is blocked by Fjord dressing. In the trophy beat the trophy flies to the skier, who is filmed from behind, with no presenter. The après shot has staging and clipping faults. The reveal is the best new idea but loses its moment to the title and the near cliff. The Yeti "sniffs the fish racks" gag is not staged near any fish rack. |
| Performance and stability | **7** (low confidence) | Every manifest reports `errors: []`. SwiftShader stills tell me nothing about frame rate, and I did not profile. |
| Accessibility and controls | **7** (low confidence) | Captions appear for cave audio and Yeti footsteps. The snowball-throw caption only fires on the first throw. The victory subtitle in `11c` is nearly unreadable against the sky. |
| Overall player experience | **6.5** | Skiing toward the sea is a memorable start. The end does not yet pay it off with a distinct, well-staged sequence of its own. |

## 4. Defects

1. **Major — Cave encounter is not biome-specific; the "sea cave" is the Alpine cave with props.**
   - **Evidence:** `07_yeti_cave.png` has the same mouth outline and rock strata as `alpine-baseline/07_yeti_cave.png`, only tinted beige. `08_yeti_cinematic.png` is nearly the same frame as the Alpine `08`: same Yeti pose, same camera, same timing. `src/cinematic/CaveCinematic.ts` never refers to the biome. Every shot and beat (lines 56–98) and the emergence/roar beats (lines 136–153) are shared.
   - **Context:** The brief (§2) asks for "a biome-appropriate cave and Yeti encounter". This is also not a *sea* cave: it sits on a snow slope with no water, and the boat is beached on snow.
   - **Fix:** Add a per-biome encounter hook (shot overrides and extra beats) to `CaveCinematic`. For the Fjord, consider:
     - a surf or spray burst out of the mouth on the roar;
     - icicles shattering off the brow and falling;
     - the Yeti shoving the beached boat aside as it emerges;
     - gulls scattering from the basalt;
     - a sea-mist plume rolling out of the mouth.

     Also give the cave mesh a basalt or sea-worn material and silhouette instead of the Alpine strata.

2. **Major — Fjord basalt dressing blocks the emergence shot.**
   - **Evidence:** In `08_yeti_cinematic.png`, the left ~20% of the frame is a near-black, flat-shaded column face with the green net on it. It reads as an untextured slab.
   - **Cause:** The emergence camera is `at(M, 9.0, 1.4, 3.2)` (`CaveCinematic.ts:74`). `seaCave.ts:29` `clearOfPath` keeps props away from the Yeti's exit path and ledge only, not from cinematic camera positions or sightlines. Columns start 6.2 m to the side and 6 m out from the mouth (`seaCave.ts:37–40`), roughly 4 m from that camera.
   - **Fix:** Have `CaveDressingContext` expose the cinematic camera positions and frusta, and reject props inside them. Add a unit test that no dressing mesh's bounds intersect the emergence and roar camera frusta within 6 m.

3. **Major — Victory sequence reuses the Alpine beat sheet.**
   - **Evidence:** `harbourVictory.ts:53–139` against `alpineResort.ts:50–116`:
     - same opening crossing shot (offsets −17/4.2/14 against −16/4.5/16);
     - same Yeti approach → stand → `disgust` → `turnAway` at 4.4/5.6/7.3 s (Alpine 4.6/5.6/7.4 s);
     - same `TrophyHandoff`, where the trophy flies by itself into the hand;
     - same title "YOU SURVIVED THE MOUNTAIN".
   - **Context:** The brief asks for a *memorable* victory cinematic that uses the elevation difference, and says not to reuse the Alpine resort.
   - **Fix:** Replace the Yeti disgust gag with a coastal one. Examples: the Yeti reaches the quay and a fisherman shoos it off with a fish; it gets a bucket of herring and wanders off placated; it stops at the waterline, dips a toe in the cold sea and retreats. Give the trophy a real presenter, such as a harbourmaster in oilskins handing it over from the fish-crate podium, with a ship's horn or the lighthouse beam as the stinger. Use a Fjord-specific title.

4. **Major — Après shot is mis-staged.**
   - **Evidence:** In `11b_victory_celebration.png`:
     - the bottom-left of the frame is a huge, blurred orange flame card;
     - the lower ~40% of the frame is a flat brown slab with no planks or detail;
     - the near guest's white robe or legs poke out through the tub staves, below and in front of the tub wall at about (1000, 650);
     - the left guest sits on the rim with legs outside the tub.
   - **Cause:**
     - The shot-4 camera is `tub + (-7, 2.6, -6)` (`harbourVictory.ts:95`), which is `sp + (1, 2.6, -4.5)`. The bonfire is at `sp + (3, 0, -3.5)` (`harbour.ts:243`), about 2.2 m from the camera, so the flame is a near-plane smear and its iron basket is out of frame.
     - The deck is a single `BoxGeometry(12, 0.28, 12)` in flat `0x6b4e36` (`harbour.ts:221`).
     - Seated guests are placed at `tubR − 0.1` (`harbour.ts:462`), which is on the wall, not inside it.
   - **Fix:** Move the camera to the far side of the tub so the bonfire sits in the mid-ground. Seat guests at about `tubR − 0.55` and check that hips and legs stay inside the staves. Build the bathing deck from individual planks, or give it a plank texture or vertex colour.

5. **Major — The mountain reveal is undermined.**
   - **Evidence:** `11c_victory_reveal.png` at t = 19.5 s:
     - the right ~45% of the frame is the near fjord wall, with stretched vertical texture streaks and scattered rocks that seem to float on a vertical face;
     - the summit is not clearly shown;
     - the title, which appears at 16.5 s (`harbourVictory.ts:132`), sits across the mountain the shot is meant to reveal;
     - the subtitle "Fjord Coast — from the summit to the sea" is close to invisible against the bright sky.
   - **Cause:**
     - The look target is `max(L·0.42, L − 4200)` (line 101), which is about 1.26 km down a 3 km Sprint, so the camera aims at mid-course rather than the start.
     - Results fire at 22.0 s (line 133), before the shot's 22.5 s end, so the final pose is never reached.
   - **Fix:**
     - Aim at the actual start or summit, or the highest visible terrain within fog range.
     - Keep the camera centred over the fjord so the near wall frames the edge of the shot instead of filling it.
     - Delay the title until the pull-back settles (about 20.5 s) and hold 1–1.5 s on the final frame before results.
     - Give the subtitle a darker scrim or text shadow.

6. **Major — Hard-edged peach rectangle in the sky.**
   - **Evidence:** `06_long_distance.png`, a rectangle at about x 1170–1405, y 420–548, with hard top and right edges against the sky above the horizon.
   - **Cause:** Not identified from source. It may be a transparent card (mist bank or haze sprite) that is clipped or mis-sorted. The `SeaMist` sprites are placed 700–1900 m off the rim (`mist.ts:103`), which is where this camera sits.
   - **Fix:** Capture the same pose with `SeaMist.mesh.visible = false` and then other transparent sea layers hidden, to find the source. Then fix that layer's alpha falloff, sorting or far-plane clipping. It would also show in any wide or cinematic sea shot.

7. **Minor — The fish-rack motivation for the Yeti gag is not staged.**
   - **Evidence:** The script comment says "he sniffs the fish racks" (`harbourVictory.ts:5`). The Yeti stop point is `W(-62, -16)` (`harbour.ts:441`), but the nearest stockfish rack is at `W(-70, 30)` (`harbour.ts:352`), about 46 m away.
   - **Context:** The close-up looks from the skier's side toward the Yeti, so the racks are behind the camera or off frame. These beats (3.6–8.0 s) were not captured, so I cannot see the result.
   - **Fix:** Put the Yeti stop next to a rack and frame the rack in the 2b close-up. Add an evidence still at about 6.0 s.

8. **Minor — Trophy beat is filmed from behind, and the skis are cut by the letterbox.**
   - **Evidence:** In `11_victory_trophy.png`, the camera is behind the skier looking seaward (`harbourVictory.ts:84–85`), so we never see the face or the reaction. The skis touch the letterbox bar. Nobody presents the trophy; it flies in from the podium.
   - **Fix:** Use a 3/4 front orbit with the harbour behind, and frame the shot about 0.5 m lower.

9. **Minor — The Hard-mode throw cannot be read in the rear view; only the landing marker reads.**
   - **Evidence:**
     - In `09b`/`09c` the Yeti is about 10 px tall in the "BEHIND YOU" inset at 31–32 m. The 0.42 s wind-up (`Snowballs.ts:70`) cannot be read at that size.
     - The ball (`IcosahedronGeometry(0.42)`) is about 1–2 px.
     - The `[the Yeti hurls a snowball…]` caption fires only on throw 1 (`GameSession.ts:595`).
   - **Context:** The orange light column over the landing zone is the cue that carries the threat, and it reads clearly in both frames.
   - **Fix:** During a wind-up, pulse the inset border or flash a small throw glyph there. Optionally give the ball a short bright trail. Repeat a short audio and caption cue (`[snowball!]`) on every throw for players with sound off.

10. **Minor — Finish plaza ground is blotchy and low-resolution.**
    - **Evidence:** `10_finish.png` has large grey slush and puddle blotches across the whole plaza. In `10b_finish_ground.png` the foreground snow is a coarse, smeared texture. The same ground shows in `11`.
    - **Fix:** Use a cleaner quay material (cobbles or planks) near the plaza, and break up the blotch scale.

11. **Minor — Houses and floes are repetitive.**
    - **Evidence:** In `10`, `10b` and `11`, every house is the same gable box with one square window and no doors or trim. In `02`, `03` and `04`, the "distant islands" are hundreds of near-identical ice floes evenly spread to the horizon.
    - **Fix:** Add two or three house variants (porch, dormer, door, window trim). Replace part of the floe scatter with a few large rocky islands placed with intent for composition.

12. **Minor — The cave hoard does not match its description.**
    - **Evidence:** `seaCave.ts:4–5` says "a staved-in rowing boat half sunk in the snow". `07` shows an intact white fishing boat with a cabin and mast sitting on top of the snow (`seaCave.ts:78`).
    - **Fix:** Sink it deeper, tilt it, and remove the cabin, or build a rowing-boat shape.

13. **Minor — No coastal weather in any cinematic.**
    - **Evidence:** Neither cinematic uses sea mist, gust or spray. The mist only appears far off in `11c`.
    - **Fix:** In the reveal, start the camera inside a thin bank of sea mist and rise out of it, which also plays to the elevation contrast.

**Not verifiable from stills:**
- Yeti emergence motion: crawl → emerge → stand, foot planting and roar. Code plants feet on `cave.floorHeightAt` (`CaveCinematic.ts:41`, `:278`), and both stills show grounded feet and hands.
- The leap after the cinematic.
- The Yeti approach and disgust animation at the harbour (no still between 3.6 and 8.0 s).
- The trophy's flight arc (`trophy.ts:340–344`).
- The cannonball plunge and splash (12.3–13.55 s). From code it is a rigid lerp with a constant x-rotation and no tuck pose, which will likely look stiff.
- Camera smoothness, handheld noise and the 15–22.5 s pull-back motion.
- Boat bobbing and net sway.
- Whether the reveal framing works on Standard, Long or Endless lengths. Only Sprint was captured.
- Audio sync.

No tests cover the victory cinematic, cave-dressing camera clearance, or framing.

## 5. What works

- **Menu preview (`01`):** a clean cliff-and-sea composition that sells "Scenic" instantly.
- **Summit framing (`02`):** the run aimed at the open sea with walls on both sides is an excellent establishing shot.
- **Gameplay views (`09`, `09b`):** the sea appears at the end of the corridor during gameplay, so the destination is always visible.
- **Windsock hazard (`04`):** clear, diegetic and readable.
- **Lighthouse trophy (`11`):** a good coastal motif and clearly not the Alpine cup.
- **Reveal intent (`11c`):** the closing view back up the fjord, with the tiny harbour under the wall, is exactly the kind of elevation-contrast image the brief asks for. It needs re-staging (defect 5), not a different idea.
- **Yeti model and grounding (`08`, `08b`):** the cave camera language from the shared system is solid: letterbox, staging, an over-the-shoulder reaction shot.
- **Snowball landing marker:** the light column solves the problem of a flat ring seen edge-on from the chase camera.

## 6. Brief compliance (Fjord bullets relevant to Reviewer C)

| Requirement | Status | Evidence |
|---|---|---|
| Biome-appropriate cave and Yeti encounter (§2) | **partial** | Dressing only; the cave mesh and cinematic are shared. `07`, `08`; `CaveCinematic.ts` |
| Evidence of the actual cave and actual victory sequence (§8 C) | **done** | `07`, `08`, `08b`, `11`, `11b`, `11c` |
| Memorable victory cinematic (§2) | **partial** | The reveal is new; the Yeti gag, trophy hand-off and title are the Alpine ones (defect 3) |
| Use the elevation difference; ocean pull-back to reveal the mountain | **partial** | It exists (15–22.5 s) but the title, near-wall framing and mid-course aim weaken it (defect 5) |
| Coastal-themed trophy presentation | **partial** | Lighthouse trophy and fish-crate podium are done; no presenter, filmed from behind (defect 8) |
| Playful après-ski celebration | **partial** | Tub, bonfire and cold plunge exist; staging and clipping faults (defect 4); plunge motion not verified |
| Harbour, boardwalk, colourful buildings, fishing boats | **done** | `10`, `10b`, `11b`; `harbour.ts` |
| Distant ships, ocean to the horizon | **partial** | Ocean is done. No distant ship is visible in any still (a `ferry` exists in scenery code) |
| Do not reuse the Alpine resort | **done** for the set; **partial** for the cinematic | Set is new; beat sheet is reused |
| Clear skies, excellent visibility | **done** | `01`–`04`, `11c` |
| Occasional sea mist near the water | **partial** | Only distant haze in `11c`; possible mist artefact in `06` (defect 6) |
| Dramatic views across the fjord / distant islands | **partial** | `11c` is done. `01`–`04` look out to open sea; the "islands" are floe scatter (defect 11) |
| Hard-mode snowball readable in ordinary chase | **partial** | Landing marker reads; wind-up and ball do not read in the rear view (defect 9) |

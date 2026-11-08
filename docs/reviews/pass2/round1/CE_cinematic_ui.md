# Pass 2 · Round 1 · Reviewer C/E: cinematic and UI/UX/input

- **Reviewer:** C/E, an INTERNAL reviewer (another model instance, not an external human). I did not build this work.
- **Commit reviewed:** `41ceb7a Cinematic: threshold hand-plant beat; final 1920x1080 beat frames + grounding report (0 cm penetration, 438 visible frames)` (branch pass2)
- **Method:** static review only. I read the evidence images, `grounding_report.json`, the code and the tests. I launched no browser and ran no build, because a capture was running.

## Verdicts

| Area | Score | Pass mark | Verdict |
|---|---|---|---|
| Cinematic and grounding (P2) | **7 / 10** | 8 | **REJECT.** The grounding is good. Two motion defects (C1, C2) break the "no teleports" requirement, and the report does not cover the hand-off. |
| Menu and UX (P3) | **7 / 10** | 8 | **REJECT.** The layout fix is good. Course-code entry has functional bugs (E1, E2). The Yeti-row fit and the UI-scale test are unproven (E3, E4). |

Both rejections can be fixed quickly. All the fixes below are small.

---

## P2: cinematic and grounding

### What is good (checked against the evidence)
- **Feet grounded from the first frame.** At t=0.03 the root is on the floor and both soles read 0.000. In the 438 visible non-leap frames I found no negative sole clearance. Swing-foot lift peaks at about 0.34 m during the crawl, which is a plausible gait.
- **Approach from deep inside.** The Yeti starts at depth s=12.5 m on `cave.exitPath`, holds still until t=1.0, then prowls to the mouth. Root speed matches `yetiAnim.speed`: a constant 2.17 m/s during the crawl, and the ease-out derivative during the emerge from 7.9 to 10.0.
- **No fake vertical emergence.** Root y is always `floorHeightAt`, and the path points are sampled on the floor. Between the leap and the end of the report, the root never rises out of the floor.
- **Roof clearance.** The minimum is 5.55 m at the root column inside the cave, which is ample for a crawling Yeti. Frames t=9.5, 11.0 and 14.6 show no head–brow or icicle intersection.
- **Shots vs cave.** None of the inspected beats clips into the rock. The hand insert at 6.6 and the low angle at 9.5 both frame the floor correctly.
- **The leap is preserved** (14.6 → beyond 15.8).

### Is the grounding measurement sound?
`tools/cinematic.mjs` steps at a fixed 30 fps and calls `__skifree.yetiGround()` (src/game/App.ts:826-841). That function takes 5 solved sole probes per foot and compares them with `cave.floorHeightAt`.

- **Sound part:** `floorHeightAt` (src/world/Cave.ts:361-372) interpolates the same `fY` grid and the same B–C diagonal that build the floor mesh (Cave.ts:336-338). It therefore matches the rendered floor triangles, not an analytic approximation.
- **Weaknesses:**
  1. `rootAboveFloor` is 0 by construction, because `placeAt` sets y = floorHeightAt (CaveCinematic.ts:246). It proves nothing.
  2. The IK sampler and the measurement sampler are the same function, so a sole reading of exactly 0.000 in 284 frames shows the IK converged. It is not an independent pixel-level check. That is acceptable only because of the sound part above.
  3. Hands and knuckles are not measured, yet the crawl and the "hand plants on the threshold" beat are weight-bearing on the hands.
  4. Roof clearance is measured only at the root column, not at the head or raised arms.
  5. **The report stops at t=15.8** (`beats` ends at 15.8, cinematic.mjs:23). It never covers 15.8–17.0 or the hand-off in `finish()`. That is exactly where C1 lives.
  6. `visible` means `root.visible`, not "on screen".

### Defects

| ID | Sev | Location | Finding / reproduction | Remedy |
|---|---|---|---|---|
| **C1** | **C** (probable; I could not run it) | src/yeti/spawn.ts:19-21; src/cinematic/CaveCinematic.ts:155-162, 179-195, 263-272 | **The leap overshoots, and the hand-off may teleport.** `leap` = horizontal dist/1.0 s (≈33 m/s) with vy=6.5, which ignores the ≈11 m drop from the ledge to the slope. The report shows the root still **11.2 m above the terrain at t=15.83**, 1.23 s into a nominally 1.0 s flight, after 36 m of horizontal travel. The report's own numbers (vy≈-5.6 m/s; terrain falling ≈3.2 m/s along the path) put touchdown at **t≈17.1 s**, after `tl.done` at 17.0. In that case `finish()` takes the `!leap.landed` branch: `yetiAI.place()` at the **ledge**, then a second leap. That is a teleport of about 40–75 m back to the cave, against "no teleports". Even if he lands just before 17.0, the landing is about 2× past the intended target (centre of the piste +18 m). | (a) Solve the leap for the target: pick T≈1.1 s, `vy = (y_target − y_ledge + 4.905·T²)/T`, horizontal = dist/T. (b) In `finish()`, if the Yeti is still airborne, hand the current pos/vel to `yetiAI` (airborne=true, vel, vy) instead of re-placing him at the ledge. (c) Extend `tools/cinematic.mjs` to sample until phase ≠ caveCinematic plus 1 s, and assert per-frame displacement ≤ \|v\|·dt + 0.1 m. |
| **C2** | **M** | CaveCinematic.ts:203-208 vs 126-130 | **0.6 m pop at t=6.2.** The crawl lerps to `GRIP_AT + 0.6`, then `tl.at(6.2)` calls `placeAt(GRIP_AT)`. The report shows a 0.60 m root jump between t=6.20 and 6.23 (the crawl speed is about 0.07 m/frame). This is on-camera in the eyes shot (3.8–6.6), whose look target is `yetiRoot()`, so the camera also jerks. It also exceeds YetiModel's `moved > 0.5` snap threshold (YetiModel.ts:229), which resets the foot locks. | Crawl to exactly `GRIP_AT` (drop the `+0.6`), and in the 6.2 cue only set the mode. Alternatively, ease the last 0.6 m over 6.2–6.6 with matching anim speed. Add a "max per-frame root step" assertion to the report summary. |
| C3 | M | tools/cinematic.mjs:23, 44-49 | The grounding report omits 15.8–17.0 and the hand-off, and measures neither hands nor head clearance (see the weaknesses above). Its headline "0 cm penetration" overstates what is checked. | Add beat 17.0 plus a 1 s tail. Add hand probes (`getHandWorldPosition` vs floor) for crawl/grip, head-top roof clearance, and a max root step per frame. |
| C4 | m | cine_t3_8.png | Beat 3 ("a huge shadow moves in the darkness") shows the Yeti fully lit and readable at the mouth. The shadow-then-eyes reveal is lost. Shade at s≈6.4 should be about 0.13, so the sky fill or fur shading apparently overrides it. | Clamp the fur shader's ambient to `shade`, or keep the Yeti at s>8 until 5.4. |
| C5 | m | cine_t0_1.png | A stale caption "[a deep growl, much closer]" from gameplay is still visible at cinematic t=0.1. | Clear the caption in the t=0 cue. |
| C6 | m | cine_t9_5.png | In the "rises to full height" low angle, the feet and hand touch the bottom letterbox, so the grounding is cropped exactly where it should be seen. | Raise the camera's look point about 0.3 m, or move the camera back about 1 m. |
| C7 | m | cine_t14_6.png, CaveCinematic.ts:89-92 | The comment says the leap is "seen past the skier's shoulder", but the skier is not in frame. | Offset `leapCam` so the skier's shoulder is in frame left. |
| C8 | m | cine_t15_8.png | Because of the overshoot (C1), the airborne Yeti appears spread-eagled above the cave block. It reads as though he is on the slope above the roof, not leaping from the mouth. C1's fix resolves this. | See C1. |
| C9 | m | cine_t3_8.png, cine_t5_4.png, cine_t6_6.png | A small bright white blob sits at floor level between the hands (and at the left in 6.6). I could not identify it (eye-glow light? particle?). | Identify the source and drop it, or tint it. |

---

## P3: menu and UX

### What is good
- **The title clip is fixed.** The old menu read "SKIFRI" at 1920×900 (before/menu_1920x900.png). The new hero title is outside the panel and intact at all four sizes.
- At 1366×768, 1920×900, 1920×1080 and 2560×1440 there is no scrolling and no overflow. Start is prominent (orange primary row). Mountain and Length sit directly under Start.
- Keyboard, mouse and gamepad navigation are implemented (Input.ts:280-320). D-pad and stick share one auto-repeat (0.35 s, then 0.12 s). Keystrokes in text fields are ignored by the game input (Input.ts:138-139).
- `highlight()` scrolls the focused row into view only when the panel actually overflows (Menu.ts:259).
- **HUD:** Endless shows distance travelled and "REFUGE IN …" and hides the progress bar. `fmtDistance` switches m → 0.1 km → km.
- **Pause** shows the course label and code, and offers "Retire & bank" (with the banked points) on Endless only. **Results** show the course code and seed, plus a banked/refuge result line.

### Defects

| ID | Sev | Location | Finding / reproduction | Remedy |
|---|---|---|---|---|
| **E1** | **M** | App.ts:315-319 with App.ts:221 and Menu.ts:211-217 | **An invalid course code fails silently.** Type `FOO`, then press Enter. The error goes to `hud.caption()`, but the HUD is hidden in the menu (`hud.show(false)` in `toMenu`), so nothing is shown. The blur handler's `refresh()` then resets the field to `get()` = '', which wipes what the user typed. | Show the error inline (a `note`/`small` under the row, or a red border with `aria-invalid`), and keep the typed text. Add an e2e test for an invalid code. |
| **E2** | **M** | Menu.ts:211-217, App.ts:236-239 | **Typing a code and then clicking Start loses the click.** Mousedown on Start blurs the input. The blur commits the code, which calls `changed()` → `menu.replace()` → `render()`, and that rebuilds every row. Mouseup lands on the new Start element, so `click` fires on the common ancestor and Start does nothing. (This is inferred from the DOM event model; I did not run it.) | Commit on blur without re-rendering (update the rows in place via `refresh()`), or defer `replace()` with `requestAnimationFrame` / `setTimeout(0)`. Add an e2e test: fill the code, click Start, expect the run to begin. |
| **E3** | **M** | styles.css:164; App.ts:267-276; tests/e2e/menu.spec.ts:57-66 | **The Yeti row was added after the fit evidence was captured.** From e2e_menu_1366x768.png (custom mode) the content is about 605 px tall and the row pitch is about 45 px. The root padding is `clamp(16px, 4%, 56px)`, and **% resolves against the width**, so 4% of 1366 = 55 px top and bottom, which leaves about 659 px. With the Yeti row the content is about 650 px, so the **headroom is about 8 px or less** in Custom and Daily (each adds a two-line row). A panel scroll at 1366×768 is likely, and it is unproven either way. | Use vertical units for the vertical padding (`padding: clamp(12px, 3vh, 48px) 6vw`). Optionally put Length and Yeti side by side or tighten `.main .menu-row` padding. **Re-run the four layout tests** and re-capture the screenshots. |
| **E4** | **M** | tests/e2e/menu.spec.ts:19-27, 84-90 | **The UI-scale 150% case is probably not tested.** The second `boot(page, {uiScale: 1.5})` adds a second init script, but the first one (settings `{}`) is still registered. Playwright does not define the order of multiple init scripts. If the first runs first, it sets `booted` and the uiScale script is skipped, so the test runs at scale 1.0. | Use a fresh `context`/`page` for the UI-scale case, or have the init script read the settings from `window.name`/URL. Assert `getComputedStyle(document.documentElement).getPropertyValue('--ui-scale') === '1.5'`. |
| E5 | M (process) | menu.spec.ts:129-141 | The course-code test was changed to `focus()` + `fill()` but **has not been re-run**. Also, `fill()` dispatches no keydown events, so the claim "typing never triggers game/menu shortcuts (S, D, Space…)" is not exercised. | Use `input.pressSequentially('seed-777-end')` (real key events, including S and D), then assert the focused row and course mode did not change. Re-run all 7 tests and attach the output. |
| E6 | m | Menu.ts:298-302, 324 | A gamepad user can focus the code/seed field but cannot type: there is no on-screen keyboard, so A/B only blur. | Either document "keyboard only" in the row note, or add a simple character picker for the pad. |
| E7 | m | App.ts:312; styles.css:187; menu_1366x768.png, menu_1920x900.png | The placeholder is the hard-coded date `DAILY-2026-11-07-STD`, which goes stale. It renders at alpha 0.38 and is nearly illegible in the screenshots. At 1920×900 it is truncated by the 190 px input. | Build it from `utcDate()`. Raise the contrast to about 0.6. Use a shorter example such as `CLASSIC-STD`. |
| E8 | m | App.ts:241 | The Start hint shows only the length ("Standard · 10 km"), not the mountain or Yeti difficulty. A player can start a Daily/Hard run believing it is Classic. | Use the hint `${courseLabel(c)} · ${DIFFICULTY[st.difficulty].label}`. |
| E9 | m | App.ts:386-392 | "Retire & bank" ends an Endless run at once, with no confirmation, and sits directly under Resume. | Add a confirm step (press A again, or a hold) or move the button below Restart. |
| E10 | m | menu_2560x1440.png; styles.css:174-176 | At 2560×1440 the menu text is about 13–15 px (the clamps cap the size), so it reads small on a large screen. The UI-scale slider is the only remedy. | Raise the clamp maxima, or default `uiScale` from `devicePixelRatio` and viewport height. |
| E11 | m | src/ui/Hud.ts:32-37 | `fmtDistance(999.6)` gives "1000 m". | Round first, then pick the unit. |

---

## Could not verify
- Any runtime behaviour, including the C1 landing time, the E2 click loss and the E3 fit. These are inferred from code and the report numbers; I did not run them.
- 15.8–17.0 s of the cinematic and the hand-off to the chase (not in the evidence).
- Whether the shots at 12.3–13.7 s (face close-up) and the follow swing at 15.8–17.0 clip the rock.
- Hand/knuckle contact with the floor during the crawl and grip, beyond what frames 3.8, 5.4 and 6.6 show visually (they look planted).
- Whether `mountain.heightAt` matches the rendered terrain triangulation on the ledge, outside the floor mesh.
- Menu behaviour at browser zoom other than the emulated 1536×864 case, and a real gamepad (only the injected pad).
- The pause and results screens at 1366×768 (CSS has a ≤760 px compact rule; no screenshot).

## Required to pass
C1, C2 and C3 for the cinematic, with a re-captured report that covers t≥17 s plus the hand-off. E1–E5 for the menu, with all 7 menu tests re-run and green and the screenshots re-captured with the Yeti row.

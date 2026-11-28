# Whiteout Ridge: structured human playtest (owner ruling 3, round 6)

This kit is for the owner, or someone the owner appoints, to run with 6–8 real players. Claude can't recruit players, observe a live session or hear the audio. So no session is reported as run until the owner returns the completed sheets.

The six model reviews remain one input. This playtest is the evidence for overall experience (category 8) that they cannot supply.

## 1. Build under test
- **Build:** the frozen round-6 candidate SHA, recorded in `docs/reviews/biomes/whiteout/round-6/CANDIDATE.md` once it is frozen. Use the production build:
  - `npm ci && npm run build && npx vite preview --port 4471`;
  - or a private static host serving `dist/`.
- **Check the build first:** `dist/build-info.json` names the commit (`gitHead`) and a hash of the sources (`srcHash`). Write both on every session sheet, so each finding is tied to the build that was played.
- **Hardware:** a real GPU, not software rendering. Note each machine (CPU, GPU, display resolution and refresh rate, browser and version, input device).
- **Audio:** on, through headphones or speakers the player chooses. Note the volume setting.
- **Saves:** start every session from a clean profile (a fresh browser profile or private window), so earlier players' cinematic history and unlocks do not carry over. Keep the players' own saves untouched if they use their own machine.

## 2. Participants (6–8)

| Slot | Experience | Input | Notes |
|---|---|---|---|
| P1 | Novice (rarely plays action games) | Keyboard | |
| P2 | Novice | Controller | |
| P3 | Intermediate (plays casually) | Keyboard | |
| P4 | Intermediate | Controller | |
| P5 | Intermediate | Keyboard | Optional: UI scale 150% or Reduce Camera Motion, if the player normally uses such settings |
| P6 | Experienced (plays racing or skill games regularly) | Controller | |
| P7 | Experienced | Keyboard | |
| P8 | Any, optional | Either | Someone who has played the original SkiFree, if available |

- **Exclusions:** anyone who has worked on the game, read its review documents or seen earlier sessions.
- **Ordering:** at least two players should be on each input device at each experience level where possible.

## 3. Consent (read aloud, then signed or recorded verbally)

> We are testing a ski game that is still being developed. We are testing the game, not you; there are no wrong answers and you can stop at any time without giving a reason. The session takes about 45 minutes.
>
> With your permission we would like to:
> (a) record the screen and game audio;
> (b) record your voice while you think aloud;
> (c) save a log of the game's events (your speed, crashes, the gap to the pursuer, settings), which contains no personal information.
>
> You can agree to any, all or none of these. Recordings are kept only by the project owner, used only to improve the game, not published, and deleted within 90 days. You may ask for your data to be deleted at any time.

Record which of (a), (b) and (c) the participant agreed to. **Do not record anything a participant did not agree to.**

Store a participant's name only on the consent form, separately from the session sheet. Session sheets use P1–P8.

## 4. Facilitator rules (no coaching)
- **Before the session:** do not explain the controls, the weather, the Yeti or the location's design, beyond what the game itself shows. Say only: "Please think aloud: say what you're noticing, what you expect, and what surprises you."
- **During the session, do not:**
  - tell the player where to look or what something is;
  - say whether they did well;
  - name the hazards ("the cornice", "the drift rows", "the ridge drop") before the player does.
- **If they're stuck:**
  - The only allowed prompts are "What are you trying to do?", "What do you think is happening?" and "What would you try next?"
  - If a player is stuck for 2 minutes on a menu or control, you may say "You can look at the controls screen in the menu." Record that you did.
- **No outside guidance:** the developer and the AI reviewers do not run, script or coach sessions, and do not see a session's answers before the sheet is complete.
- **Questionnaire:** ask the questions exactly as written in section 6. Do not rephrase them toward an expected answer.

## 5. Tasks (in order; record time, outcome and observations for each)

| # | Task (what you say) | What to observe |
|---|---|---|
| T1 | "Please start a Whiteout Ridge course on Normal." No further help. | Can they find the location, difficulty and start? Time to the first run. Do they find the controls? |
| T2 | During the first run, when the weather starts to change: "What do you think is going to happen next?" | Do they name a coming storm, blizzard or wind? Do they use the sky, sound, captions or HUD? Were they right? |
| T3 | When a drift row (snow barrier with gaps) is ahead and in view: "What are you going to do here?" Then let them do it. | Do they see the gap and the flags? Do they choose it on purpose? Do they make it? Do they understand a miss? |
| T4 | Survive the cave and the start of the chase. Give no prompt before the cave. | Is the cinematic understood? Do they know when they have control again? Do they see the pursuer in the rear view? Survived? Did the camera confuse them? |
| T5 | Recover from a mistake: a natural crash or knock, or ask once "Try taking a turn wider than you need to." | After the mistake, do they understand the pursuer is closer? Do they believe they can win the gap back? Do they? |
| T6 | After at least two Normal runs: "Now please try Hard." | Do they understand what is different (weather, hazards, terrain, pursuit)? Fairness and frustration. |
| T7 | Watch the rescue-station ending (on a win; use a Normal win if they did not win). | Do they understand what happens and who is who? Any confusion or awe? Did they skip? |

**Free play:** 5 minutes at the end, any location or difficulty, if time allows. Note what they choose.

**Accessibility (P5, or any player who uses these normally):** UI scale 150%, Reduce Camera Motion, Reduce Weather Effects, Reduce Flashes, captions, and vibration (controller). Note anything unreadable, covered or uncomfortable.

## 6. Questionnaire (after the tasks; 1 = strongly disagree, 7 = strongly agree)

Ask each statement as written, then "Why?", and write down the answer word for word.

1. When I lost or nearly lost, it was because of something I could have done differently. *(fairness)*
2. I felt frustrated by things I couldn't control. *(frustration, reverse-scored)*
3. I could tell what the weather was about to do. *(weather comprehension)*
4. I could see where it was safe to ski and where it was dangerous. *(hazard readability, including the drop side)*
5. The camera showed me what I needed to see. *(camera clarity)*
6. I felt chased for most of the run, not just at one moment. *(pursuit tension)*
7. When I made a mistake, I felt I could recover from it. *(recovery)*
8. Hard felt different from Normal in a way I understood. *(difficulty honesty)*
9. The ending was satisfying. *(cinematic)*
10. I enjoyed playing. *(enjoyment)*
11. I would play this location again. *(retention)*

**Open questions:**
- What was the most memorable moment?
- What was the most confusing moment?
- If you could change one thing, what would it be?
- How would you describe this place to a friend?

## 7. Session sheet (one per participant)
- **Who and what:** participant P_, experience, input, settings changed, machine, build `gitHead` and `srcHash`, date, facilitator.
- **Consent:** (a), (b) and (c), each yes or no.
- **Tasks T1–T7:** time, outcome (done, done with a prompt, or not done), quotes, observations, and any prompt given.
- **Runs:** difficulty, length, outcome, distance, crashes; a short note on the moment the Yeti came closest.
- **Bugs:** what happened, roughly when, and whether a recording exists.
- **Questionnaire:** the scores and the "why" answers.

## 8. Analysis (by the owner or someone independent of the developer)
- **Per task:** the success rate and the time taken, split by experience and input.
- **Per questionnaire item:** the median and range, split by experience and input. Report every individual answer, not only the medians; the sample is too small for statistics.
- **Grouping:** group the open answers and observations into issues. Count how many players hit each, and note its severity:
  - blocks progress;
  - causes real frustration;
  - minor.
- **Comparison with the simulator:** set observed chase outcomes (caught or escaped, where the Yeti came closest) beside the simulator's predictions for the same difficulty. Flag where they disagree.
- **Output:** a short report, `docs/playtest/RESULTS_<date>.md`, with session sheets attached (no names). The reviewers, F especially, read it before scoring. Anyone the owner chooses may write the summary; the raw sheets stay authoritative.

## 9. Logs (only for participants who agreed to (c))
- **Turning it on:** open the game with `?playtest` added to the address, for example `http://127.0.0.1:4471/?playtest`. A red "Playtest log on" tag stays in the bottom-left corner while it records. Without `?playtest` nothing is recorded.
- **What it records:** gameplay events (crashes, jumps, drifts, snowballs, encounters, escapes, run results), a once-a-second sample (phase, distance down the course, speed, the Yeti's distance, crash count), the settings at each run start, and the build (`build-info.json`).
  - No names, no typed text, no device details.
  - It is held in the page's memory only and sent nowhere.
- **Downloading:** at the end of the session, press **Ctrl+Shift+L** to download `playtest_<time>.json`. Rename it `P<n>.json`. Reloading the page discards the log.
- **Naming:** recordings and logs are named P1–P8, not by the participant's name.

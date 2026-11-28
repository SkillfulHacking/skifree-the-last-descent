# W-065 / W-093 round-4 art iterations (dev, not the frozen build)

Fresh, isolated blind readers were given only the frame and asked neutral questions (no description of
what the frame should show).

| Frame | Change | Blind read | Readability |
|---|---|---|---|
| iter_a_dark_floor.png | near-continuous dark rim rock band; very dark valley floor | "most like open water"; drop "fairly high" confidence; centre haze column "looks like a glitch"; skier hidden by a white glow | 4/10 |
| iter_b_cloud_floor_toolfix.png | floor lightened, ridged texture, aerial perspective to the horizon; capture-tool fix | "sea of clouds… which would mean we are high up", ~50%; "the drop on the left is implied rather than shown"; centre fog wall still the most confusing element | 5/10 |

Finding: the white puff over the skier in every round-3/round-4 rim capture was an artefact of
`tools/rim_view.mjs` (90 scripted frames piled the run's spray into one cloud). Hiding the particle layer
removed it; the live-play evidence frames never show it. The tool now clears particles and runs a second
of ordinary skiing before the frame. Commit `71c9ceb` leaves the game's spray as it was; the earlier round-4 commit
`3ba0d83` had already lowered the landing burst and thinned the spray (correction after review F4-6).

Status: W-065 still FAILS the "immediately recognisable" bar. Open: the pale vertical sheet at the vanishing
point (a blizzard cell's telegraph curtain, which a first-time reader takes for a rendering fault), no visible
rim edge or cliff face from the line, and the fog preset hides the drop entirely.

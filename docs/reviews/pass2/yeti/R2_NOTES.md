# Yeti round-2 progress notes

(Working notes; survive environment restarts. Newest at the bottom.)

## State at pick-up (79a843e)
- WIP already in: shared `uShade` uniform injected into skin/shell/cards/hard/eyes (setShade → k²), warm fur palette,
  shell undercoat capped (uShellMax 3.5 cm), lock cards 19000 @high (4 segs, LOCK_VARIANTS=8 atlas), HEAD_SCALE 1.3 +
  HEAD_LIFT, furred backs of hands/feet, gallop stretched, crawl hind legs under the body, leap pounce pose.
- tsc clean, vitest 107/107 at pick-up.
- Round-1 high tris (preview overlay, incl. shadow pass): 832,212. r2_face_front (WIP) overlay: 817,427.
- Tooling: /tmp/y2/shots.mjs (copy of previous engineer's /tmp/yshot/shots.mjs), vite no-HMR on :5334
  (`npx vite --config /tmp/y2/vcfg/vite.nohmr.mjs --port 5334 --strictPort`), `YPORT=5334 node /tmp/y2/shots.mjs W H outdir name=query ...`

## Session 2 (21:00)
- FOUND: the blue/dark "screen-door" speckle over the fur (A15 dithering, and the speckle that stayed in the dark at
  setShade(0)) is the A2C fur writing fractional alpha into the drawing buffer; headless Chrome composites the canvas
  over the page background (#8fc3ea in preview, #0b1624 in game). Fix: shells+cards draw with colorMask(rgb, no alpha)
  (YetiModel onBeforeRender/onAfterRender). shade=0 crop now exactly (0,0,0) (was max (84,114,135)).
- Main-pass tris at pick-up: 722,423 (body 61.5k, shells 501k (9×55.7k), cards 153.7k, hard 4.7k, eyes 1.5k).
- preview: added hide=<mesh names> to isolate layers.
- Shell lattice stretched along the comb direction (body down/back, head sweeps back): directional dashes.
  Shell root AO 0.6..1. Belly/hips/thigh card weights raised (hips .6, spine1 .55, spine2 .75, thigh .7, chest cut 15%).
- HEAD_SCALE 1.3 → 1.42.
- Gallop: hips pitch .8, lower hips, hands land 1.6 m ahead with a low (×0.75) recovery, feet 0.42 m back. Extended
  phase (t=1.25) reads clearly; collected phase (t=1.07) is still compact but limbs separate.
- 22:xx session 3: verification renders at 960x540 in /tmp/y2/v (main 723,017; overlay 818,021)
- crawl (3/4, front, back, top) checked: head on travel line, hind legs under the body -> A19 OK as-is. dark shade .15: body near-black + glowing eyes -> A9/C4 OK.
- A16: HEAD_SCALE 1.42->1.55, HEAD_LIFT (0,.1,.04)->(0,.14,.05): visible neck in side view, roar head ~85px vs ~230 shoulders @960. (/tmp/y2/v/mont4.png)
- preview: face cams back off ×1.22 (fdist=) for the bigger head. tsc clean, vitest 107/107 after A16 change. Next: final 1920 evidence.
- 1920 evidence: face_front, face_34, body_front, body_side written (22:01). Remaining run via /tmp/y2/final.sh -> /tmp/y2/final.log
- all 11 r2_*.png written at 1920 (faces with fdist 1.6, now preview default). groundReport seq: worstPenetration 0 cm, worstPlantedFloat 0 cm, steps 12. main tris 723,017 (overlay 818,021).
- final: tsc clean, vitest rerun (see report). Session 3 done.

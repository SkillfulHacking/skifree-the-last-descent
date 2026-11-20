# Storm horizon probe (round 3, W-064 / R2 A N1)

`tools/storm_horizon_probe.mjs`: the production build (SwiftShader), seed WO-R2, Normal Sprint, the strongest storm of the
first 300 s, the skier at z 900, gameplay camera, HUD off, 960×540. Mean displayed sRGB of screen regions (PIL):

| Frame | Sky above the horizon (600–680, 270–285) | Fogged bank below it (600–680, 300–315) |
|---|---|---|
| `horizon_before.png` (dome = fog colour, opacity 0.94) | (186, 189, 192) | (189, 200, 214) |
| dome tint sweep (5 + 3 variants, not kept) | ×(1, 1.45, 1.95), opaque: (188, 202, 214) | (189, 200, 214) |
| `horizon_after.png` (the shipped tint, build `ee51f18`+) | (193, 206, 217) | (180, 192, 208) |

The after frame is a few frames later (the skier and the fog moved), so its bank differs a little; the step at the horizon
went from a hue/value step of ~22 in blue to under ~10. Software rendering, one seed and one moment: not proof for every
storm or GPU.

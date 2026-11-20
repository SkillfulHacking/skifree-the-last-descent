/**
 * Reduce Weather Effects (W-049, accessibility): one presentation scale every weather view reads.
 * 1 = full; REDUCED = the setting on. It thins the falling and blowing snow, the ground spindrift and
 * the drift plumes, lifts the storm fog part of the way and stills the snow's motion — and nothing
 * else: physics, hazards, the course and every hazard telegraph (drift mounds, blizzard walls, the
 * HUD weather pill, captions, sounds) are the same at any setting.
 */
export const weatherFx = { scale: 1 };
export const WEATHER_FX_REDUCED = 0.45;
/** fog: the share of the storm's extra density kept with the setting on */
export const WEATHER_FX_FOG_KEEP = 0.6;
/** blizzard walls and telegraphs never fade below this share of their full opacity */
export const WEATHER_FX_TELEGRAPH_FLOOR = 0.75;

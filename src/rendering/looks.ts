/* Per-chapter "looks": everything that sets a chapter's photographic identity, in one preset (in the spirit of an
   ENB preset). Lighting (sky, sun, atmosphere) and the post-processing grade live together so a chapter's mood
   is tuned in one place. Chapters 02–04 are prepared from the brief's lighting direction; their HDRIs and
   values are refined when those worlds are built.

   Grade terms, all neutral at their defaults:
   exposure (stops) · temperature/tint (-1…1, white balance before tone mapping) · contrast/saturation (1 = none)
   lift/gamma/gain (per-channel, ASC-CDL-like, after tone mapping) · shadows/highlights tint + balance (split toning) */
import type { ChapterId } from '../data/chapters';

export type RGB = [number, number, number];

export interface Look {
  sky: { hdri: string; envIntensity: number; backgroundIntensity: number; backgroundBlur: number };
  sun: { direction: [number, number, number]; color: string; intensity: number };
  /** height fog: density at ground level (per metre), thinning with altitude */
  fog: { color: string; density: number } | null;
  /** sun effects (0…1): lens flare when the sun is in view and unblocked; light rays (god rays) */
  sunFx?: { flare: number; rays: number };
  /** weather (0…1): rain streaks, surface wetness (darker, glossier, puddles), drifting cloud shadows */
  weather?: { rain: number; wetness: number; cloudShadows: number; lightning?: number };
  /** warm practical lights (lamps, bulbs) multiplier: 0 by day, 1 at night */
  practicals?: number;
  post: {
    exposure: number;
    toneMapping: 'aces' | 'agx' | 'neutral';
    temperature: number; tint: number;
    contrast: number; saturation: number;
    lift: RGB; gamma: RGB; gain: RGB;
    shadows: RGB; highlights: RGB; balance: number;
    ao: { radius: number; intensity: number; falloff: number };
    bloom: { intensity: number; threshold: number; smoothing: number; radius: number };
    vignette: { offset: number; darkness: number };
    grain: number;
    chromatic: number;
  };
}

const NEUTRAL3: RGB = [1, 1, 1];
const ZERO3: RGB = [0, 0, 0];
const OVERCAST = 'hdri/overcast_soil_puresky_1k.hdr';

export const LOOKS: Record<ChapterId, Look> = {
  // technical test range: clean and neutral, so controller tests aren't judged through a grade
  prototype: {
    sky: { hdri: OVERCAST, envIntensity: 0.9, backgroundIntensity: 1, backgroundBlur: 0 },
    sun: { direction: [0.45, 0.8, 0.35], color: '#fff4e6', intensity: 1.4 },
    fog: null,
    post: {
      exposure: 0, toneMapping: 'aces', temperature: 0, tint: 0, contrast: 1, saturation: 1,
      lift: ZERO3, gamma: NEUTRAL3, gain: NEUTRAL3, shadows: ZERO3, highlights: ZERO3, balance: 0,
      ao: { radius: 1.2, intensity: 2, falloff: 1 }, bloom: { intensity: 0.15, threshold: 0.9, smoothing: 0.2, radius: 0.6 },
      vignette: { offset: 0.35, darkness: 0.25 }, grain: 0, chromatic: 0,
    },
  },

  // 01 · Survival — a stormy night: heavy rain under a near-black overcast sky, cold faint moonlight, lightning
  // that lights the whole valley for an instant, and the few warm lights of the village (the oil lamp in house A,
  // bulbs on the utility poles) glowing in the rain and smeared across the wet ground. Dark, but readable.
  survival: {
    sky: { hdri: 'hdri/farmland_overcast_2k.hdr', envIntensity: 0.07, backgroundIntensity: 0.04, backgroundBlur: 0.04 },
    sun: { direction: [0.25, 0.9, -0.35], color: '#8ea3c9', intensity: 0.22 },
    fog: { color: '#10151c', density: 0.022 },
    sunFx: { flare: 0, rays: 0 },
    weather: { rain: 1, wetness: 1, cloudShadows: 0, lightning: 1 },
    practicals: 1,
    post: {
      exposure: 0.55, toneMapping: 'aces', temperature: -0.14, tint: 0.01, contrast: 1.12, saturation: 0.78,
      lift: [0.004, 0.008, 0.016], gamma: [1.0, 1.0, 1.02], gain: [0.98, 1.0, 1.03],
      shadows: [0.1, 0.18, 0.32], highlights: [1.0, 0.78, 0.5], balance: 0.1,
      ao: { radius: 1.4, intensity: 2.4, falloff: 0.7 }, bloom: { intensity: 0.55, threshold: 0.55, smoothing: 0.3, radius: 0.75 },
      vignette: { offset: 0.16, darkness: 0.78 }, grain: 0.05, chromatic: 0.0004,
    },
  },

  // overcast daytime rain is kept as a variant (?weather=rain)
  // 02 · The Shadows — moonlight: cold, low key, deep but readable shadows, warm pools of lantern light.
  shadows: {
    sky: { hdri: OVERCAST, envIntensity: 0.18, backgroundIntensity: 0.08, backgroundBlur: 0.1 },
    sun: { direction: [-0.4, 0.75, -0.3], color: '#9fb6dc', intensity: 0.35 },
    fog: { color: '#1f2733', density: 0.03 },
    post: {
      exposure: -0.2, toneMapping: 'aces', temperature: -0.22, tint: 0.02, contrast: 1.2, saturation: 0.62,
      lift: [0.0, 0.006, 0.014], gamma: [0.98, 1.0, 1.04], gain: [0.96, 1.0, 1.06],
      shadows: [0.1, 0.22, 0.34], highlights: [1.0, 0.72, 0.45], balance: 0.15,
      ao: { radius: 1.6, intensity: 3, falloff: 0.8 }, bloom: { intensity: 0.55, threshold: 0.6, smoothing: 0.3, radius: 0.75 },
      vignette: { offset: 0.25, darkness: 0.6 }, grain: 0.06, chromatic: 0.0008,
    },
  },

  // 03 · Rebirth — golden hour: low warm sun, long shadows, warm haze, lush but natural colour.
  rebirth: {
    sky: { hdri: OVERCAST, envIntensity: 0.9, backgroundIntensity: 1, backgroundBlur: 0 },
    sun: { direction: [0.8, 0.28, 0.35], color: '#ffc88a', intensity: 2.6 },
    fog: { color: '#e2c49c', density: 0.006 },
    sunFx: { flare: 1, rays: 1 },
    post: {
      exposure: 0.1, toneMapping: 'agx', temperature: 0.18, tint: -0.02, contrast: 1.08, saturation: 1.1,
      lift: [0.012, 0.008, 0.004], gamma: [1.0, 1.0, 0.98], gain: [1.04, 1.0, 0.94],
      shadows: [0.22, 0.24, 0.36], highlights: [1.0, 0.82, 0.55], balance: 0.05,
      ao: { radius: 2, intensity: 2.2, falloff: 0.9 }, bloom: { intensity: 0.45, threshold: 0.75, smoothing: 0.3, radius: 0.8 },
      vignette: { offset: 0.35, darkness: 0.3 }, grain: 0.025, chromatic: 0.0004,
    },
  },

  // 04 · The New Era — clean architectural light: neutral-cool, crisp contrast, glass reflections, city glow.
  'new-era': {
    sky: { hdri: OVERCAST, envIntensity: 1.2, backgroundIntensity: 1, backgroundBlur: 0 },
    sun: { direction: [0.3, 0.6, -0.5], color: '#eef3ff', intensity: 1.8 },
    fog: { color: '#a9b8c9', density: 0.004 },
    sunFx: { flare: 0.7, rays: 0.4 },
    post: {
      exposure: 0.05, toneMapping: 'agx', temperature: -0.08, tint: 0, contrast: 1.14, saturation: 1.0,
      lift: [0.0, 0.004, 0.01], gamma: [1, 1, 1], gain: [0.99, 1.0, 1.03],
      shadows: [0.14, 0.22, 0.34], highlights: [1.0, 0.92, 0.8], balance: 0,
      ao: { radius: 2.4, intensity: 2, falloff: 1 }, bloom: { intensity: 0.6, threshold: 0.8, smoothing: 0.2, radius: 0.7 },
      vignette: { offset: 0.4, darkness: 0.25 }, grain: 0.015, chromatic: 0.0006,
    },
  },
};

/** alternative weather presets, chosen with ?weather=… */
export const WEATHER_VARIANTS: Partial<Record<ChapterId, Record<string, Look>>> = {
  survival: {
    rain: {
      sky: { hdri: 'hdri/farmland_overcast_2k.hdr', envIntensity: 0.95, backgroundIntensity: 0.85, backgroundBlur: 0.03 },
      sun: { direction: [0.3, 0.92, 0.25], color: '#dfe4e6', intensity: 0.35 },
      fog: { color: '#8f9895', density: 0.016 },
      sunFx: { flare: 0, rays: 0 },
      weather: { rain: 1, wetness: 1, cloudShadows: 0 },
      post: {
        exposure: 0.12, toneMapping: 'agx', temperature: -0.05, tint: 0.02, contrast: 1.16, saturation: 0.86,
        lift: [0.008, 0.012, 0.012], gamma: [1.0, 1.0, 1.01], gain: [0.99, 1.0, 1.0],
        shadows: [0.16, 0.26, 0.28], highlights: [0.92, 0.92, 0.86], balance: -0.05,
        ao: { radius: 1.5, intensity: 2.8, falloff: 0.7 }, bloom: { intensity: 0.18, threshold: 0.9, smoothing: 0.25, radius: 0.6 },
        vignette: { offset: 0.12, darkness: 0.9 }, grain: 0.035, chromatic: 0.0003,
      },
    },
  // 01 · Survival (alternative weather, ?weather=sunny) — a hot, bright tropical afternoon with scattered cumulus: strong sun and crisp shadows, warm
  // earth, humid light-blue distance haze (thin). Honest and grounded rather than glossy: colour held natural.
  // The sun direction matches the sun in the sky HDRI (measured from the image: ~48° up).
    sunny: {
    sky: { hdri: 'hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr', envIntensity: 0.8, backgroundIntensity: 1, backgroundBlur: 0 },
    sun: { direction: [0.558, 0.742, 0.373], color: '#fff1dc', intensity: 3.4 },
    fog: { color: '#b9cbdc', density: 0.0032 },
    sunFx: { flare: 1, rays: 0.7 },
    weather: { rain: 0, wetness: 0, cloudShadows: 0.75 },
    post: {
      exposure: -0.45, toneMapping: 'aces', temperature: 0.03, tint: 0.0, contrast: 1.05, saturation: 0.96,
      lift: [0, 0, 0], gamma: [1.0, 1.0, 1.0], gain: [1.02, 1.0, 0.98],
      shadows: [0.2, 0.28, 0.38], highlights: [1.0, 0.9, 0.74], balance: 0,
      ao: { radius: 1.4, intensity: 2.2, falloff: 0.7 }, bloom: { intensity: 0.12, threshold: 1.0, smoothing: 0.15, radius: 0.6 },
      vignette: { offset: 0.22, darkness: 0.62 }, grain: 0.025, chromatic: 0.0003,
    },
  },

  },
};

/** the Look for a chapter, honouring ?weather=sunny etc. */
export function lookFor(chapter: ChapterId): Look {
  const w = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('weather') : null;
  return (w && WEATHER_VARIANTS[chapter]?.[w]) || LOOKS[chapter];
}

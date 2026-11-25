/* Adaptive quality: the game's own dynamic resolution and settings, so it runs smoothly on whatever it is opened
   on (a base MacBook Air renders the village at the screen's 2× Retina density far slower than a desktop GPU).
   A ladder of budgets, each step trading the least visible thing for the most time:
     render scale → anti-aliasing (4× → 2× → none) → depth of field → AO sampling and shadow-map size → scale →
   (weakest devices only) no AO and half-density ground cover.
   - The starting step is a guess from the device: the GPU (WEBGL_debug_renderer_info), the screen density and
     whether it is a phone or tablet.
   - A governor (AdaptiveQuality, in the canvas) then watches the real frame time while the visitor plays: a step
     down after ~1.5 s averaging slower than ~45 fps, a step back up after ~8 s at a steady 60 fps. A step that
     was too slow twice is not tried again, so it never flip-flops. Nothing changes while the page is hidden.
   - `?quality=N` pins a step (0 = best) for testing; the governor then stays out of the way.
   The art direction (lighting, materials, colour grade, fog, rain) is the same on every step. */
import { useSyncExternalStore } from 'react';

export interface Budget { name: string; dpr: number; msaa: 0 | 2 | 4; dof: boolean; ao: 'low' | 'performance' | 'off'; shadow: 1024 | 2048; cover: 'full' | 'half' }

export const LADDER: Budget[] = [
  // measured on a base Apple M2 at a full-screen 1470×830 window (yard / sungka / road, ms per frame):
  { name: 'ultra', dpr: 2, msaa: 4, dof: true, ao: 'low', shadow: 2048, cover: 'full' },          // ~94
  { name: 'high', dpr: 1.5, msaa: 4, dof: true, ao: 'low', shadow: 2048, cover: 'full' },
  { name: 'balanced', dpr: 1.25, msaa: 2, dof: true, ao: 'low', shadow: 2048, cover: 'full' },    // ~45
  { name: 'smooth', dpr: 1, msaa: 2, dof: false, ao: 'low', shadow: 2048, cover: 'full' },        // ~33
  { name: 'fast', dpr: 1, msaa: 0, dof: false, ao: 'performance', shadow: 1024, cover: 'full' },  // ~29
  { name: 'faster', dpr: 0.8, msaa: 0, dof: false, ao: 'performance', shadow: 1024, cover: 'full' },  // ~23.5
  { name: 'lite', dpr: 0.75, msaa: 0, dof: false, ao: 'off', shadow: 1024, cover: 'half' },
];

/** a first guess from the device, before any frame has been timed */
export function guessStep(gpu: string): number {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
  if (mobile) return 5;
  if (/RTX|GTX 1[0-9]{3}|Radeon RX|Radeon Pro|Apple M\d (Pro|Max|Ultra)/i.test(gpu)) return 1;
  if (/Apple M\d|Apple GPU/i.test(gpu)) return 4;          // base M-series: ~30 ms at 1× full screen, far slower at 2× Retina
  return 4;                                                // integrated Intel / AMD and the unknown
}

const pinned = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('quality') : null;
let step = pinned !== null && !Number.isNaN(Number(pinned)) ? Math.max(0, Math.min(LADDER.length - 1, Number(pinned))) : -1;   // -1 = not chosen yet
const listeners = new Set<() => void>();
const failed = new Map<number, number>();                  // step → times it proved too slow

export const adaptive = {
  get pinned() { return pinned !== null; },
  get step() { return Math.max(0, step); },
  /** the first step, from the device (ignored when pinned or already chosen) */
  start(gpu: string) { if (step < 0) { step = guessStep(gpu); emit(); } },
  down() { if (step < LADDER.length - 1) { failed.set(step, (failed.get(step) ?? 0) + 1); step++; emit(); return true; } return false; },
  up() { const next = step - 1; if (next >= 0 && (failed.get(next) ?? 0) < 2) { step = next; emit(); return true; } return false; },
};
function emit() { listeners.forEach((l) => l()); }

export function useBudget(): Budget {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => LADDER[Math.max(0, step)], () => LADDER[1]);
}

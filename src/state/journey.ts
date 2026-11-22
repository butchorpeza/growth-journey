/* One tiny store shared by the HTML story and the 3D canvas (they are separate React roots).
   - `journey` (React state via useSyncExternalStore): the things the interface re-renders on: current chapter,
     navigator open, active service zone, active project, quality tier.
   - `progress` (a plain mutable object): the continuous scroll position in chapters (0 … 4.999). It changes every
     frame while scrolling, so the 3D scene reads it inside useFrame instead of re-rendering React. */
import { useSyncExternalStore } from 'react';

export type Quality = 'high' | 'low' | 'off';

export interface JourneyState {
  chapter: number;
  navOpen: boolean;
  zone: string | null;        // Chapter 03 service zone in focus
  project: string | null;     // Chapter 04 project in focus
  quality: Quality;           // 'off' = no WebGL, HTML only
  sceneReady: boolean;
}

export interface JourneyStateWithLoad extends JourneyState { loaded: number }

// the prerendered HTML is built from `initial`; hydration reads the same snapshot, then the live state takes over
const initial: JourneyStateWithLoad = { chapter: 0, navOpen: false, zone: null, project: null, quality: 'high', sceneReady: false, loaded: 0 };
let state: JourneyStateWithLoad = { ...initial };
const listeners = new Set<() => void>();

export const progress = { value: 0, velocity: 0 };
export const pointer = { x: 0, y: 0 };   // -1 … 1, for subtle camera parallax

export function getJourney(): JourneyStateWithLoad { return state; }

export function setJourney(patch: Partial<JourneyStateWithLoad>): void {
  let changed = false;
  for (const k in patch) {
    const key = k as keyof JourneyStateWithLoad;
    if (state[key] !== patch[key]) { changed = true; break; }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useJourney<T>(select: (s: JourneyStateWithLoad) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(initial));
}

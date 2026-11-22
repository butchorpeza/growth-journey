/* Shared maths for the 3D journey: where the camera is and what the air looks like for a given scroll progress.
   progress p: chapter i occupies [i, i+1). The first 80% of a chapter is the chapter's own camera move
   (from -> to); the last 20% is the flight to the next world, hidden inside a fog bank. */
import { Color, Vector3 } from 'three';
import { chapters, CHAPTER_COUNT, type Vec3 } from '../../data/chapters';

export const SETTLE = 0.8;

export const smoothstep = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
export const easeInOut = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

const add = (a: Vec3, b: Vec3, out: Vector3) => out.set(a[0] + b[0], a[1] + b[1], a[2] + b[2]);
const tmpA = new Vector3(), tmpB = new Vector3(), tmpC = new Vector3(), tmpD = new Vector3();

export interface Phase { i: number; j: number; local: number; blend: number; fogPulse: number }

/** which chapter(s) we are in and how far between them */
export function phaseAt(p: number): Phase {
  const i = Math.min(CHAPTER_COUNT - 1, Math.max(0, Math.floor(p)));
  const t = p - i;
  const last = i === CHAPTER_COUNT - 1;
  if (last || t < SETTLE) return { i, j: i, local: last ? t : t / SETTLE, blend: 0, fogPulse: 0 };
  const u = (t - SETTLE) / (1 - SETTLE);
  return { i, j: i + 1, local: 1, blend: smoothstep(u), fogPulse: Math.sin(Math.PI * Math.min(1, u)) };
}

/** camera position + look-at target for progress p (world space) */
export function cameraAt(p: number, outPos: Vector3, outTarget: Vector3): Phase {
  const ph = phaseAt(p);
  const a = chapters[ph.i], b = chapters[ph.j];
  const e = easeInOut(ph.local);
  // where chapter i's move is
  add(a.anchor, a.camera.from.position, tmpA); add(a.anchor, a.camera.to.position, tmpB);
  outPos.lerpVectors(tmpA, tmpB, e);
  add(a.anchor, a.camera.from.target, tmpC); add(a.anchor, a.camera.to.target, tmpD);
  outTarget.lerpVectors(tmpC, tmpD, e);
  if (ph.blend > 0) {
    // fly to the next chapter's opening shot
    add(b.anchor, b.camera.from.position, tmpA); add(b.anchor, b.camera.from.target, tmpC);
    outPos.lerp(tmpA, ph.blend);
    outTarget.lerp(tmpC, ph.blend);
  }
  return ph;
}

/* atmosphere colours, pre-parsed once */
const parsed = chapters.map((c) => ({
  skyTop: new Color(c.atmosphere.skyTop), skyHorizon: new Color(c.atmosphere.skyHorizon), fog: new Color(c.atmosphere.fog),
  sun: new Color(c.atmosphere.sun), fogDensity: c.atmosphere.fogDensity, sunIntensity: c.atmosphere.sunIntensity, ambient: c.atmosphere.ambient,
}));

export interface AirState { skyTop: Color; skyHorizon: Color; fog: Color; sun: Color; fogDensity: number; sunIntensity: number; ambient: number }

export function airAt(p: number, out: AirState): Phase {
  const ph = phaseAt(p);
  const a = parsed[ph.i], b = parsed[ph.j], k = ph.blend;
  out.skyTop.copy(a.skyTop).lerp(b.skyTop, k);
  out.skyHorizon.copy(a.skyHorizon).lerp(b.skyHorizon, k);
  out.fog.copy(a.fog).lerp(b.fog, k);
  out.sun.copy(a.sun).lerp(b.sun, k);
  out.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * k;
  out.ambient = a.ambient + (b.ambient - a.ambient) * k;
  // during the flight the air thickens so the old world dissolves and the new one appears out of the fog
  out.fogDensity = (a.fogDensity + (b.fogDensity - a.fogDensity) * k) * (1 + 14 * ph.fogPulse);
  return ph;
}

export const newAir = (): AirState => ({ skyTop: new Color(), skyHorizon: new Color(), fog: new Color(), sun: new Color(), fogDensity: 0.004, sunIntensity: 1, ambient: 1 });

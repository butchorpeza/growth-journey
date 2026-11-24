/* Chapter 01 layout data, written by scripts/blender/build_survival.py (all positions in three.js coordinates,
   metres, Y up) and copied to public/models/survival/layout.json by scripts/optimize-survival.mjs. */

export type Vec3 = [number, number, number];

export interface SurvivalLayout {
  /** oriented boxes: position, quaternion [x,y,z,w], half extents */
  colliders: { p: Vec3; q: [number, number, number, number]; h: Vec3; k: string }[];
  interactables: { id: string; label: string; verb: string; p: Vec3; r: number; narrativeId?: string; action?: string }[];
  doors: { id: string; node: string; hinge: Vec3; width: number; height: number; thickness: number; closedYaw: number; openYaw: number }[];
  /** variant name -> instances [x, y, z, yaw, scale] */
  foliage: Record<string, [number, number, number, number, number][]>;
  lights: { p: Vec3; color: string; intensity: number; distance: number }[];
  spawn: { p: Vec3; lookAt: Vec3 };
  exit: { p: Vec3; r: number; narrativeId: string };
  terrain: string;
}

export const SURVIVAL_BASE = `${import.meta.env.BASE_URL}models/survival`;

/** spawn as copied from layout.json (needed before the layout loads, so the player starts in the right place) */
export const SURVIVAL_SPAWN = { p: [-1.7, 0.14, 0.75] as Vec3, lookAt: [1.03, 1.2, 2.25] as Vec3 };

/** view yaw that looks from `from` towards `to` (yaw 0 looks down -Z) */
export const yawTowards = (from: Vec3, to: Vec3) => Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));

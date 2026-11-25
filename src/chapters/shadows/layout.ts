/* Chapter 02 · The Shadows: the shape of the island and where everything stands (metres; +z is south, towards the
   sea the visitor arrives from; the estate lies north, -z).
   01 the Entrance of Isolation: the shore meadow the portal throws the visitor onto, the iron gate, the avenue.
   02 the Forgotten Grounds: the courtyard before the house, round a dry fountain (Courtyard.tsx).
   03 the House of Memories: the hall, the living room, a dark side room, the long corridor, a bedroom (House.tsx).
   The pursuit runs in one straight line: east along the corridor, straight down the stairs in the east wing, and
   along a short brick tunnel that comes out of the cliff onto a rock ledge above the sea (Descent.tsx), where a
   gate slams behind the visitor. Walking out to the end of the ledge ends the chapter.
   The island's outline is one formula, used by the terrain (JS) and the ocean's shore foam (GLSL), so they agree. */
import type { RailWaypoint } from '../../player/rail';

export type Vec3 = [number, number, number];

/** an ellipse with a wobbling outline; rn(x, z) = 1 on the outline */
export const ISLAND = { cx: 0, cz: -12, rx: 42, rz: 70 };
export const WATER_Y = -1.6;

export function wobble(theta: number) {
  return 1 + 0.05 * Math.sin(3 * theta + 1.3) + 0.035 * Math.sin(7 * theta + 0.4) + 0.02 * Math.sin(13 * theta + 2.1);
}
/** the same, for the ocean shader */
export const WOBBLE_GLSL = /* glsl */ `
float islandRn(vec2 p) {
  vec2 q = vec2((p.x - ${ISLAND.cx.toFixed(1)}) / ${ISLAND.rx.toFixed(1)}, (p.y - (${ISLAND.cz.toFixed(1)})) / ${ISLAND.rz.toFixed(1)});
  float th = atan(q.y, q.x);
  return length(q) * (1.0 + 0.05 * sin(3.0 * th + 1.3) + 0.035 * sin(7.0 * th + 0.4) + 0.02 * sin(13.0 * th + 2.1));
}`;
export function islandRn(x: number, z: number) {
  const u = (x - ISLAND.cx) / ISLAND.rx, v = (z - ISLAND.cz) / ISLAND.rz;
  return Math.hypot(u, v) * wobble(Math.atan2(v, u));
}
/** a point on the outline at rn = k, angle theta (in the ellipse's normalised space) */
export function outlinePoint(k: number, theta: number): [number, number] {
  const r = k / wobble(theta);
  return [ISLAND.cx + Math.cos(theta) * r * ISLAND.rx, ISLAND.cz + Math.sin(theta) * r * ISLAND.rz];
}

/** the avenue: from the shore meadow through the gate and on up to the mansion steps */
export const AVENUE: [number, number][] = [[0.4, 40], [0, 34], [0.2, 27], [0, 22], [-0.7, 14], [0.9, 3], [0.2, -8], [-0.2, -17], [4.4, -23], [4.8, -31], [1.2, -38.5], [0, -44], [0, -52]];

/** distance (m, on the ground plane) from (x, z) to the avenue's centre line */
export function avenueDistance(x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i + 1 < AVENUE.length; i++) {
    const [ax, az] = AVENUE[i], [bx, bz] = AVENUE[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** the ground: a gently uneven meadow, flat along the avenue, rising to the mansion's terrace in the north and
 *  falling away in low cliffs to the sea all round */
export function groundHeight(x: number, z: number) {
  const rn = islandRn(x, z);
  const bumps = 0.22 * Math.sin(x * 0.31 + 1.7) * Math.sin(z * 0.27 + 0.4) + 0.14 * Math.sin(x * 0.83 - z * 0.61) + 0.07 * Math.sin(x * 2.1 + z * 1.7);
  const flat = smooth(1.4, 4.5, avenueDistance(x, z));
  const terrace = 1.1 * smooth(-30, -46, z);
  // under the house and its terrace the ground stays just below the terrace top (it must never show through a floor)
  const house = smooth(-48.5, -50.5, z) * (1 - smooth(26, 28, Math.abs(x)));
  const inland = ((bumps * flat + 0.12 * flat) * (1 - house) + terrace) * (1 - smooth(0.9, 1.0, rn));
  // over the passage and the steps down, the ground keeps clear of their ceilings
  const over = (x > -10.2 && x < -5.8 && z > -45.5 && z < -29.2) || (x > -10.2 && x < 10.2 && z > -48.2 && z < -43.8) ? 1.0 : -Infinity;
  return Math.max(Math.min(inland, 1.0 + 3 * (1 - house)), over) - 5 * smooth(0.97, 1.12, rn);
}

export const GATE = { z: 24, halfWidth: 2.25, pillar: 1.0 };
export const MANSION = { z: -62, y: 1.1 };

// ------------------------------------------------------------------------------------------- 02 · the courtyard
/** the dry fountain the avenue bends round, and the paved circle about it */
export const FOUNTAIN = { x: 0, z: -28, r: 3.0, paved: 10.5 };

// ---------------------------------------------------------------------------------------- 03 · the house inside
/** floor level inside the house (the terrace top); the front wall's outer face; the door opening */
export const FY = MANSION.y + 0.1;
export const HOUSE = {
  front: -56, back: -72.2, west: -16.2, east: 16.2,
  door: { x0: -1.25, x1: 1.25, h: 4.0 },
  hall: { x0: -6, x1: 6, z0: -56.35, z1: -66, h: 7.4 },
  living: { x0: -16, x1: -6, z0: -56.35, z1: -66, h: 4.2, door: [-62.6, -60.6] as [number, number] },
  side: { x0: 6, x1: 16, z0: -56.35, z1: -66, h: 4.2, door: [-63.2, -61.4] as [number, number] },
  corridor: { x0: -15.6, x1: 15.6, z0: -66, z1: -68.6, h: 3.4, hallDoor: [-1.1, 1.1] as [number, number] },
  bedroom: { x0: -15.6, x1: -6, z0: -68.6, z1: -72, h: 3.4, door: [-10.4, -9.0] as [number, number] },
  /** the stairs down, in the east wing: from the corridor's end at x0 to the landing at x1, dropping `drop` */
  stairs: { x0: 15.6, x1: 22.2, z0: -66, z1: -68.6, drop: 2.6, landing: 24.8 },
};

// ------------------------------------------------------------------------- 04 · the way down and out (straight on)
/** floor of the tunnel at the foot of the stairs, level all the way out to the ledge (just above the sea) */
export const PASSAGE_Y = FY - HOUSE.stairs.drop;
/** the tunnel: straight on east from the foot of the stairs to its mouth in the cliff */
export const TUNNEL = { x0: HOUSE.stairs.x1, x1: 27.4, z0: -68.6, z1: -66, h: 2.6 };
/** the iron gate across the tunnel's mouth (it slams behind the visitor), and the line past it that ends the chase */
export const ESCAPE_GATE = { x: TUNNEL.x1 - 0.4, z: -67.3 };
export const ESCAPE = { x: TUNNEL.x1 + 0.8, z: -67.3 };
/** the rock ledge outside, just above the sea; its far end (`end`) ends the chapter */
export const SHELF = { x0: TUNNEL.x1, x1: 37.5, z0: -72.5, z1: -62, y: PASSAGE_Y, end: 35 };

/** the pursuit's route (x, y, z): one straight line, from the corridor's far west end to the gate */
export const CHASE_ROUTE: Vec3[] = [
  [-14.8, FY, -67.3], [15.4, FY, -67.3], [HOUSE.stairs.x1, PASSAGE_Y, -67.3], [ESCAPE_GATE.x - 0.9, PASSAGE_Y, -67.3],
];

/** holes in the terrain (x0, x1, z0, z1) where the stairs go down through it */
export const TERRAIN_HOLES: [number, number, number, number][] = [[15.2, 31.5, -69.6, -65.0], [26.6, 31.5, -73.2, -61.4]];

export const SHADOWS_SPAWN = { p: [0, groundHeight(0, 34), 34] as Vec3, lookAt: [0, 1.9, GATE.z] as Vec3 };

/** scroll mode: from the shore meadow, through the gate, along the avenue, round the fountain, into the house
 *  (the hall), along the corridor to the stairs, down them and through the passage to the door */
export const SHADOWS_PATH: RailWaypoint[] = [
  { at: [0, 34], look: [0, 2.0, GATE.z] },
  { at: [0.2, 28.5], look: [0, 1.9, 20] },
  { at: [0.1, 24], look: [-0.5, 1.6, 12] },
  { at: [-0.6, 15], look: [1.2, 1.7, 2] },
  { at: [0.8, 4], look: [0.2, 2.2, -14] },
  { at: [0.2, -8], look: [0, 2.2, FOUNTAIN.z] },
  { at: [-0.1, -16.5], look: [FOUNTAIN.x, 1.4, FOUNTAIN.z] },
  { at: [4.4, -23], look: [FOUNTAIN.x, 1.2, FOUNTAIN.z] },
  { at: [4.9, -31], look: [-3, 1.6, -38] },
  { at: [1.2, -38.5], look: [0, 4.5, -56] },
  { at: [0, -46], look: [0, 3.2, -56] },
  { at: [0, -53.5], look: [0, FY + 1.8, -60] , floor: FY },
  { at: [0, -57.5], look: [-4, FY + 2.6, -64] , floor: FY },
  { at: [0, -62.5], look: [0, FY + 1.5, -67.3] , floor: FY },
  { at: [0, -67.3], look: [15, FY + 1.6, -67.3] , floor: FY },
  { at: [8, -67.3], look: [16, FY + 1.2, -67.3] , floor: FY },
  { at: [15.4, -67.3], look: [26, PASSAGE_Y + 1.4, -67.3], floor: FY },
  { at: [HOUSE.stairs.x1, -67.3], look: [32, PASSAGE_Y + 1.6, -67.3], floor: PASSAGE_Y },
  { at: [TUNNEL.x1 + 0.6, -67.3], look: [60, PASSAGE_Y + 2.2, -67.3], floor: PASSAGE_Y },
  { at: [SHELF.end + 0.6, -67.3], look: [90, PASSAGE_Y + 2.6, -67.3], floor: PASSAGE_Y },
];

/** old lamp posts along the avenue: [x, z, state] (on: a weak warm light; flicker: failing; off: dead) */
export const LAMPS: [number, number, 'on' | 'flicker' | 'off'][] = [
  [2.3, 30.5, 'on'], [-2.0, 20, 'flicker'], [2.1, 10, 'on'], [-2.0, 0, 'on'], [2.1, -12, 'off'], [-2.1, -26, 'on'], [2.1, -40, 'on'], [-2.1, -47, 'flicker'],
];

/** dead trees: [x, z, scale, variant, turn] */
export const TREES: [number, number, number, number, number][] = [
  [-6.5, 30, 1.1, 0, 0.3], [7.5, 28.5, 1.25, 1, 2.1], [-9.5, 17, 1.35, 2, 4.0], [10.5, 12, 1.0, 0, 1.2],
  [-12, 3, 1.2, 1, 5.1], [8.5, -6, 1.3, 2, 0.7], [-6, -17, 1.05, 0, 3.3], [14, -24, 1.4, 1, 2.6],
  [-16, -30, 1.25, 2, 1.9], [21, 30, 1.15, 0, 4.4], [-22, 20, 1.3, 1, 0.9], [-24, -8, 1.1, 2, 3.7], [24, 2, 1.2, 0, 5.6],
];

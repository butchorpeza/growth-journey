/* House A, the visitor's home: a provincial Filipino cottage built as real architecture on the original footprint
   (6 × 4.5 m, floor at 0.12 m, the same door hinge, window openings, interior, spawn and wall colliders). It replaces
   the original box walls and single-slope sheet roof (those meshes are hidden, see SurvivalChapter.prepare).
   - Foundation: a poured concrete plinth around the footprint, proud of the walls, with a pad under every post.
   - Frame: squared timber posts at every corner and beside every opening, a mid-height girt, a wall plate on top,
     tie beams across the room, king posts and a ridge beam: the post-and-beam structure of a bahay kubo.
   - Walls: a plastered hollow-block lower course (painted on the front) and woven bamboo (sawali) panels above, set
     back between the posts so the frame stands out.
   - Roof: a steep (35°) gable roof with deep eaves (0.8 m) and gable overhangs, rafters and purlins under a thick
     thatch of seven overlapping courses. Each course is cut into strips of random length and tilt, so the eave and
     every course edge is ragged like real nipa/cogon; a rounded ridge roll; one patch of rusty corrugated iron where
     the thatch was mended.
   - Openings: deep timber frames and sills, a pair of louvred painted shutters on every window, a corrugated "media
     agua" awning on brackets over each window, and a panelled door with strap hinges and a handle.
   Every piece is UV-mapped in metres (no stretching) with a random texture offset (no visible repeat), small random
   variations in size and angle, and merged per material: about a dozen draw calls in all. */
import {
  BoxGeometry, BufferGeometry, Euler, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3, type MeshStandardMaterialParameters,
  type Material, type Object3D, type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const HOUSE_SETS = ['thatch', 'bamboo', 'timber', 'block', 'concrete', 'iron', 'paint', 'aged'] as const;
type SetKey = (typeof HOUSE_SETS)[number];
type MatKey = SetKey | 'plaster' | 'door' | 'shutter' | 'metal';
type Mats = Record<MatKey, Material>;

/** the texture files for the house (diff, nor, rough per set), in the order createHouseMaterials expects */
export const houseTextureUrls = (base: string) => HOUSE_SETS.flatMap((k) => [`${base}/housea/${k}_diff.webp`, `${base}/housea/${k}_nor.webp`, `${base}/housea/${k}_rough.webp`]);

/** PBR materials from the house textures, plus the painted plaster already in the chapter (found by name) */
export function createHouseMaterials(textures: Texture[], ...roots: (Object3D | null)[]): Mats | null {
  let plaster: Material | undefined;
  for (const r of roots) r?.traverse((o) => { const m = (o as Mesh).material as Material | undefined; if (!plaster && m && !Array.isArray(m) && /painted_plaster/.test(m.name)) plaster = m; });
  if (!plaster) return null;
  const set = (k: SetKey, opts: MeshStandardMaterialParameters = {}) => {
    const i = HOUSE_SETS.indexOf(k) * 3, [map, normalMap, roughnessMap] = [textures[i], textures[i + 1], textures[i + 2]];
    for (const t of [map, normalMap, roughnessMap]) { t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 16; t.needsUpdate = true; }
    map.colorSpace = SRGBColorSpace;
    const m = new MeshStandardMaterial({ map, normalMap, roughnessMap, roughness: 1, metalness: 0, ...opts });
    m.name = `houseA_${k}`;
    return m;
  };
  const paint = set('paint');
  // painted timber: the wood's own grain under a faded coat (the scanned peeling-paint texture reads as bark at
  // the size of a door or a louvre)
  const timberTinted = (name: string, tint: number) => { const m = set('timber', { color: tint, roughness: 1 }); m.name = name; return m; };
  const door = timberTinted('houseA_door', 0x7d95a3), shutter = timberTinted('houseA_shutter', 0x8f7d69);
  return {
    thatch: set('thatch', { color: 0xd8cfc0 }),           // sun-bleached grey-gold nipa
    bamboo: set('bamboo'),
    timber: set('timber', { color: 0xb8a896 }),
    block: set('block'),
    concrete: set('concrete', { color: 0xc9c4bc }),
    iron: set('iron', { metalness: 0.35 }),
    paint, door, shutter, plaster,
    aged: agedPlaster(set('aged', { color: 0xc9d0c4 })),
    metal: set('iron', { metalness: 0.6, color: 0x55524e }),
  };
}

/** the front's lower course: aged, light grey-green cement plaster. On top of the scanned cracks and stains, a band
 *  of dirt and rain splash darkens and browns it towards the ground (up to ~0.55 m, broken up by noise, the way
 *  splashback really marks a wall), and the bottom edge is a little rougher. */
function agedPlaster(m: MeshStandardMaterial) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAgedWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvAgedWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vAgedWorld;
float agedN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    float along = vAgedWorld.x + vAgedWorld.z;
    float edge = 0.32 + 0.18 * agedN(vec2(along * 2.3, 0.0)) + 0.08 * agedN(vec2(along * 9.0, 3.0));   // ragged top of the splash band
    float dirt = smoothstep(edge, 0.12, vAgedWorld.y) * (0.65 + 0.35 * agedN(vAgedWorld.xy * 6.0 + vAgedWorld.zy * 6.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.56, 0.47), dirt);
  }`);
  };
  m.customProgramCacheKey = () => 'houseA_aged_v1';
  return m;
}

/** boxes per material, UV-mapped in metres with a random texture offset each, merged at the end */
class Builder {
  parts = new Map<MatKey, BufferGeometry[]>();
  private seed: number;
  constructor(seed = 11) { this.seed = seed; }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  /** a box: size [w, h, d], centre, Euler rotation, metres per texture repeat */
  box(mat: MatKey, size: [number, number, number], pos: [number, number, number] | Vector3, rot: [number, number, number] = [0, 0, 0], tile = 1.5) {
    const [w, h, d] = size;
    const g = new BoxGeometry(w, h, d);
    const uv = g.getAttribute('uv'), ou = this.rnd(), ov = this.rnd();
    const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile + ou, uv.getY(i) * dims[f][1] / tile + ov); }
    const p = pos instanceof Vector3 ? pos : new Vector3(...pos);
    g.applyMatrix4(new Matrix4().compose(p, new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(1, 1, 1)));
    (this.parts.get(mat) ?? this.parts.set(mat, []).get(mat)!).push(g);
  }
  /** a box placed with an explicit matrix (its basis columns are the box's x, y, z axes) */
  boxBasis(mat: MatKey, size: [number, number, number], m: Matrix4, tile = 1.5) {
    this.box(mat, size, [0, 0, 0], [0, 0, 0], tile);
    const list = this.parts.get(mat)!; list[list.length - 1].applyMatrix4(m);
  }
  build(mats: Mats, name: string) {
    const group = new Group(); group.name = name;
    this.parts.forEach((list, key) => {
      const geo = mergeGeometries(list, false); list.forEach((g) => g.dispose());
      geo.computeBoundingSphere();
      const mesh = new Mesh(geo, mats[key]); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = `${name}_${key}`;
      group.add(mesh);
    });
    return group;
  }
}

// -------------------------------------------------------------------------------------------------- the footprint
const X0 = -3, X1 = 3, Z0 = -2.25, Z1 = 2.25, FLOOR = 0.12;
const GIRT = 0.95, PLATE = 2.7, PLATE_TOP = 2.86;                 // lower course / bamboo / wall plate heights
const PITCH = (35 * Math.PI) / 180, EAVE = 0.8, GABLE_OVER = 0.5, THATCH = 0.42;
const RIDGE = PLATE_TOP + Z1 * Math.tan(PITCH);                   // roof underside at the ridge (z = 0)

type Opening = { a0: number; a1: number; y0: number; y1: number; kind: 'door' | 'window' };
interface Wall { axis: 'x' | 'z'; at: number; out: 1 | -1; from: number; to: number; openings: Opening[] }
const WALLS: Wall[] = [
  { axis: 'x', at: Z1, out: 1, from: X0, to: X1, openings: [
    { a0: -2.2, a1: -1.2, y0: 1.07, y1: 2.02, kind: 'window' }, { a0: 0.6, a1: 1.46, y0: FLOOR, y1: 2.14, kind: 'door' }] },
  { axis: 'x', at: Z0, out: -1, from: X0, to: X1, openings: [{ a0: -1.8, a1: -1.1, y0: 1.27, y1: 1.87, kind: 'window' }] },
  { axis: 'z', at: X1, out: 1, from: Z0, to: Z1, openings: [{ a0: -0.5, a1: 0.5, y0: 1.07, y1: 1.97, kind: 'window' }] },
  { axis: 'z', at: X0, out: -1, from: Z0, to: Z1, openings: [{ a0: -1.35, a1: -0.75, y0: 1.32, y1: 1.92, kind: 'window' }] },
];

/** the new house A: foundation, frame, walls, openings, roof (world coordinates) */
export function buildHouseA(mats: Mats) {
  const b = new Builder();
  const jit = (s: number) => (b.rnd() - 0.5) * s;

  // ---- foundation: a concrete plinth around the footprint, proud of the walls
  for (const w of WALLS) {
    const len = w.to - w.from + 0.36, mid = (w.from + w.to) / 2, n = w.at + w.out * 0.02;
    if (w.axis === 'x') b.box('concrete', [len, 0.34, 0.3], [mid, -0.05, n], [0, 0, 0], 1.2);
    else b.box('concrete', [0.3, 0.34, len], [n, -0.05, mid], [0, 0, 0], 1.2);
  }

  for (const w of WALLS) {
    /** a box in wall coordinates: along-wall a0…a1, height y0…y1, offset from the wall centre line, thickness */
    const put = (mat: MatKey, a0: number, a1: number, y0: number, y1: number, off: number, thick: number, tile = 1.5, tilt = 0) => {
      const len = a1 - a0, mid = (a0 + a1) / 2, cy = (y0 + y1) / 2, n = w.at + w.out * off;
      if (w.axis === 'x') b.box(mat, [len, y1 - y0, thick], [mid, cy, n], [w.out * tilt, 0, 0], tile);
      else b.box(mat, [thick, y1 - y0, len], [n, cy, mid], [0, 0, -w.out * tilt], tile);
    };
    // posts: the corners and both sides of every opening (plus one mid-span where a bay is long)
    const posts = new Set<number>([w.from, w.to]);
    for (const o of w.openings) { posts.add(o.a0 - 0.08); posts.add(o.a1 + 0.08); }
    const sorted = [...posts].sort((p, q) => p - q);
    for (let i = 0; i < sorted.length - 1; i++) if (sorted[i + 1] - sorted[i] > 2.2) posts.add((sorted[i] + sorted[i + 1]) / 2);
    const postList = [...posts].sort((p, q) => p - q);
    for (const a of postList) {
      const s = 0.15 + jit(0.015);
      put('timber', a - s / 2, a + s / 2, FLOOR, PLATE, 0.0, 0.17, 1.2);
      put('concrete', a - 0.13, a + 0.13, -0.02, FLOOR + 0.08, 0.0, 0.26, 0.8);                 // pad under the post
    }
    // infill between the posts, around the openings
    const cuts = [...new Set([...postList, ...w.openings.flatMap((o) => [o.a0, o.a1])])].sort((p, q) => p - q);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a0 = cuts[i], a1 = cuts[i + 1]; if (a1 - a0 < 0.02) continue;
      const am = (a0 + a1) / 2;
      const holes = w.openings.filter((o) => o.a0 - 1e-3 <= am && am <= o.a1 + 1e-3).sort((p, q) => p.y0 - q.y0);
      let y = FLOOR; const spans: [number, number][] = [];
      for (const o of holes) { if (o.y0 > y + 1e-3) spans.push([y, o.y0]); y = Math.max(y, o.y1); }
      if (PLATE > y + 1e-3) spans.push([y, PLATE]);
      for (const [s0, s1] of spans) {
        // lower course: plastered hollow block (painted on the front), as thick as the original wall
        if (s0 < GIRT) put(w.axis === 'x' && w.out === 1 ? 'aged' : 'block', a0, a1, s0, Math.min(s1, GIRT), 0, 0.17, 1.4);
        // upper: woven bamboo panels, set back between the posts
        if (s1 > GIRT + 0.1) put('bamboo', a0, a1, Math.max(s0, GIRT + 0.1), s1, -0.02, 0.05, 1.1);
      }
    }
    // girt (mid-height beam) and wall plate (on top of the posts)
    const doors = w.openings.filter((o) => o.kind === 'door');
    const girtCuts = [w.from - 0.09, ...doors.flatMap((o) => [o.a0 - 0.08, o.a1 + 0.08]), w.to + 0.09];
    for (let i = 0; i < girtCuts.length; i += 2) put('timber', girtCuts[i], girtCuts[i + 1], GIRT, GIRT + 0.1, 0.035, 0.12, 1.5);
    put('timber', w.from - 0.09, w.to + 0.09, PLATE, PLATE_TOP, 0, 0.18, 2);

    // openings: deep frames, sills, shutters, awnings; the door's threshold
    for (const o of w.openings) {
      const fw = 0.07, depth = 0.22;
      put('timber', o.a0 - fw, o.a0, o.y0, o.y1 + fw, 0.01, depth, 1);
      put('timber', o.a1, o.a1 + fw, o.y0, o.y1 + fw, 0.01, depth, 1);
      put('timber', o.a0 - fw, o.a1 + fw, o.y1, o.y1 + fw, 0.01, depth, 1);
      const along = w.axis === 'x' ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
      const normal = w.axis === 'x' ? new Vector3(0, 0, w.out) : new Vector3(w.out, 0, 0);
      const onWall = (a: number, y: number, off: number) => (w.axis === 'x' ? new Vector3(a, y, w.at + w.out * off) : new Vector3(w.at + w.out * off, y, a));
      if (o.kind === 'window') {
        put('timber', o.a0 - fw - 0.05, o.a1 + fw + 0.05, o.y0 - 0.06, o.y0, 0.06, depth + 0.1, 1, 0.08);   // sill, sloped to shed water
        // louvred shutters swung open, each at its own angle (one hangs a little crooked)
        const leafW = (o.a1 - o.a0) / 2, h = o.y1 - o.y0;
        for (const side of [-1, 1] as const) {
          const open = side < 0 ? 0.32 + jit(0.1) : 0.55 + jit(0.1), sag = side > 0 ? 0.025 : 0;
          const leaf = new Builder(Math.floor(b.rnd() * 1e6) + 1);
          leaf.box('shutter', [0.05, h, 0.035], [0.025, h / 2, 0]);
          leaf.box('shutter', [0.05, h, 0.035], [leafW - 0.025, h / 2 - sag, 0]);
          leaf.box('shutter', [leafW, 0.06, 0.035], [leafW / 2, 0.03 - sag / 2, 0], [0, 0, -sag / leafW]);
          leaf.box('shutter', [leafW, 0.06, 0.035], [leafW / 2, h - 0.03 - sag / 2, 0], [0, 0, -sag / leafW]);
          for (let sy = 0.1; sy < h - 0.08; sy += 0.07) leaf.box('shutter', [leafW - 0.08, 0.055, 0.008], [leafW / 2, sy, 0], [0.7, 0, 0], 0.6);
          leaf.box('metal', [0.012, 0.09, 0.05], [0.0, h * 0.2, 0], [0, 0, 0], 0.3);                 // hinges
          leaf.box('metal', [0.012, 0.09, 0.05], [0.0, h * 0.8, 0], [0, 0, 0], 0.3);
          const dir = along.clone().multiplyScalar(side * Math.cos(open)).addScaledVector(normal, Math.sin(open)).normalize();
          const up = new Vector3(0, 1, 0), across = new Vector3().crossVectors(dir, up);
          const m = new Matrix4().makeBasis(dir, up, across).setPosition(onWall(side < 0 ? o.a0 - fw : o.a1 + fw, o.y0, 0.13));
          leaf.parts.forEach((list, key) => { list.forEach((g) => g.applyMatrix4(m)); (b.parts.get(key) ?? b.parts.set(key, []).get(key)!).push(...list); });
        }
        // "media agua": a corrugated awning over the window on two brackets
        const aw = o.a1 - o.a0 + 0.7, ad = 0.6, tilt = 0.32, ay = o.y1 + 0.28, am = (o.a0 + o.a1) / 2;
        const dirOut = normal.clone().multiplyScalar(Math.cos(tilt)).add(new Vector3(0, -Math.sin(tilt), 0)).normalize();
        const sheetN = new Vector3().crossVectors(dirOut, along).normalize();
        if (sheetN.y < 0) sheetN.negate();
        const sheetC = onWall(am, ay, 0.1).addScaledVector(dirOut, ad / 2);
        for (let r = -aw / 2 + 0.04; r < aw / 2; r += 0.076) {          // corrugations: alternate raised ribs
          const c = sheetC.clone().addScaledVector(along, r).addScaledVector(sheetN, (Math.round(r / 0.076) % 2 === 0 ? 0 : 0.012));
          b.boxBasis('iron', [0.08, 0.006, ad], new Matrix4().makeBasis(along, sheetN, new Vector3().crossVectors(along, sheetN)).setPosition(c), 0.7);
        }
        for (const k of [-1, 1]) {
          const bp = onWall(am + k * (aw / 2 - 0.12), ay - 0.2, 0.1 + 0.18);
          b.box('timber', w.axis === 'x' ? [0.05, 0.05, 0.42] : [0.42, 0.05, 0.05], bp, w.axis === 'x' ? [w.out * 0.6, 0, 0] : [0, 0, -w.out * 0.6], 0.8);
        }
      } else {
        put('concrete', o.a0 - 0.05, o.a1 + 0.05, FLOOR - 0.02, FLOOR + 0.02, 0.05, depth + 0.04, 0.8);   // threshold
      }
    }
  }

  // ---- gables (x = ±3): bamboo infill up to the roof line, a king post
  for (const x of [X0, X1]) {
    const out = Math.sign(x);
    for (let y = PLATE_TOP; y < RIDGE - 0.05; y += 0.3) {
      const top = Math.min(y + 0.3, RIDGE), half = (RIDGE - (y + top) / 2) / Math.tan(PITCH);
      b.box('bamboo', [0.05, top - y, Math.max(0.05, half * 2)], [x - out * 0.02, (y + top) / 2, 0], [0, 0, 0], 1.1);
    }
    b.box('timber', [0.15, RIDGE - PLATE_TOP + 0.1, 0.15], [x, (RIDGE + PLATE_TOP) / 2, 0], [0, 0, 0], 1.2);
  }

  // ---- roof: tie beams, ridge beam, rafters, purlins, thatch courses, ridge roll, a mended patch
  for (const x of [-2.25, -0.75, 0.75, 2.25]) b.box('timber', [0.12, 0.16, Z1 - Z0 + 0.3], [x + jit(0.04), PLATE_TOP + 0.08, 0], [0, 0, 0], 2);
  b.box('timber', [X1 - X0 + 2 * GABLE_OVER, 0.18, 0.14], [0, RIDGE - 0.09, 0], [0, 0, 0], 2);
  const slopeLen = (Z1 + EAVE) / Math.cos(PITCH);
  const X = new Vector3(1, 0, 0);
  for (const s of [1, -1] as const) {
    // this side's roof plane: down-slope D and outward normal N, measured from the ridge line (x, RIDGE, 0)
    const D = new Vector3(0, -Math.sin(PITCH), s * Math.cos(PITCH)), N = new Vector3(0, Math.cos(PITCH), s * Math.sin(PITCH));
    const Zb = new Vector3().crossVectors(X, N);          // right-handed third axis (= ±D)
    const basis = (c: Vector3) => new Matrix4().makeBasis(X, N, Zb).setPosition(c);
    const at = (x: number, e: number, h: number) => new Vector3(x, RIDGE, 0).addScaledVector(D, e).addScaledVector(N, h);
    for (let x = X0 - GABLE_OVER + 0.05; x <= X1 + GABLE_OVER; x += 0.6) b.boxBasis('timber', [0.07, 0.13, slopeLen], basis(at(x, slopeLen / 2, -0.065)), 1.6);   // rafters
    for (let e = 0.25; e < slopeLen; e += 0.55) b.boxBasis('timber', [X1 - X0 + 2 * GABLE_OVER, 0.06, 0.07], basis(at(0, e, 0.03)), 1.8);                     // purlins
    // thatch: seven overlapping courses from the eave up; each course in strips with ragged, random lower edges
    const courses = 7, step = slopeLen / courses;
    for (let c = 0; c < courses; c++) {
      const e1 = slopeLen - c * step, len = step * 1.7;
      for (let x = X0 - GABLE_OVER; x < X1 + GABLE_OVER - 0.01; x += 0.42) {
        const wdt = Math.min(0.42, X1 + GABLE_OVER - x) + 0.03, longer = b.rnd() * 0.09 + (c === 0 ? 0.05 : 0);
        const lo = e1 + longer, hi = Math.max(0.05, e1 - len);
        const thick = (THATCH / courses) * 1.9 + jit(0.02), lift = 0.07 + c * 0.012 + thick / 2;
        const m = basis(at(x + wdt / 2, (lo + hi) / 2, lift)).multiply(new Matrix4().makeRotationFromEuler(new Euler(jit(0.04), jit(0.05), 0)));
        b.boxBasis('thatch', [wdt, thick, lo - hi], m, 1.4);
      }
    }
    // the mended patch: a rusty corrugated sheet laid over the thatch on the north side
    if (s === -1) b.boxBasis('iron', [1.1, 0.012, 1.5], basis(at(1.6, slopeLen * 0.45, 0.07 + 0.012 * 7 + (THATCH / courses) * 1.9 + 0.015)).multiply(new Matrix4().makeRotationY(0.06)), 0.8);
  }
  // ridge roll: a bundle of thatch along the ridge (a diamond section), sagging slightly in the middle
  for (let x = X0 - GABLE_OVER; x < X1 + GABLE_OVER - 0.01; x += 0.7) {
    const sag = 0.05 * Math.sin((Math.PI * (x - X0 + GABLE_OVER)) / (X1 - X0 + 2 * GABLE_OVER));
    b.box('thatch', [0.72, 0.36, 0.36], [x + 0.35, RIDGE + 0.2 + THATCH * 0.3 - sag, 0], [Math.PI / 4 + jit(0.08), 0, 0], 1.2);
  }
  return b.build(mats, 'houseA_shell');
}

/** a panelled timber door for the hinge group (local: x 0…width from the hinge, y 0…height, z thickness):
 *  stiles, rails, recessed raised panels, two strap hinges and a handle */
export function buildHouseADoor(mats: Mats, width: number, height: number) {
  const b = new Builder(5), t = 0.045, st = 0.1;
  b.box('door', [st, height, t], [st / 2, height / 2, 0], [0, 0, 0], 1);
  b.box('door', [st, height, t], [width - st / 2, height / 2, 0], [0, 0, 0], 1);
  for (const [y, h] of [[height - 0.06, 0.12], [1.0, 0.16], [0.11, 0.22]] as const) b.box('door', [width - 2 * st, h, t], [width / 2, y, 0], [0, 0, 0], 1);
  const pw = (width - 2 * st - 0.04) / 2;
  for (const [y0, y1] of [[0.22, 0.92], [1.08, height - 0.12]]) for (const k of [0, 1]) {
    const cx = st + 0.01 + pw / 2 + k * (pw + 0.02), cy = (y0 + y1) / 2;
    b.box('door', [pw, y1 - y0, t * 0.4], [cx, cy, 0], [0, 0, 0], 1);
    b.box('door', [pw - 0.1, y1 - y0 - 0.1, t * 0.7], [cx, cy, 0], [0, 0, 0], 1);
  }
  for (const y of [0.35, height - 0.35]) for (const side of [1, -1]) b.box('metal', [0.36, 0.045, 0.008], [0.18, y, side * (t / 2 + 0.004)], [0, 0, 0], 0.3);   // strap hinges
  for (const side of [1, -1]) {
    b.box('metal', [0.03, 0.14, 0.012], [width - 0.08, 1.0, side * (t / 2 + 0.006)], [0, 0, 0], 0.3);    // handle plate
    b.box('metal', [0.02, 0.1, 0.03], [width - 0.08, 1.0, side * (t / 2 + 0.025)], [0, 0, 0], 0.3);     // grip
  }
  return b.build(mats, 'houseA_door');
}

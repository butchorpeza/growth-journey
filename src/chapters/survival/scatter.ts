/* Procedural scatter on the Chapter 01 terrain (deterministic: same result every visit):
   - banana groves: clumps near the houses, along both sides of the scroll path, and across the hills
   - a band of thick carabao grass along both sides of the path
   - extra ground cover in natural clumps (grass with weeds and nettles mixed in) around the hand-placed plants
   Placement reads the terrain's own splat weights (vertex colours: R mud, G laterite, B forest floor, rest grass),
   so nothing grows on the road or the trodden yards, and keeps clear of every building/fence collider.
   Heights come from a BVH raycast straight down onto the terrain. */
import { Quaternion, Raycaster, Triangle, Vector3, type BufferAttribute, type Mesh } from 'three';
import type { SurvivalLayout } from './layout';
import { PORTAL, SURVIVAL_PATH } from './path';

export type Inst = [number, number, number, number, number];   // x, y, z, yaw, scale

function rng(seed: number) {   // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function scatter(terrain: Mesh, layout: SurvivalLayout) {
  terrain.updateMatrixWorld(true);
  const pos = terrain.geometry.getAttribute('position') as BufferAttribute;
  const col = terrain.geometry.getAttribute('color') as BufferAttribute;
  const ray = new Raycaster(); (ray as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
  const down = new Vector3(0, -1, 0), origin = new Vector3();
  const tri = new Triangle(), a = new Vector3(), b = new Vector3(), c = new Vector3(), bary = new Vector3(), local = new Vector3();
  // distance to each collider's real footprint (an oriented box in plan), not a circle around it: the long, thin,
  // invisible boundary walls (6 m tall, 0.3 m thick) would otherwise clear a 10 m disc around themselves and leave
  // bald patches (behind the portal, along the road). Those walls only keep the visitor in, so plants may grow
  // close to them; buildings, fences, rocks and props keep their full clearance.
  const axis = new Vector3();
  const obstacles = layout.colliders.map((k) => {
    axis.set(1, 0, 0).applyQuaternion(new Quaternion(k.q[0], k.q[1], k.q[2], k.q[3]));
    const l = Math.hypot(axis.x, axis.z) || 1;
    return { x: k.p[0], z: k.p[2], ax: axis.x / l, az: axis.z / l, hx: k.h[0], hz: k.h[2], wall: k.h[1] >= 5.9 && Math.min(k.h[0], k.h[2]) <= 0.31 };
  });
  const clearance = (x: number, z: number) => {
    let best = Infinity;
    for (const o of obstacles) {
      const dx = x - o.x, dz = z - o.z;
      const lx = Math.abs(dx * o.ax + dz * o.az) - o.hx, lz = Math.abs(-dx * o.az + dz * o.ax) - o.hz;
      const d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0);
      best = Math.min(best, o.wall ? d + 5.5 : d);
    }
    return best;
  };

  /** terrain height + splat weights [mud, soil, forest, grass] at (x, z), or null outside the terrain */
  const sample = (x: number, z: number) => {
    ray.set(origin.set(x, 200, z), down);
    const hit = ray.intersectObject(terrain, false)[0];
    if (!hit || !hit.face) return null;
    local.copy(hit.point).applyMatrix4(terrain.matrixWorld.clone().invert());
    tri.set(a.fromBufferAttribute(pos, hit.face.a), b.fromBufferAttribute(pos, hit.face.b), c.fromBufferAttribute(pos, hit.face.c));
    tri.getBarycoord(local, bary);
    const w = (ch: 0 | 1 | 2) => col.getComponent(hit.face!.a, ch) * bary.x + col.getComponent(hit.face!.b, ch) * bary.y + col.getComponent(hit.face!.c, ch) * bary.z;
    const mud = w(0), soil = w(1), forest = w(2);
    return { y: hit.point.y, mud, soil, forest, grass: Math.max(0, 1 - mud - soil - forest) };
  };

  // village centre (houses, yards) and terrain centre, from build_survival.py
  const VX = 2, VZ = 8, TX = 6, TZ = -18;
  const r = rng(20261124);

  // banana groves: plants grow in clumps from suckers, so place clump centres, then 2–5 plants around each
  const bananasNear: Inst[] = [], bananasFar: Inst[] = [];
  const grove = (out: Inst[], cx: number, cz: number, n: number, spread: number, minScale: number, onMud = false) => {
    for (let k = 0; k < n; k++) {
      const x = cx + (r() * 2 - 1) * spread, z = cz + (r() * 2 - 1) * spread;
      if (clearance(x, z) < 2.2) continue;
      const s = sample(x, z);
      if (!s || (s.mud > 0.25 && !onMud)) continue;
      out.push([x, s.y - 0.05, z, r() * Math.PI * 2, minScale + r() * 0.6]);
    }
  };
  const centres: [number, number][] = [];
  const apart = (x: number, z: number, d: number) => centres.every(([a, b]) => Math.hypot(a - x, b - z) > d);
  // near the houses: backyards and field edges, full detail
  for (let i = 0; i < 600 && bananasNear.length < 80; i++) {
    const ang = r() * Math.PI * 2, rad = 8 + r() * 27;
    const x = VX + Math.cos(ang) * rad, z = VZ + Math.sin(ang) * rad;
    if (clearance(x, z) < 3.5 || !apart(x, z, 7)) continue;
    const s = sample(x, z);
    if (!s || s.mud > 0.2 || s.soil > 0.5) continue;
    centres.push([x, z]); grove(bananasNear, x, z, 3 + Math.floor(r() * 3), 1.8, 1.0);
  }
  // the hills: covered in banana plants. A jittered 4.5 m grid over everything beyond the village, each cell a
  // small clump (1–3 plants); drawn as 3D near the visitor and as impostor cards further away (Bananas.tsx)
  // distance from the scroll path (the walk keeps a clear corridor through the forest)
  const pathPts = SURVIVAL_PATH.map((w) => w.at);
  const pathDist = (x: number, z: number) => {
    let best = Infinity;
    for (let i = 0; i < pathPts.length - 1; i++) {
      const [ax, az] = pathPts[i], [bx, bz] = pathPts[i + 1], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  };
  // a banana forest: a jittered 3.2 m grid over the whole map, clear of the houses, yards, road and the walk
  for (let gx = TX - 112; gx <= TX + 112; gx += 3.2) {
    for (let gz = TZ - 112; gz <= TZ + 112; gz += 3.2) {
      const x = gx + (r() - 0.5) * 2.6, z = gz + (r() - 0.5) * 2.6;
      if (Math.hypot(x - VX, z - VZ) < 18 || clearance(x, z) < 7 || pathDist(x, z) < 4.5 || r() < 0.06) continue;
      const s = sample(x, z);
      if (!s || s.mud > 0.2 || s.soil > 0.4) continue;
      grove(bananasFar, x, z, 1 + Math.floor(r() * 3), 1.6, 1.15);
    }
  }

  // the forest behind the portal: the road ends at the gate and the banana forest closes in around and behind it,
  // so the portal stands at the edge of a dense wood. A 1.9 m jittered grid over a 30 m disc, thinning towards its
  // edge; the side the visitor arrives from (a 70° wedge in front of the gate) stays open.
  {
    const [px, pz] = PORTAL.at, fx = PORTAL.facing[0] - px, fz = PORTAL.facing[1] - pz, fl = Math.hypot(fx, fz);
    for (let gx = px - 30; gx <= px + 30; gx += 1.9) {
      for (let gz = pz - 30; gz <= pz + 30; gz += 1.9) {
        const x = gx + (r() - 0.5) * 1.6, z = gz + (r() - 0.5) * 1.6, dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
        if (d > 30 || d < 3.2 || r() < d / 30 * 0.45) continue;
        const front = (dx * fx + dz * fz) / (d * fl);                  // 1 = straight in front of the gate
        if (front > Math.cos(35 * Math.PI / 180) || (front > 0 && d < 7)) continue;
        if (clearance(x, z) < 2.2 || pathDist(x, z) < 3.5) continue;
        const s = sample(x, z);
        if (!s || (s.mud > 0.45 && front > -0.3)) continue;           // behind the gate the road is swallowed by the forest
        grove(bananasFar, x, z, 2 + Math.floor(r() * 3), 1.1, 1.1, true);
      }
    }
  }

  // the path's edges: a corridor of banana plants and thick carabao grass along both sides of the walk
  const pathGrass: Inst[] = [];
  const pts = SURVIVAL_PATH.map((w) => w.at);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;                       // sideways (left of travel)
    for (let d = 0; d < len; d += 1.1) {
      const cx = ax + (bx - ax) * (d / len), cz = az + (bz - az) * (d / len);
      for (const side of [-1, 1]) {
        // grass: 1–4.5 m to each side, two clumps per step
        for (let k = 0; k < 2; k++) {
          const off = 1.0 + r() * 3.5, x = cx + nx * side * off + (r() - 0.5), z = cz + nz * side * off + (r() - 0.5);
          if (clearance(x, z) < 0.8) continue;
          const s = sample(x, z);
          if (!s || s.mud > 0.35 || s.soil > 0.55) continue;
          pathGrass.push([x, s.y - 0.02, z, r() * Math.PI * 2, 1.0 + r() * 0.8]);
        }
        // bananas: a continuous line along both sides, every ~2.2 m, 2.4–5 m out, to the very end of the path
        if ((Math.round(d / 1.1) % 2) === 0 && r() < 0.92) {
          const off = 2.4 + r() * 2.6, x = cx + nx * side * off, z = cz + nz * side * off;
          if (clearance(x, z) < 2.5) continue;
          const s = sample(x, z);
          if (!s || s.mud > 0.3 || s.soil > 0.5) continue;
          grove(bananasFar, x, z, 1 + Math.floor(r() * 3), 1.2, 1.05);
        }
      }
    }
  }

  // ground cover in clumps (a centre, then 5–14 tufts around it), so it reads as massed vegetation, not a sprinkle
  const grass: Record<string, Inst[]> = {};
  const all = Object.keys(layout.foliage);
  // carabao grass clumps (~70 triangles each); weeds and nettles cost 900–4,000, so they are a rare accent
  const grasses = all.filter((v) => v.startsWith('grass__')), weeds = all.filter((v) => /^(weed|nettle)__/.test(v));
  let placed = 0;
  for (let i = 0; i < 14000 && placed < 26000 && grasses.length; i++) {
    const ang = r() * Math.PI * 2, rad = 10 + Math.sqrt(r()) * 72;
    const cx = VX + Math.cos(ang) * rad, cz = VZ + Math.sin(ang) * rad;
    if (clearance(cx, cz) < 2) continue;
    const centre = sample(cx, cz);
    if (!centre || centre.grass < 0.4 || centre.mud > 0.15) continue;
    const n = 10 + Math.floor(r() * 16), spread = 0.6 + r() * 1.6;
    for (let k = 0; k < n; k++) {
      const x = cx + (r() * 2 - 1) * spread, z = cz + (r() * 2 - 1) * spread;
      if (clearance(x, z) < 1.2) continue;
      const s = k === 0 ? centre : sample(x, z);
      if (!s || s.mud > 0.2) continue;
      const pool = weeds.length && r() < 0.02 ? weeds : grasses;
      const v = pool[Math.floor(r() * pool.length)];
      (grass[v] ??= []).push([x, s.y - 0.02, z, r() * Math.PI * 2, 1.0 + r() * 0.8]);
      placed++;
    }
  }
  // path-edge grass is shared out across the carabao grass variants
  const gv = Object.keys(layout.foliage).filter((v) => v.startsWith('grass__'));
  pathGrass.forEach((g, i) => { if (gv.length) (grass[gv[i % gv.length]] ??= []).push(g); });
  return { bananasNear, bananasFar, grass };
}

/* Procedural carabao grass (Paspalum / Axonopus): the low, fine, dense grass of Filipino yards and roadsides.
   Each clump is 18–26 thin blades spread over a ~45 cm patch (tapered, curved, leaning outward) plus the odd slender
   seed stalk, ~10–35 cm
   tall. Colour runs from a dark base to lighter tips, with some sun-yellowed ends. Normals point mostly up, so the
   blades light like the ground they grow from (the standard trick for dense grass: no dark backfaces).
   Three clump shapes give variety; all share one material (wind + cloud shadows are patched on by Foliage). */
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BASE = new Color(0.07, 0.13, 0.035), MID = new Color(0.2, 0.33, 0.08), TIP = new Color(0.42, 0.52, 0.17), DRY = new Color(0.62, 0.58, 0.3);

function clump(seed: number, blades: number, height: number, stalks: number) {
  const r = rng(seed), pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new Color();
  const blade = (h: number, w: number, segs: number, dry: number, stalk: boolean) => {
    const ang = r() * Math.PI * 2, off = Math.sqrt(r()) * 0.22;            // spread over a ~45 cm patch: a mat, not a tuft
    const ox = Math.cos(ang) * off, oz = Math.sin(ang) * off;
    const lean = (stalk ? 0.15 : 0.35 + r() * 0.55) * h;                // how far the tip bends outward
    const face = ang + (r() - 0.5) * 1.2, fx = Math.cos(face), fz = Math.sin(face);   // blade's flat direction
    const start = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, y = t * h, bend = lean * t * t;
      const half = (stalk ? 0.0015 : w * (1 - t * 0.92)) / 2;
      const cx = ox + Math.cos(ang) * bend, cz = oz + Math.sin(ang) * bend;
      c.copy(BASE).lerp(MID, Math.min(1, t * 2)).lerp(TIP, Math.max(0, t * 2 - 1)).lerp(DRY, dry * t * t);
      for (const s of [-1, 1]) {
        pos.push(cx + fx * half * s, y, cz + fz * half * s);
        nor.push(Math.cos(ang) * 0.25, 1, Math.sin(ang) * 0.25);        // mostly up: lit like the ground
        col.push(c.r, c.g, c.b);
      }
      if (i < segs) { const a = start + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  };
  for (let i = 0; i < blades; i++) blade(height * (0.55 + r() * 0.6), 0.005 + r() * 0.004, 3, r() < 0.25 ? 0.6 + r() * 0.4 : r() * 0.2, false);
  for (let i = 0; i < stalks; i++) blade(height * (1.3 + r() * 0.5), 0, 3, 0.5, true);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

let cache: Mesh[] | null = null;

/** three carabao-grass clump meshes (short, medium, seeding), shared by every grass variant */
export function carabaoGrass(): Mesh[] {
  if (cache) return cache;
  const mat = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.82, metalness: 0 });
  mat.name = 'carabao_grass';
  cache = [clump(11, 22, 0.16, 0), clump(23, 26, 0.22, 1), clump(37, 18, 0.28, 2)].map((g) => new Mesh(g, mat));
  return cache;
}

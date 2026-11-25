/* Section 01 of The Shadows, the Entrance of Isolation: what stands on the island.
   - the gate: two weathered stone pillars (plinth, shaft, cornice, a ball finial; one finial has fallen and lies in
     the grass) and a wrought-iron double gate under a scrolled arch: one leaf hangs open and sags on its hinge, the
     other is almost shut;
   - the boundary: a low stone wall with iron railings running from the pillars to the cliffs, with a collapsed
     stretch, bent bars and pieces of railing lying in the grass;
   - old lamp posts along the avenue: two give a weak, unsteady amber light, two are failing, the rest are dead;
   - dead trees: bare, twisted, generated from seeded branching (three shapes, turned and scaled);
   - the mansion on its terrace to the north, read mostly as a silhouette against the moonlit cloud: a main block,
     two wings, a tower, steep roofs, chimneys, a columned porch and rows of dark windows, a few faintly and
     unevenly lit;
   - low fog: drifting layers just above the ground, thicker towards the sea.
   Materials are the CC0 textures Chapter 01 ships (concrete, aged plaster, timber, iron), tinted cold. Geometry is
   built here at full detail (round bars, tapered branches), never boxes standing in for things. */
import { useFrame, useLoader } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, SpriteMaterial, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry,
  Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, PointLight,
  Quaternion, RepeatWrapping, SRGBColorSpace, Shape, ShaderMaterial, SphereGeometry, TextureLoader, TorusGeometry,
  UniformsLib, UniformsUtils, Vector2, Vector3, type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lightningState } from '../../rendering/Lightning';
import { GROUPS } from '../../physics/CollisionLayers';
import { SURVIVAL_BASE } from '../survival/layout';
import { GATE, HOUSE, LAMPS, MANSION, TREES, groundHeight, islandRn } from './layout';

const tex = (t: Texture, r: number, srgb = false) => { const c = t.clone(); c.wrapS = c.wrapT = RepeatWrapping; c.repeat.set(r, r); c.anisotropy = 8; if (srgb) c.colorSpace = SRGBColorSpace; c.needsUpdate = true; return c; };

export function useEstateMaterials() {
  const t = useLoader(TextureLoader, [
    `${SURVIVAL_BASE}/housea/concrete_diff.webp`, `${SURVIVAL_BASE}/housea/concrete_nor.webp`, `${SURVIVAL_BASE}/housea/concrete_rough.webp`,
    `${SURVIVAL_BASE}/housea/aged_diff.webp`, `${SURVIVAL_BASE}/housea/aged_nor.webp`,
    `${SURVIVAL_BASE}/housea/timber_diff.webp`, `${SURVIVAL_BASE}/housea/timber_nor.webp`,
    `${SURVIVAL_BASE}/housea/iron_rough.webp`,
  ]);
  return useMemo(() => {
    const [cd, cn, cr, ad, an, td, tn, ir] = t;
    const stone = new MeshStandardMaterial({ map: tex(cd, 1.2, true), normalMap: tex(cn, 1.2), roughnessMap: tex(cr, 1.2), normalScale: new Vector2(1.4, 1.4), color: new Color('#7b7d7c'), roughness: 1 });
    const wall = new MeshStandardMaterial({ map: tex(ad, 0.22, true), normalMap: tex(an, 0.22), normalScale: new Vector2(1.1, 1.1), color: new Color('#4c4e52'), roughness: 0.97 });
    const roof = new MeshStandardMaterial({ map: tex(cd, 0.3, true), normalMap: tex(cn, 0.3), color: new Color('#1d2125'), roughness: 0.82 });
    const iron = new MeshStandardMaterial({ color: new Color('#1b1a19'), metalness: 0.75, roughness: 0.62, roughnessMap: tex(ir, 2) });
    const bark = new MeshStandardMaterial({ map: tex(td, 1, true), normalMap: tex(tn, 1), normalScale: new Vector2(1.6, 1.6), color: new Color('#4a4640'), roughness: 0.95 });
    const glass = new MeshStandardMaterial({ color: new Color('#07090c'), roughness: 0.18, metalness: 0.4 });
    const wood = new MeshStandardMaterial({ map: tex(td, 0.6, true), normalMap: tex(tn, 0.6), color: new Color('#3b3732'), roughness: 0.9 });
    return { stone, wall, roof, iron, bark, glass, wood };
  }, [t]);
}
export type Mats = ReturnType<typeof useEstateMaterials>;

// ------------------------------------------------------------------------------------------- geometry helpers
const Y = new Vector3(0, 1, 0), q = new Quaternion(), m4 = new Matrix4();
/** a tapered cylinder from a to b (radii ra, rb), with bark UVs scaled to its length */
export function limb(a: Vector3, b: Vector3, ra: number, rb: number, sides = 7) {
  const d = b.clone().sub(a), len = d.length();
  const g = new CylinderGeometry(rb, ra, len + ra * 0.6, sides, 2, false);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, ra * 8), uv.getY(i) * len * 0.8);
  g.translate(0, len / 2, 0);
  q.setFromUnitVectors(Y, d.normalize()); g.applyQuaternion(q); g.translate(a.x, a.y, a.z);
  return g;
}
export function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** a bare, twisted dead tree, ~7-10 m: a leaning trunk that bends as it rises, splitting into crooked limbs and
 *  thin, reaching twigs; root flares at the base */
function deadTree(seed: number) {
  const r = rng(seed), parts: BufferGeometry[] = [];
  const jitter = (v: Vector3, k: number) => v.add(new Vector3((r() - 0.5) * k, (r() - 0.5) * k * 0.6, (r() - 0.5) * k)).normalize();
  const grow = (base: Vector3, dir: Vector3, len: number, rad: number, depth: number) => {
    let p = base.clone(); const d = dir.clone(); const segs = depth === 0 ? 5 : 3;
    const joints: [Vector3, Vector3, number][] = [];
    for (let s = 0; s < segs; s++) {
      jitter(d, depth === 0 ? 0.28 : 0.55);
      if (depth > 0) d.y += 0.06; d.normalize();
      const r0 = rad * (1 - (s / segs) * 0.62), r1 = rad * (1 - ((s + 1) / segs) * 0.62);
      const nxt = p.clone().addScaledVector(d, len / segs);
      parts.push(limb(p, nxt, r0, r1, depth < 2 ? 8 : 5));
      joints.push([nxt.clone(), d.clone(), r1]);
      p = nxt;
    }
    if (depth >= 4) return;
    // limbs from the upper joints (the trunk forks higher up; branches fork along their length)
    const from = depth === 0 ? joints.slice(2) : joints;
    for (const [jp, jd, jr] of from) {
      const kids = depth === 0 ? 1 + (r() < 0.6 ? 1 : 0) : r() < 0.75 ? 1 : 0;
      for (let k = 0; k < kids; k++) {
        const side = new Vector3(r() - 0.5, 0, r() - 0.5).normalize();
        const nd = jd.clone().multiplyScalar(0.55).addScaledVector(side, 0.8 + r() * 0.4).add(new Vector3(0, 0.25 + r() * 0.45, 0)).normalize();
        grow(jp, nd, len * (0.5 + r() * 0.22), jr * (0.55 + r() * 0.15), depth + 1);
      }
    }
    // the end carries on, thinner
    grow(p, d, len * 0.55, rad * 0.32, depth + 1);
  };
  const lean = new Vector3((r() - 0.5) * 0.35, 1, (r() - 0.5) * 0.35).normalize();
  grow(new Vector3(0, -0.2, 0), lean, 4.2 + r() * 1.5, 0.3, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.6, out = new Vector3(Math.cos(a), -0.35, Math.sin(a)).normalize();
    parts.push(limb(new Vector3(0, 0.35, 0), out.clone().multiplyScalar(1.1 + r() * 0.7).add(new Vector3(0, 0.2, 0)), 0.17, 0.04, 6));
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  parts.forEach((p) => p.dispose());
  return g;
}

/** a gable roof: a triangular prism w (along x) by d, ridge h above the eaves */
function gable(w: number, h: number, d: number) {
  const s = new Shape(); s.moveTo(-d / 2 - 0.4, 0); s.lineTo(0, h); s.lineTo(d / 2 + 0.4, 0); s.lineTo(-d / 2 - 0.4, 0);
  const g = new ExtrudeGeometry(s, { depth: w + 0.6, bevelEnabled: false });
  g.translate(0, 0, -(w + 0.6) / 2); g.rotateY(Math.PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * 0.25);
  return g;
}

// ------------------------------------------------------------------------------------------------- the gate
function Pillar({ x, mats, finial = true }: { x: number; mats: Mats; finial?: boolean }) {
  const y0 = groundHeight(x, GATE.z);
  return (
    <group position={[x, y0, GATE.z]}>
      <mesh material={mats.stone} position={[0, 0.2, 0]} castShadow receiveShadow><boxGeometry args={[1.25, 0.5, 1.25]} /></mesh>
      <mesh material={mats.stone} position={[0, 1.95, 0]} castShadow receiveShadow><boxGeometry args={[0.98, 3.0, 0.98]} /></mesh>
      <mesh material={mats.stone} position={[0, 3.5, 0]} castShadow receiveShadow><boxGeometry args={[1.22, 0.16, 1.22]} /></mesh>
      <mesh material={mats.stone} position={[0, 3.66, 0]} castShadow receiveShadow><boxGeometry args={[1.08, 0.18, 1.08]} /></mesh>
      <mesh material={mats.stone} position={[0, 3.85, 0]} castShadow><cylinderGeometry args={[0.16, 0.24, 0.22, 16]} /></mesh>
      {finial ? <mesh material={mats.stone} position={[0, 4.18, 0]} castShadow><sphereGeometry args={[0.27, 24, 16]} /></mesh>
        : <mesh material={mats.stone} position={[0, 3.98, 0]} rotation={[0.3, 0, 0.2]}><cylinderGeometry args={[0.1, 0.16, 0.08, 10]} /></mesh>}
    </group>
  );
}

/** one wrought-iron gate leaf, hinge at x = 0, opening towards +x; bars with spear tips, rails, a band of rings */
export function leafGeometry(w: number, h: number) {
  const parts: BufferGeometry[] = [];
  const bar = (x: number, y0: number, y1: number, r = 0.014) => { const g = new CylinderGeometry(r, r, y1 - y0, 8); g.translate(x, (y0 + y1) / 2, 0); parts.push(g); };
  const rail = (y: number, t = 0.035) => { const g = new BoxGeometry(w, t, 0.03); g.translate(w / 2, y, 0); parts.push(g); };
  bar(0.02, 0.05, h + 0.05, 0.03); bar(w - 0.02, 0.05, h, 0.028);
  rail(0.12); rail(0.55); rail(h - 0.25, 0.03); rail(h - 0.38, 0.025);
  const n = Math.round(w / 0.13);
  for (let i = 1; i < n; i++) {
    const x = (i / n) * w, top = h + 0.12 + 0.18 * Math.sin((i / n) * Math.PI);
    bar(x, 0.12, top);
    const tip = new ConeGeometry(0.03, 0.13, 8); tip.translate(x, top + 0.06, 0); parts.push(tip);
    if (i % 2 === 0) { const ring = new TorusGeometry(0.055, 0.009, 6, 18); ring.translate(x - w / n / 2, 0.335, 0); parts.push(ring); }
  }
  // a diagonal brace
  const len = Math.hypot(w - 0.1, h - 0.7), brace = new BoxGeometry(len, 0.03, 0.025);
  brace.rotateZ(Math.atan2(h - 0.7, w - 0.1)); brace.translate(w / 2, h / 2 + 0.1, 0); parts.push(brace);
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
}

function Gate({ mats }: { mats: Mats }) {
  const hw = GATE.halfWidth, y0 = groundHeight(0, GATE.z);
  const leaf = useMemo(() => leafGeometry(hw - 0.06, 2.45), [hw]);
  const arch = useMemo(() => {
    const parts: BufferGeometry[] = [];
    for (const [r, t] of [[hw + 0.05, 0.03], [hw - 0.25, 0.022]] as const) { const a = new TorusGeometry(r, t, 8, 48, Math.PI); a.scale(1, 0.32, 1); parts.push(a); }
    for (let i = -3; i <= 3; i++) { const g = new TorusGeometry(0.11, 0.012, 6, 20); g.translate(i * 0.55, 0.42 - Math.abs(i) * 0.06 + (Math.abs(i) > 2 ? -0.12 : 0), 0); parts.push(g); }
    return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  }, [hw]);
  // left leaf hangs open, inward, sagging; right leaf almost shut
  const open = -1.15, shut = 0.12;
  return (
    <group>
      <Pillar x={-(hw + GATE.pillar / 2)} mats={mats} />
      <Pillar x={hw + GATE.pillar / 2} mats={mats} finial={false} />
      {/* the fallen finial in the grass */}
      <mesh material={mats.stone} position={[hw + 1.6, groundHeight(hw + 1.6, GATE.z - 1.4) + 0.2, GATE.z - 1.4]} rotation={[0.4, 0.9, 0.3]} castShadow><sphereGeometry args={[0.27, 24, 16]} /></mesh>
      <group position={[-hw, y0, GATE.z]} rotation={[0, open, 0.035]}><mesh geometry={leaf} material={mats.iron} castShadow /></group>
      <group position={[hw, y0, GATE.z]} rotation={[0, Math.PI - shut, -0.02]}><mesh geometry={leaf} material={mats.iron} castShadow /></group>
      <mesh geometry={arch} material={mats.iron} position={[0, y0 + 2.95, GATE.z]} castShadow />
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        <CuboidCollider args={[0.65, 2.1, 0.65]} position={[-(hw + 0.5), y0 + 2, GATE.z]} />
        <CuboidCollider args={[0.65, 2.1, 0.65]} position={[hw + 0.5, y0 + 2, GATE.z]} />
        {/* the shut leaf, and the open one where it hangs */}
        <CuboidCollider args={[(hw - 0.1) / 2, 1.3, 0.05]} position={[hw - Math.cos(shut) * (hw - 0.1) / 2, y0 + 1.3, GATE.z + Math.sin(shut) * (hw - 0.1) / 2]} rotation={[0, -shut, 0]} />
        <CuboidCollider args={[(hw - 0.1) / 2, 1.3, 0.05]} position={[-hw + Math.cos(open) * (hw - 0.1) / 2, y0 + 1.3, GATE.z - Math.sin(open) * (hw - 0.1) / 2]} rotation={[0, open, 0]} />
      </RigidBody>
    </group>
  );
}

// ------------------------------------------------------------------------------------- the boundary wall + railing
function Boundary({ mats }: { mats: Mats }) {
  const runs = useMemo(() => {
    // from the pillars out to the cliff tops, both sides
    const end = (sx: number) => { let x = 3.2; while (islandRn(sx * x, GATE.z) < 0.95 && x < 60) x += 0.25; return x; };
    return [-1, 1].map((sx) => ({ sx, from: GATE.halfWidth + GATE.pillar + 0.05, to: end(sx) }));
  }, []);
  const { bars, tips, posts, base, coping, rubble } = useMemo(() => {
    const bars: Matrix4[] = [], tips: Matrix4[] = [], posts: Matrix4[] = [], base: Matrix4[] = [], coping: Matrix4[] = [], rubble: Matrix4[] = [];
    const d = new Object3D(), r = rng(7);
    for (const { sx, from, to } of runs) {
      for (let x = from; x < to; x += 0.5) {
        const X = sx * (x + 0.25), y = groundHeight(X, GATE.z);
        const collapsed = sx < 0 && x > 10 && x < 14.5;
        const h = collapsed ? 0.15 + r() * 0.3 : 0.8;
        d.position.set(X, y + h / 2 - 0.1, GATE.z); d.rotation.set(0, 0, 0); d.scale.set(0.52, h + 0.2, 0.46); d.updateMatrix(); base.push(d.matrix.clone());
        if (!collapsed) { d.position.set(X, y + 0.74, GATE.z); d.scale.set(0.52, 0.09, 0.58); d.updateMatrix(); coping.push(d.matrix.clone()); }
        else for (let k = 0; k < 3; k++) {           // tumbled blocks
          d.position.set(X + (r() - 0.5) * 0.6, y + 0.12, GATE.z + (r() - 0.3) * 1.6); d.rotation.set(r() * 0.6, r() * 3, r() * 0.6);
          const s = 0.22 + r() * 0.2; d.scale.set(s * 1.4, s, s); d.updateMatrix(); rubble.push(d.matrix.clone());
        }
      }
      for (let x = from + 0.1; x < to; x += 3) {
        const X = sx * x, y = groundHeight(X, GATE.z), gone = sx < 0 && x > 9.5 && x < 15;
        if (gone) continue;
        d.position.set(X, y + 1.05, GATE.z); d.rotation.set(0, 0, 0); d.scale.set(0.5, 1.3, 0.5); d.updateMatrix(); posts.push(d.matrix.clone());
      }
      for (let x = from + 0.2; x < to; x += 0.14) {
        const X = sx * x, y = groundHeight(X, GATE.z);
        if (sx < 0 && x > 9.5 && x < 15) continue;                       // the collapsed stretch: no railing
        if (r() < 0.05) continue;                                        // a missing bar here and there
        const bent = sx > 0 && x > 8.8 && x < 10.6, lean = bent ? (0.35 + r() * 0.4) * (r() < 0.5 ? 1 : -1) : (r() - 0.5) * 0.03;
        d.position.set(X, y + 0.8, GATE.z); d.rotation.set(lean, 0, (r() - 0.5) * 0.04); d.scale.set(1, 1, 1); d.updateMatrix();
        const bm = d.matrix.clone().multiply(m4.makeTranslation(0, 0.62, 0)); bars.push(bm);
        tips.push(d.matrix.clone().multiply(m4.makeTranslation(0, 1.3, 0)));
      }
    }
    return { bars, tips, posts, base, coping, rubble };
  }, [runs]);
  const inst = (geo: BufferGeometry, mat: MeshStandardMaterial, ms: Matrix4[], shadow = true) => {
    const im = new InstancedMesh(geo, mat, ms.length); ms.forEach((mm, i) => im.setMatrixAt(i, mm)); im.castShadow = shadow; im.receiveShadow = true; return im;
  };
  const meshes = useMemo(() => [
    inst(new BoxGeometry(1, 1, 1), mats.stone, base), inst(new BoxGeometry(1, 1, 1), mats.stone, coping), inst(new BoxGeometry(1, 1, 1), mats.stone, posts),
    inst(new BoxGeometry(1, 1, 1), mats.stone, rubble), inst(new CylinderGeometry(0.013, 0.013, 1.24, 6), mats.iron, bars), inst(new ConeGeometry(0.028, 0.12, 6), mats.iron, tips, false),
  ], [base, coping, posts, rubble, bars, tips, mats]);
  // two lengths of fallen railing in the grass by the collapse
  const fallen = useMemo(() => leafGeometry(1.6, 1.25), []);
  return (
    <>
      {meshes.map((m, i) => <primitive key={i} object={m} />)}
      <mesh geometry={fallen} material={mats.iron} position={[-12.4, groundHeight(-12.4, 22.6) + 0.06, 22.6]} rotation={[-Math.PI / 2 + 0.08, 0.5, 0]} castShadow />
      <mesh geometry={fallen} material={mats.iron} position={[-10.6, groundHeight(-10.6, 25.4) + 0.3, 25.4]} rotation={[-1.2, -0.3, 0.2]} castShadow />
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        {runs.map(({ sx, from, to }) => {
          const segs: [number, number, number][] = sx < 0 ? [[from, 9.6, 2.1], [9.6, 14.6, 0.55], [14.6, to, 2.1]] : [[from, to, 2.1]];
          return segs.map(([a, b, h], i) => <CuboidCollider key={`${sx}-${i}`} args={[(b - a) / 2, h / 2, 0.3]} position={[sx * (a + b) / 2, groundHeight(sx * (a + b) / 2, GATE.z) + h / 2 - 0.1, GATE.z]} />);
        })}
      </RigidBody>
    </>
  );
}

// ------------------------------------------------------------------------------------------------- lamp posts
function Lamps({ mats }: { mats: Mats }) {
  const lights = useRef<(PointLight | null)[]>([]);
  const glass = useMemo(() => LAMPS.map(([, , s]) => new MeshStandardMaterial({ color: new Color('#2a2620'), emissive: new Color('#ffb066'), emissiveIntensity: s === 'off' ? 0 : 2.2, roughness: 0.3, transparent: true, opacity: 0.85 })), []);
  // a soft glow round each lit lantern, in the damp air
  const halo = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d')!, g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,190,120,0.55)'); g.addColorStop(0.25, 'rgba(255,160,90,0.18)'); g.addColorStop(1, 'rgba(255,140,70,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
    return LAMPS.map(() => new SpriteMaterial({ map: t, blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  }, []);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    LAMPS.forEach(([, , s], i) => {
      if (s === 'off') return;
      let k = 0.9 + 0.06 * Math.sin(t * 7.3 + i) + 0.04 * Math.sin(t * 13.1 + i * 2);
      if (s === 'flicker') {
        // a failing lamp: steady for a while, then a burst of stutters and short blackouts
        const phase = (t + i * 3.7) % 9;
        if (phase > 6.2) { const n = Math.sin(t * 47 + i) * Math.sin(t * 23.3); k *= n > 0.15 ? 1 : n > -0.4 ? 0.35 : 0.02; }
      }
      const l = lights.current[i]; if (l) l.intensity = 7 * k;
      glass[i].emissiveIntensity = 2.2 * k; halo[i].opacity = Math.min(1, k);
    });
  });
  return (
    <>
      {LAMPS.map(([x, z, s], i) => {
        const y = groundHeight(x, z), side = x < 0 ? 1 : -1;
        return (
          <group key={i} position={[x, y, z]}>
            <mesh material={mats.iron} position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.1, 0.16, 0.5, 12]} /></mesh>
            <mesh material={mats.iron} position={[0, 1.75, 0]} castShadow><cylinderGeometry args={[0.04, 0.055, 3.0, 10]} /></mesh>
            <mesh material={mats.iron} position={[side * 0.28, 3.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.022, 0.022, 0.6, 8]} /></mesh>
            <group position={[side * 0.55, 2.95, 0]} rotation={[0, 0, s === 'off' ? side * 0.18 : 0]}>
              <mesh material={glass[i]} position={[0, 0, 0]}><boxGeometry args={[0.24, 0.34, 0.24]} /></mesh>
              {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], k) => <mesh key={k} material={mats.iron} position={[a * 0.125, 0, b * 0.125]}><boxGeometry args={[0.02, 0.38, 0.02]} /></mesh>)}
              <mesh material={mats.iron} position={[0, 0.25, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[0.24, 0.18, 4]} /></mesh>
              <mesh material={mats.iron} position={[0, -0.19, 0]}><boxGeometry args={[0.28, 0.04, 0.28]} /></mesh>
              {s !== 'off' && <pointLight ref={(l) => { lights.current[i] = l; }} color="#ffad5e" intensity={7} distance={13} decay={2} />}
              {s !== 'off' && <sprite material={halo[i]} scale={1.5} raycast={() => {}} />}
            </group>
          </group>
        );
      })}
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        {LAMPS.map(([x, z], i) => <CylinderCollider key={i} args={[1.6, 0.14]} position={[x, groundHeight(x, z) + 1.6, z]} />)}
      </RigidBody>
    </>
  );
}

// ------------------------------------------------------------------------------------------------- dead trees
function Trees({ mats }: { mats: Mats }) {
  const shapes = useMemo(() => [deadTree(11), deadTree(29), deadTree(53)], []);
  return (
    <>
      {TREES.map(([x, z, s, v, turn], i) => (
        <mesh key={i} geometry={shapes[v]} material={mats.bark} position={[x, groundHeight(x, z), z]} rotation={[0, turn, 0]} scale={s} castShadow receiveShadow />
      ))}
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        {TREES.map(([x, z, s], i) => <CylinderCollider key={i} args={[1.5, 0.32 * s]} position={[x, groundHeight(x, z) + 1.5, z]} />)}
      </RigidBody>
    </>
  );
}

// ------------------------------------------------------------------------------------------------- the mansion
/** windows: [x, y, z-face, kind] on the front (z faces south) */
type Win = { p: [number, number, number]; w: number; h: number; lit?: 'warm' | 'cold' | 'flicker'; boarded?: boolean; ry?: number };
function Mansion({ mats }: { mats: Mats }) {
  const y = MANSION.y, z = MANSION.z;
  const front = z + 6;                                      // the main block's south face
  const S = 1.35;                                           // the house is built 1:1 and scaled up from its front face
  const sc = (px: number, py: number, pz: number): [number, number, number] => [px * S, y + (py - y) * S, front + (pz - front) * S];
  const wins = useMemo(() => {
    const out: Win[] = [];
    for (let i = 0; i < 7; i++) {
      const x = -9 + i * 3; if (Math.abs(x) < 2) continue;  // the porch is in the middle
      out.push({ p: [x, y + 2.6, front + 0.06], w: 1.1, h: 2.0, boarded: i === 1 });
      out.push({ p: [x, y + 7.0, front + 0.06], w: 1.1, h: 2.0, lit: i === 5 ? 'flicker' : i === 2 ? 'warm' : undefined });
    }
    out.push({ p: [0, y + 7.0, front + 0.06], w: 1.4, h: 2.3 });
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = sx * (11.5 + i * 3); out.push({ p: [x, y + 2.4, z + 9.06], w: 1.0, h: 1.9, boarded: sx > 0 && i === 2 });
      out.push({ p: [x, y + 6.2, z + 9.06], w: 1.0, h: 1.9, lit: sx < 0 && i === 1 ? 'cold' : undefined });
    }
    out.push({ p: [-6, y + 13.5, z + 4.56], w: 0.9, h: 1.7, lit: 'cold' });
    return out;
  }, [y, z, front]);
  const litMats = useMemo(() => ({
    warm: new MeshStandardMaterial({ color: '#100c08', emissive: new Color('#ff9a4a'), emissiveIntensity: 0.9, roughness: 0.4 }),
    flicker: new MeshStandardMaterial({ color: '#100c08', emissive: new Color('#ffb070'), emissiveIntensity: 0.7, roughness: 0.4 }),
    cold: new MeshStandardMaterial({ color: '#080a0d', emissive: new Color('#8fb2d6'), emissiveIntensity: 0.35, roughness: 0.4 }),
  }), []);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const n = Math.sin(t * 3.1) * Math.sin(t * 7.7 + 1) * Math.sin(t * 0.37);
    litMats.flicker.emissiveIntensity = n > 0.2 ? 0.05 : 0.7 + 0.2 * Math.sin(t * 11);
    litMats.cold.emissiveIntensity = 0.3 + 0.08 * Math.sin(t * 0.6);
  });
  const mainRoof = useMemo(() => gable(24, 5.2, 12), []), wingRoof = useMemo(() => { const g = gable(18, 4.4, 10); g.rotateY(Math.PI / 2); return g; }, []);
  const porchRoof = useMemo(() => gable(6.4, 1.6, 3.6), []);
  const B = ({ p, s, mat = mats.wall }: { p: [number, number, number]; s: [number, number, number]; mat?: MeshStandardMaterial }) => (
    <mesh material={mat} position={p} castShadow receiveShadow><boxGeometry args={s} /></mesh>
  );
  return (
    <group>
      {/* the terrace and its steps */}
      <B p={[0, y - 0.5, z]} s={[50, 1.2, 24]} mat={mats.stone} />
      {/* the house itself, built at 1:1 below and scaled up from its front face: a grand estate, not a cottage */}
      <group position={[0, y, front]} scale={S}><group position={[0, -y, -front]}>
      {/* main block: a hollow shell (the rooms inside are House.tsx), with the front door's opening; its east side is
          inside the east wing, which is hollow too (the stairs down are in it) */}
      <B p={[-6.463, y + 5.5, front - 0.15]} s={[11.074, 11, 0.3]} />
      <B p={[6.463, y + 5.5, front - 0.15]} s={[11.074, 11, 0.3]} />
      <B p={[0, y + 6.98, front - 0.15]} s={[1.852, 8.04, 0.3]} />
      <B p={[0, y + 5.5, z - 5.85]} s={[24, 11, 0.3]} />
      <B p={[-11.85, y + 5.5, z]} s={[0.3, 11, 12]} />
      <B p={[0, y + 10.85, z]} s={[24, 0.3, 12]} />
      <mesh geometry={mainRoof} material={mats.roof} position={[0, y + 11, z]} castShadow />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          {/* the west wing is solid, but stops at the main block's west wall (-12): any further and it stood 2.5 m
              inside the living room, hiding that end of it */}
          {sx < 0 ? <B p={[-16, y + 4.5, z + 0.0]} s={[8, 9, 18]} /> : (
            <>
              <B p={[19.85, y + 4.5, z]} s={[0.3, 9, 18]} />
              <B p={[15, y + 4.5, z + 8.85]} s={[10, 9, 0.3]} />
              <B p={[15, y + 4.5, z - 8.85]} s={[10, 9, 0.3]} />
              <B p={[15, y + 8.85, z]} s={[10, 0.3, 18]} />
            </>
          )}
          <mesh geometry={wingRoof} material={mats.roof} position={[sx * 15, y + 9, z]} castShadow />
          <B p={[sx * 17.5, y + 13.2, z - 3]} s={[1.1, 4, 1.1]} mat={mats.stone} />
        </group>
      ))}
      <B p={[-6, y + 14, z - 1.5]} s={[5, 6, 12]} />
      <mesh material={mats.roof} position={[-6, y + 19.6, z - 1.5]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[4.4, 5.4, 4]} /></mesh>
      <B p={[6.5, y + 13.5, z - 2]} s={[1.2, 5, 1.2]} mat={mats.stone} />
      <B p={[-1.5, y + 14.2, z + 1]} s={[1.0, 3.6, 1.0]} mat={mats.stone} />
      {/* string course and cornice */}
      <B p={[0, y + 4.8, front + 0.12]} s={[24.4, 0.25, 0.3]} mat={mats.stone} />
      <B p={[0, y + 10.9, front + 0.2]} s={[24.8, 0.35, 0.45]} mat={mats.stone} />
      {/* two lanterns either side of the door, still burning */}
      {[-1.7, 1.7].map((x) => (
        <group key={`pl${x}`} position={[x, y + 2.6, front + 0.2]}>
          <mesh><boxGeometry args={[0.22, 0.34, 0.22]} /><meshStandardMaterial color="#221a12" emissive="#ffad5e" emissiveIntensity={2.4} /></mesh>
          <pointLight color="#ffad5e" intensity={6} distance={9} decay={2} position={[0, 0, 0.3]} />
        </group>
      ))}
      {/* the porch: columns, a pediment, the door */}
      {[-2.6, -0.9, 0.9, 2.6].map((x) => <mesh key={x} material={mats.stone} position={[x, y + 2.2, front + 2.6]} castShadow><cylinderGeometry args={[0.26, 0.3, 4.4, 20]} /></mesh>)}
      <B p={[0, y + 4.6, front + 1.6]} s={[6.6, 0.45, 3.8]} mat={mats.stone} />
      <mesh geometry={porchRoof} material={mats.roof} position={[0, y + 4.82, front + 1.6]} castShadow />
      {wins.map((w, i) => (
        <group key={i} position={w.p}>
          <mesh material={mats.stone} position={[0, 0, -0.02]}><boxGeometry args={[w.w + 0.3, w.h + 0.3, 0.12]} /></mesh>
          <mesh material={w.lit ? litMats[w.lit] : mats.glass} position={[0, 0, 0.05]}><planeGeometry args={[w.w, w.h]} /></mesh>
          <mesh material={mats.iron} position={[0, 0, 0.07]}><boxGeometry args={[0.05, w.h, 0.02]} /></mesh>
          <mesh material={mats.iron} position={[0, w.h * 0.15, 0.07]}><boxGeometry args={[w.w, 0.05, 0.02]} /></mesh>
          {w.boarded && [-0.5, 0, 0.45].map((o, k) => <mesh key={k} material={mats.wood} position={[0, o * w.h, 0.11]} rotation={[0, 0, (k - 1) * 0.18]}><boxGeometry args={[w.w + 0.35, 0.18, 0.04]} /></mesh>)}
        </group>
      ))}
      </group></group>
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        {/* the main block's walls (the door opening left free) and the east wing's outer walls */}
        <CuboidCollider args={[7.475, 7.5, 0.25]} position={[-8.725, y + 7.4, front - 0.2]} />
        <CuboidCollider args={[7.475, 7.5, 0.25]} position={[8.725, y + 7.4, front - 0.2]} />
        <CuboidCollider args={[1.25, 5.5, 0.25]} position={[0, y + 4.0 + 5.5, front - 0.2]} />
        <CuboidCollider args={[16.2, 7.5, 0.25]} position={[0, y + 7.4, HOUSE.back + 0.2]} />
        <CuboidCollider args={[0.25, 7.5, 8.1]} position={[HOUSE.west + 0.2, y + 7.4, (front + HOUSE.back) / 2]} />
        <CuboidCollider args={[5 * S, 5 * S, 9 * S]} position={sc(-15, y + 4.5, z)} />
        <CuboidCollider args={[0.25, 6, 9 * S]} position={[sc(19.85, y, z)[0], y + 6.2, sc(19.85, y, z)[2]]} />
        <CuboidCollider args={[5 * S, 6, 0.25]} position={sc(15, y + 4.5, z + 8.85)} />
        <CuboidCollider args={[5 * S, 6, 0.25]} position={sc(15, y + 4.5, z - 8.85)} />
        {/* the terrace, with the stairwell left open */}
        <CuboidCollider args={[20.1, 0.6, 12]} position={[-4.9, y - 0.5, z]} />
        <CuboidCollider args={[4.9, 0.6, 2.4]} position={[20.1, y - 0.5, -71.6]} />
        <CuboidCollider args={[4.9, 0.6, 7.75]} position={[20.1, y - 0.5, -57.75]} />
        {[-2.6, -0.9, 0.9, 2.6].map((x) => <CylinderCollider key={x} args={[2.2 * S, 0.3 * S]} position={sc(x, y + 2.2, front + 2.6)} />)}
      </RigidBody>
    </group>
  );
}

// --------------------------------------------------------------------------------------------------- low fog
const FOG_NOISE = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.07 + 9.2; a *= 0.5; } return s; }`;
export function GroundFog() {
  const layers = useMemo(() => [0.25, 0.75, 1.45].map((h, i) => {
    const m = new ShaderMaterial({
      transparent: true, depthWrite: false, side: DoubleSide, fog: true,
      uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 }, uH: { value: h }, uI: { value: i }, uFlash: { value: 0 }, uColor: { value: new Color('#5d6878') } }]),
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        varying vec3 vW;
        void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uH, uI, uFlash; uniform vec3 uColor;
        varying vec3 vW;
        #include <fog_pars_fragment>
        ${FOG_NOISE}
        float rnOf(vec2 p) { vec2 q = vec2(p.x / 42.0, (p.y + 12.0) / 70.0); return length(q); }
        void main() {
          // never inside the house, the stair tunnel or over the ledge below the cliffs (it would hang there as a sheet)
          if (vW.x > -17.0 && vW.x < 40.0 && vW.z < -55.6 && vW.z > -79.0) discard;
          vec2 p = vW.xz;
          float n = fbm(p * (0.06 + uI * 0.03) + vec2(uTime * (0.05 + uI * 0.02), uTime * 0.017));
          float n2 = fbm(p * 0.21 - vec2(uTime * 0.03, 0.0) + uI * 7.0);
          float d = smoothstep(0.38, 0.85, n * 0.8 + n2 * 0.4);
          float sea = smoothstep(0.85, 1.15, rnOf(p));                   // thicker towards the sea
          float near = smoothstep(1.5, 7.0, distance(cameraPosition, vW));  // nothing right in the face
          float a = d * (0.16 - uI * 0.035 + sea * 0.22) * near;
          gl_FragColor = vec4(uColor * (0.55 + 0.25 * n2) + vec3(0.35, 0.4, 0.5) * uFlash * 0.6, a);
          #include <fog_fragment>
        }`,
    });
    return m;
  }), []);
  useFrame((st) => layers.forEach((m) => { m.uniforms.uTime.value = st.clock.elapsedTime; m.uniforms.uFlash.value = lightningState.k; }));
  return (
    <>
      {layers.map((m, i) => (
        <mesh key={i} material={m} rotation-x={-Math.PI / 2} position={[0, (i === 0 ? 0.25 : i === 1 ? 0.75 : 1.45) + 0.1, -12]} renderOrder={5} raycast={() => {}}>
          <planeGeometry args={[240, 300]} />
        </mesh>
      ))}
    </>
  );
}

// -------------------------------------------------------------------------------- the figure (seen in a flash)
/** something tall standing beside the avenue beyond the gate, under the dead lamp, seen only while the lightning lasts during the
 *  opening (Intro.tsx shows it): elongated, narrow-shouldered, arms hanging past the knees, the head tipped.
 *  Pure light-absorbing black: a silhouette against the lit fog, never a lit model. */
export function Figure({ show }: { show: { current: boolean } }) {
  const g = useRef<Group>(null);
  const mat = useMemo(() => new MeshBasicMaterial({ color: '#000000', fog: false }), []);
  const parts = useMemo(() => {
    const L: BufferGeometry[] = [];
    const seg = (a: [number, number, number], b: [number, number, number], r0: number, r1: number) => L.push(limb(new Vector3(...a), new Vector3(...b), r0, r1, 8));
    seg([-0.13, 0, 0.02], [-0.11, 1.25, 0], 0.07, 0.09); seg([-0.11, 1.25, 0], [-0.12, 2.3, 0.04], 0.09, 0.11);   // legs
    seg([0.13, 0, -0.03], [0.12, 1.25, 0.02], 0.07, 0.09); seg([0.12, 1.25, 0.02], [0.12, 2.3, 0.04], 0.09, 0.11);
    seg([0, 2.25, 0.03], [0.02, 2.95, 0.06], 0.17, 0.15);  // hips, belly
    seg([0.02, 2.95, 0.06], [0.0, 3.35, 0.12], 0.15, 0.17);   // chest, hunched forward
    seg([0.0, 3.35, 0.12], [0.06, 3.55, 0.26], 0.06, 0.05);   // neck, craned
    seg([-0.17, 3.3, 0.1], [-0.24, 2.3, 0.18], 0.05, 0.045); seg([-0.24, 2.3, 0.18], [-0.27, 1.25, 0.12], 0.045, 0.035);   // long arms
    seg([0.17, 3.3, 0.1], [0.25, 2.35, 0.16], 0.05, 0.045); seg([0.25, 2.35, 0.16], [0.3, 1.3, 0.2], 0.045, 0.035);
    seg([-0.27, 1.25, 0.12], [-0.29, 0.95, 0.14], 0.035, 0.01); seg([0.3, 1.3, 0.2], [0.33, 1.0, 0.24], 0.035, 0.01);   // fingers
    const head = new SphereGeometry(0.15, 12, 10); head.scale(0.85, 1.25, 1); head.rotateZ(0.5); head.translate(0.1, 3.68, 0.32); L.push(head.toNonIndexed());
    return mergeGeometries(L.map((p) => (p.index ? p.toNonIndexed() : p)));
  }, []);
  useFrame(() => { if (g.current) g.current.visible = show.current && lightningState.k > 0.12; });
  const x = 3.7, z = 8.6;
  return <group ref={g} position={[x, groundHeight(x, z) - 0.05, z]} rotation={[0, -0.12, 0]} visible={false}><mesh geometry={parts} material={mat} /></group>;
}

export function Estate() {
  const mats = useEstateMaterials();
  return (
    <>
      <Gate mats={mats} />
      <Boundary mats={mats} />
      <Lamps mats={mats} />
      <Trees mats={mats} />
      <Mansion mats={mats} />
    </>
  );
}

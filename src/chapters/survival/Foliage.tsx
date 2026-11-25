/* Vegetation for Chapter 01: foliage.glb holds one root node per plant variant (weeds, nettles, shrubs, calathea,
   anthurium, saplings), and layout.json lists where each variant grows ([x, y, z, yaw, scale]). Grass is procedural
   carabao grass (fineGrass.ts) at the grass variants' positions.
   Every mesh of every variant becomes one InstancedMesh, so ~17k plants cost about one draw call per mesh.

   Distance: everything within 22 m, then a density that thins smoothly to 20% at the radius (ground cover 55 m,
   larger plants 120 m). Each plant has a fixed random threshold, and plants near their threshold are scaled down,
   so as the visitor walks plants grow in and out gradually rather than popping. Re-selected every 1.5 m walked.
   Low quality halves the ground cover and shortens the radii; only shrubs and saplings cast shadows (high).
   Every plant sways in the wind (rendering/wind.ts), except with reduced motion. */
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Euler, InstancedMesh, Matrix4, Quaternion, Sphere, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { getGame } from '../../game/GameState';
import { playerState } from '../../player/playerState';
import { ignoreRaycast } from '../../rendering/bvh';
import { applyWeather } from '../../rendering/weather';
import { applyWind, wind } from '../../rendering/wind';
import { useBudget } from '../../rendering/adaptive';
import { commit, makeCullable, releaseCullable, type Cullable } from '../../rendering/instanceCulling';
import { carabaoGrass } from './fineGrass';
import { SURVIVAL_BASE, type SurvivalLayout } from './layout';

const GROUND_COVER = /^(grass|weed|nettle)__/;
const CASTS_SHADOW = /^(shrub|sapling)__/;
const RESELECT_AFTER = 1.5;    // metres moved before the visible set is rebuilt
const NEAR_FULL = 22;          // m: full density; beyond it the density thins smoothly to FAR_DENSITY at the radius
const FAR_DENSITY = 0.2;
const GROW = 0.08;             // density margin over which a plant grows in from nothing (no popping)

interface Batch { mesh: InstancedMesh; matrices: Float32Array; xz: Float32Array; radius: number; near: number; luck: Float32Array; cull?: Cullable }

export function Foliage({ layout, quality: tier }: { layout: SurvivalLayout; quality: 'high' | 'medium' | 'low' }) {
  const { scene } = useGLTF(`${SURVIVAL_BASE}/foliage.glb`, false, true);
  // the adaptive budget's lightest step thins the ground cover as Low does (rendering/adaptive.ts)
  const quality = useBudget().cover === 'half' ? 'low' : tier;

  const batches = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out: Batch[] = [];
    const inst = new Matrix4(), rel = new Matrix4(), inv = new Matrix4();
    const q = new Quaternion(), e = new Euler(), p = new Vector3(), s = new Vector3();
    for (const [variant, list] of Object.entries(layout.foliage)) {
      // every grass variant is drawn as procedural carabao grass (fine, low, dense) instead of the broad scanned tufts
      const grassNo = variant.match(/^grass__(\d+)$/)?.[1];
      const root = grassNo !== undefined ? carabaoGrass()[Number(grassNo) % 3] : scene.getObjectByName(variant);
      if (!root || !list.length) continue;
      const cover = GROUND_COVER.test(variant);
      const keep = quality === 'low' && cover ? list.filter((_, i) => i % 2 === 0) : list;
      const radius = (cover ? 55 : 120) * (quality === 'low' ? 0.7 : 1);
      const xz = new Float32Array(keep.length * 2);
      keep.forEach(([x, , z], i) => { xz[i * 2] = x; xz[i * 2 + 1] = z; });
      inv.copy(root.matrixWorld).invert();
      root.traverse((o: Object3D) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        rel.multiplyMatrices(inv, m.matrixWorld);                     // mesh relative to its variant's origin
        const matrices = new Float32Array(keep.length * 16);
        keep.forEach(([x, y, z, yaw, k], i) => {
          inst.compose(p.set(x, y, z), q.setFromEuler(e.set(0, yaw, 0)), s.setScalar(k)).multiply(rel).toArray(matrices, i * 16);
        });
        applyWind(m.material as Material);
        applyWeather(m.material as Material);
        const im = new InstancedMesh(m.geometry, m.material as Material, keep.length);
        im.count = 0;
        im.frustumCulled = false;                                     // bounded by the radius instead
        im.castShadow = quality === 'high' && CASTS_SHADOW.test(variant);
        im.receiveShadow = true;
        im.name = `foliage:${variant}`;
        ignoreRaycast(im);                                            // thin plants never block a look-at or focus
        // each plant's fixed "luck" decides how far out it still shows (stable: the same plants every frame)
        const luck = Float32Array.from({ length: keep.length }, (_, i) => { const h = Math.sin(i * 12.9898 + keep[i][0] * 78.233 + keep[i][2] * 37.719) * 43758.5453; return h - Math.floor(h); });
        // drawn only where the camera looks (rendering/instanceCulling.ts); shadow casters are always drawn whole
        out.push({ mesh: im, matrices, xz, radius, near: NEAR_FULL * (quality === 'low' ? 0.7 : 1), luck, cull: im.castShadow ? undefined : makeCullable(im) });
      });
    }
    return out;
  }, [scene, layout, quality]);

  // pick the instances to draw: everything within `near`, then a density that thins smoothly to FAR_DENSITY at the
  // radius and to nothing just beyond it. A plant shows while its fixed luck is under the density at its distance;
  // within GROW of that threshold it is scaled down towards nothing, so plants grow in and out instead of popping.
  // Re-run after the visitor moves RESELECT_AFTER metres.
  const last = useRef({ x: Infinity, z: Infinity });
  const select = (px: number, pz: number) => {
    for (const b of batches) {
      const arr = b.cull ? b.cull.src : b.mesh.instanceMatrix.array as Float32Array, span = Math.max(1, b.radius - b.near);
      let n = 0;
      for (let i = 0; i < b.xz.length / 2; i++) {
        const d = Math.hypot(b.xz[i * 2] - px, b.xz[i * 2 + 1] - pz);
        if (d > b.radius + 8) continue;
        const t = Math.min(1, Math.max(0, (d - b.near) / span));
        let density = 1 - (1 - FAR_DENSITY) * t * t * (3 - 2 * t);
        if (d > b.radius) density *= 1 - (d - b.radius) / 8;                // fade out just beyond the radius
        const margin = density - b.luck[i];
        if (margin <= 0) continue;
        arr.set(b.matrices.subarray(i * 16, i * 16 + 16), n * 16);
        if (margin < GROW) {
          const k = margin / GROW, o = n * 16;
          for (const j of [0, 1, 2, 4, 5, 6, 8, 9, 10]) arr[o + j] *= k;     // grow from the base (plants sit on their origin)
        }
        n++;
      }
      if (b.cull) commit(b.cull, n);
      else { b.mesh.count = n; b.mesh.instanceMatrix.needsUpdate = true; }
      b.mesh.boundingSphere = new Sphere(new Vector3(px, 0, pz), b.radius + 18);
    }
    last.current = { x: px, z: pz };
  };
  useFrame((_, dt) => {
    wind.time.value += Math.min(Math.max(dt, 0), 0.1);
    wind.strength.value = getGame().settings.reducedMotion ? 0 : 1;
    const p = playerState.position;
    if (Math.hypot(p.x - last.current.x, p.z - last.current.z) > RESELECT_AFTER) select(p.x, p.z);
  });
  useEffect(() => { last.current = { x: Infinity, z: Infinity }; }, [batches]);

  // instanced meshes share the cached GLTF geometry/material, so only the instance buffers are freed here
  useEffect(() => () => batches.forEach((b) => { releaseCullable(b.cull); b.mesh.dispose(); }), [batches]);

  return <>{batches.map((b) => <primitive key={b.mesh.uuid} object={b.mesh} />)}</>;
}

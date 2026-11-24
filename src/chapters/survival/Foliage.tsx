/* Vegetation for Chapter 01: foliage.glb holds one root node per plant variant (grass, weeds, nettles, shrubs,
   calathea, anthurium, saplings), and layout.json lists where each variant grows ([x, y, z, yaw, scale]).
   Every mesh of every variant becomes one InstancedMesh, so ~17k plants cost about one draw call per mesh.

   Distance culling: the overcast fog swallows small plants within ~50 m, so each variant only draws the instances
   within its radius of the visitor (ground cover 42 m, larger plants 80 m). The visible set is re-selected
   whenever the visitor has moved a few metres, which keeps per-frame cost at zero.
   Low quality halves the ground cover and shortens the radii; only shrubs and saplings cast shadows. */
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Euler, InstancedMesh, Matrix4, Quaternion, Sphere, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { playerState } from '../../player/playerState';
import { SURVIVAL_BASE, type SurvivalLayout } from './layout';

const GROUND_COVER = /^(grass|weed|nettle)__/;
const CASTS_SHADOW = /^(shrub|sapling)__/;
const RESELECT_AFTER = 4;      // metres moved before the visible set is rebuilt

interface Batch { mesh: InstancedMesh; matrices: Float32Array; xz: Float32Array; radius: number }

export function Foliage({ layout, quality }: { layout: SurvivalLayout; quality: 'high' | 'low' }) {
  const { scene } = useGLTF(`${SURVIVAL_BASE}/foliage.glb`, false, true);

  const batches = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out: Batch[] = [];
    const inst = new Matrix4(), rel = new Matrix4(), inv = new Matrix4();
    const q = new Quaternion(), e = new Euler(), p = new Vector3(), s = new Vector3();
    for (const [variant, list] of Object.entries(layout.foliage)) {
      const root = scene.getObjectByName(variant);
      if (!root || !list.length) continue;
      const cover = GROUND_COVER.test(variant);
      const keep = quality === 'low' && cover ? list.filter((_, i) => i % 2 === 0) : list;
      const radius = (cover ? 42 : 80) * (quality === 'low' ? 0.75 : 1);
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
        const im = new InstancedMesh(m.geometry, m.material as Material, keep.length);
        im.count = 0;
        im.frustumCulled = false;                                     // bounded by the radius instead
        im.castShadow = quality === 'high' && CASTS_SHADOW.test(variant);
        im.receiveShadow = true;
        im.name = `foliage:${variant}`;
        out.push({ mesh: im, matrices, xz, radius });
      });
    }
    return out;
  }, [scene, layout, quality]);

  // pick the instances within each batch's radius; re-run after the visitor moves RESELECT_AFTER metres
  const last = useRef({ x: Infinity, z: Infinity });
  const select = (px: number, pz: number) => {
    for (const b of batches) {
      const arr = b.mesh.instanceMatrix.array as Float32Array, r2 = b.radius * b.radius;
      let n = 0;
      for (let i = 0; i < b.xz.length / 2; i++) {
        const dx = b.xz[i * 2] - px, dz = b.xz[i * 2 + 1] - pz;
        if (dx * dx + dz * dz < r2) { arr.set(b.matrices.subarray(i * 16, i * 16 + 16), n * 16); n++; }
      }
      b.mesh.count = n;
      b.mesh.instanceMatrix.needsUpdate = true;
      b.mesh.boundingSphere = new Sphere(new Vector3(px, 0, pz), b.radius + 10);
    }
    last.current = { x: px, z: pz };
  };
  useFrame(() => {
    const p = playerState.position;
    if (Math.hypot(p.x - last.current.x, p.z - last.current.z) > RESELECT_AFTER) select(p.x, p.z);
  });
  useEffect(() => { last.current = { x: Infinity, z: Infinity }; }, [batches]);

  // instanced meshes share the cached GLTF geometry/material, so only the instance buffers are freed here
  useEffect(() => () => batches.forEach((b) => b.mesh.dispose()), [batches]);

  return <>{batches.map((b) => <primitive key={b.mesh.uuid} object={b.mesh} />)}</>;
}

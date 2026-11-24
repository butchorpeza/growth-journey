/* Banana plants for Chapter 01: "Banana Plant" by evolveduk (Sketchfab, CC-BY 4.0, credited in CREDITS.md),
   instanced in clumps placed by scatter.ts.
   - Near the houses: the full model (banana.glb), shadows on High.
   - The hills (thousands of plants): the lighter banana_lod.glb within NEAR_3D of the visitor, and beyond that an
     impostor — two crossed cards showing a picture of the real model, rendered from it when the chapter loads
     (4 triangles instead of ~2,500). The 3D / card split is re-selected whenever the visitor has moved a few
     metres, as with the ground cover.
   Leaves sway in the wind and take the weather (cloud shadows, wetness); the plants never take part in raycasts. */
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AmbientLight, Box3, BufferGeometry, DoubleSide, Euler, Float32BufferAttribute, InstancedMesh, LinearMipmapLinearFilter, Matrix4,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, OrthographicCamera, Quaternion, Scene, Sphere, Vector3, WebGLRenderTarget,
  type Material, type Texture, type WebGLRenderer,
} from 'three';
import { playerState } from '../../player/playerState';
import { ignoreRaycast } from '../../rendering/bvh';
import { applyWeather } from '../../rendering/weather';
import { applyWind } from '../../rendering/wind';
import { SURVIVAL_BASE } from './layout';
import type { Inst } from './scatter';

const NEAR_3D = 18;          // m: real 3D plants within this distance, impostor cards beyond
const RESELECT_AFTER = 4;    // m moved before the 3D / card split is rebuilt

const toMatrix = (() => {
  const m = new Matrix4(), q = new Quaternion(), e = new Euler(), p = new Vector3(), s = new Vector3();
  return ([x, y, z, yaw, k]: Inst, rel: Matrix4, out: Float32Array, at: number) =>
    m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, yaw, 0)), s.setScalar(k)).multiply(rel).toArray(out, at * 16);
})();

function parts(scene: Scene | Mesh['parent']) {
  const out: Mesh[] = [];
  scene!.updateMatrixWorld(true);
  scene!.traverse((o) => { if ((o as Mesh).isMesh) out.push(o as Mesh); });
  return out;
}

/** picture of the plant (albedo + alpha), front view, for the impostor cards */
function renderImpostor(gl: WebGLRenderer, meshes: Mesh[]) {
  const box = new Box3(); meshes.forEach((m) => box.expandByObject(m));
  const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
  const w = Math.max(size.x, size.z, size.y) * 1.02;
  const scene = new Scene(); scene.add(new AmbientLight(0xffffff, 1));
  for (const m of meshes) {
    const src = m.material as MeshStandardMaterial;
    const flat = new Mesh(m.geometry, new MeshBasicMaterial({ map: src.map, alphaTest: 0.5, side: DoubleSide, color: src.color }));
    flat.matrixAutoUpdate = false; flat.matrix.copy(m.matrixWorld); scene.add(flat);
  }
  const cam = new OrthographicCamera(centre.x - w / 2, centre.x + w / 2, box.min.y + w, box.min.y, 0.01, 100);
  cam.position.set(0, 0, 50); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const rt = new WebGLRenderTarget(512, 512, { generateMipmaps: true, minFilter: LinearMipmapLinearFilter });
  const prev = gl.getRenderTarget(), clear = gl.getClearAlpha();
  gl.setRenderTarget(rt); gl.setClearAlpha(0); gl.clear(); gl.render(scene, cam);
  gl.setRenderTarget(prev); gl.setClearAlpha(clear);
  scene.traverse((o) => { if ((o as Mesh).isMesh) ((o as Mesh).material as Material).dispose(); });
  return { texture: rt.texture as Texture, rt, width: w, height: w, x0: centre.x - w / 2, y0: box.min.y };
}

/** two crossed vertical cards with up-facing normals (lit like a canopy), base at y = 0 */
function crossedCards(width: number, height: number, x0: number, y0: number) {
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
  for (let k = 0; k < 2; k++) {
    const a = (k * Math.PI) / 2, cx = Math.cos(a), cz = Math.sin(a), base = pos.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const x = x0 + u * width;
      pos.push(cx * x, y0 + v * height, cz * x); uv.push(u, v); nor.push(0, 1, 0);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}

/** village clumps: always 3D, full model */
function Near({ instances, shadows }: { instances: Inst[]; shadows: boolean }) {
  const { scene } = useGLTF(`${SURVIVAL_BASE}/banana.glb`, false, true);
  const meshes = useMemo(() => parts(scene).map((part) => {
    const mat = part.material as Material; applyWind(mat); applyWeather(mat);
    const im = new InstancedMesh(part.geometry, mat, instances.length);
    instances.forEach((t, i) => toMatrix(t, part.matrixWorld, im.instanceMatrix.array as Float32Array, i));
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    im.castShadow = shadows; im.receiveShadow = true; ignoreRaycast(im);
    return im;
  }), [scene, instances, shadows]);
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes]);
  return <>{meshes.map((m) => <primitive key={m.uuid} object={m} />)}</>;
}

/** the hills: 3D within NEAR_3D, impostor cards beyond */
function Field({ instances }: { instances: Inst[] }) {
  const { scene } = useGLTF(`${SURVIVAL_BASE}/banana_lod.glb`, false, true);
  const gl = useThree((s) => s.gl);

  const field = useMemo(() => {
    const meshes = parts(scene);
    const imp = renderImpostor(gl, meshes);
    const cardMat = new MeshStandardMaterial({ map: imp.texture, alphaTest: 0.5, side: DoubleSide, roughness: 0.8 });
    applyWind(cardMat); applyWeather(cardMat);
    const identity = new Matrix4();
    const cards = { mesh: new InstancedMesh(crossedCards(imp.width, imp.height, imp.x0, imp.y0), cardMat, instances.length), rel: identity };
    const solids = meshes.map((part) => {
      const mat = part.material as Material; applyWind(mat); applyWeather(mat);
      return { mesh: new InstancedMesh(part.geometry, mat, instances.length), rel: part.matrixWorld.clone() };
    });
    for (const b of [cards, ...solids]) { b.mesh.count = 0; b.mesh.frustumCulled = false; b.mesh.receiveShadow = true; ignoreRaycast(b.mesh); }
    return { cards, solids, rt: imp.rt, cardMat };
  }, [scene, gl, instances]);
  useEffect(() => () => { field.rt.dispose(); field.cardMat.dispose(); [field.cards, ...field.solids].forEach((b) => b.mesh.dispose()); }, [field]);

  const last = useRef({ x: Infinity, z: Infinity });
  useEffect(() => { last.current = { x: Infinity, z: Infinity }; }, [field]);
  useFrame(() => {
    const p = playerState.position;
    if (Math.hypot(p.x - last.current.x, p.z - last.current.z) < RESELECT_AFTER) return;
    last.current = { x: p.x, z: p.z };
    let n3 = 0, nc = 0;
    const r2 = NEAR_3D * NEAR_3D;
    for (const t of instances) {
      const dx = t[0] - p.x, dz = t[2] - p.z;
      if (dx * dx + dz * dz < r2) { for (const s of field.solids) toMatrix(t, s.rel, s.mesh.instanceMatrix.array as Float32Array, n3); n3++; }
      else { toMatrix(t, field.cards.rel, field.cards.mesh.instanceMatrix.array as Float32Array, nc); nc++; }
    }
    for (const s of field.solids) { s.mesh.count = n3; s.mesh.instanceMatrix.needsUpdate = true; s.mesh.boundingSphere = new Sphere(new Vector3(p.x, 0, p.z), NEAR_3D + 10); }
    field.cards.mesh.count = nc; field.cards.mesh.instanceMatrix.needsUpdate = true;
  });

  return <>{[field.cards, ...field.solids].map((b) => <primitive key={b.mesh.uuid} object={b.mesh} />)}</>;
}

export function Bananas({ near, far, quality }: { near: Inst[]; far: Inst[]; quality: 'high' | 'medium' | 'low' }) {
  const hills = useMemo(() => (quality === 'low' ? far.filter((_, i) => i % 2 === 0) : far), [far, quality]);
  return (
    <>
      <Near instances={near} shadows={quality === 'high'} />
      <Field instances={hills} />
    </>
  );
}

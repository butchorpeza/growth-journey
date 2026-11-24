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
import { applyFade, withFade } from '../../rendering/fade';
import { SURVIVAL_BASE } from './layout';
import type { Inst } from './scatter';

const NEAR_3D = 18;          // m: real 3D plants within this distance, impostor cards beyond
const FADE_BAND = 3.5;         // m: width of the dissolve between the full model and the card

export const toMatrix = (() => {
  const m = new Matrix4(), q = new Quaternion(), e = new Euler(), p = new Vector3(), s = new Vector3();
  return ([x, y, z, yaw, k]: Inst, rel: Matrix4, out: Float32Array, at: number) =>
    m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, yaw, 0)), s.setScalar(k)).multiply(rel).toArray(out, at * 16);
})();

export function parts(scene: Scene | Mesh['parent']) {
  const out: Mesh[] = [];
  scene!.updateMatrixWorld(true);
  scene!.traverse((o) => { if ((o as Mesh).isMesh) out.push(o as Mesh); });
  return out;
}

/** picture of the plant (albedo + alpha), front view, for the impostor cards */
export function renderImpostor(gl: WebGLRenderer, meshes: Mesh[], matrices: Matrix4[] = meshes.map((m) => m.matrixWorld)) {
  const box = new Box3();
  meshes.forEach((m, i) => { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox!.clone().applyMatrix4(matrices[i])); });
  const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
  const w = Math.max(size.x, size.z, size.y) * 1.02;
  const scene = new Scene(); scene.add(new AmbientLight(0xffffff, 1));
  meshes.forEach((m, i) => {
    const src = m.material as MeshStandardMaterial;
    const flat = new Mesh(m.geometry, new MeshBasicMaterial({ map: src.map, alphaTest: 0.5, side: DoubleSide, color: src.color }));
    flat.matrixAutoUpdate = false; flat.matrix.copy(matrices[i]); scene.add(flat);
  });
  const cam = new OrthographicCamera(centre.x - w / 2, centre.x + w / 2, box.min.y + w, box.min.y, 0.01, 100);
  cam.position.set(0, 0, 50); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const rt = new WebGLRenderTarget(1024, 1024, { generateMipmaps: true, minFilter: LinearMipmapLinearFilter, anisotropy: gl.capabilities.getMaxAnisotropy() });
  const prev = gl.getRenderTarget(), clear = gl.getClearAlpha();
  gl.setRenderTarget(rt); gl.setClearAlpha(0); gl.clear(); gl.render(scene, cam);
  gl.setRenderTarget(prev); gl.setClearAlpha(clear);
  scene.traverse((o) => { if ((o as Mesh).isMesh) ((o as Mesh).material as Material).dispose(); });
  return { texture: rt.texture as Texture, rt, width: w, height: w, x0: centre.x - w / 2, y0: box.min.y };
}

/** two crossed vertical cards, base at y = 0. Normals lean outwards from the plant and up (like the leaves of a
 *  rounded crown: the card's centre faces up, its edges face out), and a vertex colour darkens the lower part, the
 *  shade under the canopy; with straight-up normals the cards were lit like open ground and read pale. */
export function crossedCards(width: number, height: number, x0: number, y0: number) {
  const pos: number[] = [], uv: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  const n = new Vector3();
  for (let k = 0; k < 2; k++) {
    const a = (k * Math.PI) / 2, cx = Math.cos(a), cz = Math.sin(a), base = pos.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const x = x0 + u * width, out = (u - 0.5) * 2;               // -1 … 1 across the card
      pos.push(cx * x, y0 + v * height, cz * x); uv.push(u, v);
      n.set(cx * out * 0.8, 0.55 + 0.35 * v, cz * out * 0.8).normalize(); nor.push(n.x, n.y, n.z);
      const shade = 0.5 + 0.5 * v; col.push(shade, shade, shade);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.setIndex(idx);
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

/** a field of one plant: the 3D model within `near` metres of the visitor, impostor cards beyond. Models are
 *  normalised (centred, base on the ground) and scaled by `baseScale` before the instance's own yaw and scale. */
export function Field({ instances, url = `${SURVIVAL_BASE}/banana_lod.glb`, near = NEAR_3D, baseScale = 1, shadows = false }: { instances: Inst[]; url?: string; near?: number; baseScale?: number; shadows?: boolean }) {
  const { scene } = useGLTF(url, false, true);
  const gl = useThree((s) => s.gl);

  const field = useMemo(() => {
    const meshes = parts(scene);
    const all = new Box3(); meshes.forEach((m) => { m.geometry.computeBoundingBox(); all.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld)); });
    const c = all.getCenter(new Vector3());
    const norm = new Matrix4().makeScale(baseScale, baseScale, baseScale).multiply(new Matrix4().makeTranslation(-c.x, -all.min.y, -c.z));
    const rels = meshes.map((m) => norm.clone().multiply(m.matrixWorld));
    const imp = renderImpostor(gl, meshes, rels);
    // the crown shades itself: a slightly darker albedo and weaker sky reflection than the solid leaves
    const cardMat = new MeshStandardMaterial({ map: imp.texture, alphaTest: 0.5, side: DoubleSide, roughness: 0.92, vertexColors: true, color: 0x9a9a9a, envMapIntensity: 0.45 });
    applyWind(cardMat); applyWeather(cardMat); applyFade(cardMat, 'out');
    const identity = new Matrix4();
    const cardGeo = withFade(crossedCards(imp.width, imp.height, imp.x0, imp.y0), instances.length);
    const cards = { mesh: new InstancedMesh(cardGeo.geometry, cardMat, instances.length), rel: identity, fade: cardGeo.fade };
    const solids = meshes.map((part, i) => {
      const mat = part.material as Material; applyWind(mat); applyWeather(mat); applyFade(mat, 'in');
      const g = withFade(part.geometry, instances.length);
      return { mesh: new InstancedMesh(g.geometry, mat, instances.length), rel: rels[i], fade: g.fade };
    });
    for (const b of [cards, ...solids]) { b.mesh.count = 0; b.mesh.frustumCulled = false; b.mesh.receiveShadow = true; ignoreRaycast(b.mesh); }
    for (const s of solids) s.mesh.castShadow = shadows;
    return { cards, solids, rt: imp.rt, cardMat };
  }, [scene, gl, instances, baseScale, shadows]);
  useEffect(() => () => { field.rt.dispose(); field.cardMat.dispose(); [field.cards, ...field.solids].forEach((b) => b.mesh.dispose()); }, [field]);

  const last = useRef({ x: Infinity, z: Infinity });
  useEffect(() => { last.current = { x: Infinity, z: Infinity }; }, [field]);
  // every plant is always drawn, as the full model near the visitor and as a card beyond; across a FADE_BAND-wide
  // band at the `near` distance both are drawn and dissolve into each other (rendering/fade.ts). Re-selected every
  // metre walked, so the dissolve follows the visitor smoothly.
  useFrame(() => {
    const p = playerState.position;
    if (Math.hypot(p.x - last.current.x, p.z - last.current.z) < 1) return;
    last.current = { x: p.x, z: p.z };
    let n3 = 0, nc = 0;
    const lo = near - FADE_BAND / 2;
    for (const t of instances) {
      const d = Math.hypot(t[0] - p.x, t[2] - p.z);
      const f = Math.min(1, Math.max(0, 1 - (d - lo) / FADE_BAND));        // 1 = full model, 0 = card
      if (f > 0) { for (const s of field.solids) { toMatrix(t, s.rel, s.mesh.instanceMatrix.array as Float32Array, n3); s.fade.setX(n3, f); } n3++; }
      if (f < 1) { toMatrix(t, field.cards.rel, field.cards.mesh.instanceMatrix.array as Float32Array, nc); field.cards.fade.setX(nc, f); nc++; }
    }
    for (const s of field.solids) { s.mesh.count = n3; s.mesh.instanceMatrix.needsUpdate = true; s.fade.needsUpdate = true; s.mesh.boundingSphere = new Sphere(new Vector3(p.x, 0, p.z), near + FADE_BAND + 10); }
    field.cards.mesh.count = nc; field.cards.mesh.instanceMatrix.needsUpdate = true; field.cards.fade.needsUpdate = true;
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

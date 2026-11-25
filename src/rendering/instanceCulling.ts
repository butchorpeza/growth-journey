/* Per-instance frustum culling for instanced vegetation (ground cover, plants, the near 3D trees).
   An InstancedMesh is culled by three.js as one object: its bounding sphere covers every plant around the visitor,
   so the whole disc was drawn even though the camera sees a wedge of it (measured: 85–95% of the instanced
   triangles each frame were behind or beside the camera). Here each culled mesh keeps two buffers:
   - `src`: every instance its owner selected (distance / density / LOD choice, unchanged), written by the owner;
   - the mesh's own instance buffer: only the instances whose bounding sphere touches the camera's view, packed to
     the front, with `count` set to match. Per-instance attributes (the LOD dissolve `aFade`) are packed alongside.
   Culling runs in the scene's onBeforeRender, so it is exact for every camera that renders the scene (the main view,
   the post-processing passes, the panel snapshots), in the same frame, with no lag at the screen edges. It re-runs
   only when the camera or the selection has changed. Spheres are padded for the wind sway, so nothing visible is
   ever dropped: the image is identical. Shadow-casting meshes are never culled (an off-screen plant can still throw
   a shadow into view). */
import { Frustum, Matrix4, Sphere, type Camera, type InstancedBufferAttribute, type InstancedMesh, type Object3D } from 'three';

const PAD = 0.6;           // m added to every sphere: wind sway and the grow-in scaling never reach past it

export interface Cullable {
  mesh: InstancedMesh;
  /** the owner's selected instances (16 floats each); write here, then call commit() */
  src: Float32Array;
  /** per-instance attributes packed alongside the matrices: write the owner's values into `src` */
  extras: { src: Float32Array; attr: InstancedBufferAttribute }[];
  count: number;
  version: number;
  seen: number;            // version last culled
  camStamp: number;        // camera stamp last culled
  sphere: Sphere;          // the geometry's bounding sphere (local space)
}

const registry = new Set<Cullable>();
/** `?debug`: window.__culling.enabled = false draws every selected instance (for A/B comparisons) */
export const culling = { enabled: true, stats: { runs: 0, ms: 0 } };
let enabledAt = true;

/** register an instanced mesh for culling; `extras` are its per-instance attributes (packed with the matrices) */
export function makeCullable(mesh: InstancedMesh, extras: InstancedBufferAttribute[] = []): Cullable {
  const g = mesh.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  const c: Cullable = {
    mesh, src: new Float32Array(mesh.instanceMatrix.array.length),
    extras: extras.map((attr) => ({ src: new Float32Array(attr.array.length), attr })),
    count: 0, version: 0, seen: -1, camStamp: -1, sphere: g.boundingSphere!.clone(),
  };
  registry.add(c);
  return c;
}
export function releaseCullable(c: Cullable | undefined) { if (c) registry.delete(c); }
/** the owner has written `count` instances into `src` (and its extras) */
export function commit(c: Cullable, count: number) { c.count = count; c.version++; }

// ---- the camera's view, recomputed only when the camera changes
const frustum = new Frustum(), vp = new Matrix4();
const lastCam = new Float32Array(32);
let stamp = 0;
function cameraStamp(camera: Camera) {
  const a = camera.matrixWorld.elements, b = camera.projectionMatrix.elements;
  let same = true;
  for (let i = 0; i < 16; i++) { if (lastCam[i] !== a[i]) { same = false; lastCam[i] = a[i]; } if (lastCam[16 + i] !== b[i]) { same = false; lastCam[16 + i] = b[i]; } }
  if (enabledAt !== culling.enabled) { enabledAt = culling.enabled; same = false; }
  if (!same) { stamp++; frustum.setFromProjectionMatrix(vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); }
  return stamp;
}

function visibleOnly(c: Cullable, cam: number) {
  const { src, sphere } = c, dst = c.mesh.instanceMatrix.array as Float32Array, planes = frustum.planes;
  const cx = sphere.center.x, cy = sphere.center.y, cz = sphere.center.z, r0 = sphere.radius;
  let n = 0;
  for (let i = 0; i < c.count; i++) {
    const o = i * 16;
    const m0 = src[o], m1 = src[o + 1], m2 = src[o + 2], m4 = src[o + 4], m5 = src[o + 5], m6 = src[o + 6], m8 = src[o + 8], m9 = src[o + 9], m10 = src[o + 10];
    const s = Math.sqrt(Math.max(m0 * m0 + m1 * m1 + m2 * m2, m4 * m4 + m5 * m5 + m6 * m6, m8 * m8 + m9 * m9 + m10 * m10));
    const x = m0 * cx + m4 * cy + m8 * cz + src[o + 12], y = m1 * cx + m5 * cy + m9 * cz + src[o + 13], z = m2 * cx + m6 * cy + m10 * cz + src[o + 14];
    const r = -(r0 * s + PAD);
    let inside = true;
    if (enabledAt) for (let k = 0; k < 6; k++) { const p = planes[k]; if (p.normal.x * x + p.normal.y * y + p.normal.z * z + p.constant < r) { inside = false; break; } }
    if (!inside) continue;
    dst.set(src.subarray(o, o + 16), n * 16);
    for (const e of c.extras) { const k = e.attr.itemSize; (e.attr.array as Float32Array).set(e.src.subarray(i * k, i * k + k), n * k); }
    n++;
  }
  c.mesh.count = n;
  const im = c.mesh.instanceMatrix; im.clearUpdateRanges(); im.addUpdateRange(0, n * 16); im.needsUpdate = true;
  for (const e of c.extras) { e.attr.clearUpdateRanges(); e.attr.addUpdateRange(0, n * e.attr.itemSize); e.attr.needsUpdate = true; }
  c.seen = c.version; c.camStamp = cam;
}

/** cull every registered mesh for this camera (called before each render of the scene) */
export function cullFor(camera: Camera) {
  if (!(camera as Camera & { isPerspectiveCamera?: boolean }).isPerspectiveCamera || !registry.size) return;
  const t = performance.now(), cam = cameraStamp(camera);
  let ran = 0;
  for (const c of registry) if (c.seen !== c.version || c.camStamp !== cam) { visibleOnly(c, cam); ran++; }
  if (ran) { culling.stats.runs++; culling.stats.ms += performance.now() - t; }
}

/** install on the scene: runs at the start of every render of it, after the camera's matrices are updated */
export function installInstanceCulling(scene: Object3D) {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) (window as unknown as Record<string, unknown>).__culling = culling;
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (renderer, s, camera, ...rest) { prev.call(this, renderer, s, camera, ...rest); cullFor(camera); };
  return () => { scene.onBeforeRender = prev; };
}

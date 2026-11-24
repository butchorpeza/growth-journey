/* Fast raycasting: three-mesh-bvh builds a bounding-volume hierarchy per geometry, turning a raycast against the
   merged village meshes from tens of milliseconds into microseconds. Used by the interaction look-at ray and
   the camera autofocus. Geometries opt in with `geometry.computeBoundsTree()` (done when a chapter loads);
   meshes without a tree fall back to three.js's normal raycast. */
import { BufferGeometry, Mesh, type Object3D } from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

let installed = false;
export function installBVH() {
  if (installed) return;
  installed = true;
  BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  Mesh.prototype.raycast = acceleratedRaycast;
}

/** build trees for every (non-instanced) mesh under `root`, once per geometry */
export function buildBoundsTrees(root: Object3D) {
  root.traverse((o) => {
    const m = o as Mesh & { isInstancedMesh?: boolean };
    if (!m.isMesh || m.isInstancedMesh || m.geometry.boundsTree) return;
    m.geometry.computeBoundsTree();
  });
}

/** keep an object out of every raycast (e.g. thousands of grass instances: never a meaningful hit) */
export function ignoreRaycast(o: Object3D) { o.raycast = () => {}; }

/* What the camera should frame besides the path (used by PlayerCamera):
   - `inspect`: the object E was last pressed at. While its panel is open the camera turns to it and zooms in, with
     the object placed in the part of the screen the panel (on the right) leaves free. If something stands between
     the eye and the object (a post, a fence), the camera slides up to ~1 m aside, forward or up to a clear view, as
     an interaction camera does; the visitor's own position never changes.
   - featured objects passed in scroll mode (Interactable `featured`): the camera eases towards the nearest one in
     clear view and zooms in a little, so the dog, the cat, the sungka and anything added later are never walked
     past unseen.
   An object's frame is the bounding sphere of its Interactable group (the visible object plus its hit volume). */
import { Box3, Raycaster, Sphere, Vector3, type Intersection, type Material, type Mesh, type Object3D } from 'three';

export interface Frame { centre: Vector3; radius: number }

const cache = new WeakMap<Object3D, { frame: Frame; at: number }>();
const box = new Box3(), sphere = new Sphere();

/** the object's bounding sphere in world space (recomputed every 2 s at most: animals breathe, doors swing) */
export function frameOf(obj: Object3D, fresh = false): Frame {
  const now = performance.now(), hit = cache.get(obj);
  if (hit && !fresh && now - hit.at < 2000) return hit.frame;
  box.setFromObject(obj, true);
  const frame = box.isEmpty()
    ? { centre: obj.getWorldPosition(new Vector3()), radius: 0.4 }
    : (box.getBoundingSphere(sphere), { centre: sphere.center.clone(), radius: Math.max(0.2, sphere.radius) });
  cache.set(obj, { frame, at: now });
  return frame;
}

export const viewFocus: { inspect: (Frame & { obj: Object3D; shot: Vector3 | null }) | null; passing: number } = { inspect: null, passing: 0 };

/** E was pressed at `obj`: frame it while its panel is open (the camera offset is worked out by PlayerCamera) */
export function inspectObject(obj: Object3D) { viewFocus.inspect = { ...frameOf(obj, true), obj, shot: null }; }

// ------------------------------------------------------------------------------------------------ line of sight
const ray = new Raycaster(); (ray as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
const dir = new Vector3(), tmp = new Vector3();
const within = (o: Object3D, root: Object3D) => { for (let n: Object3D | null = o; n; n = n.parent) if (n === root) return true; return false; };
/** a hit that really blocks the view: a visible, drawn surface that isn't part of the object itself */
const blocks = (h: Intersection, obj: Object3D) => {
  const m = (h.object as Mesh).material as Material | Material[];
  const mat = Array.isArray(m) ? m[0] : m;
  return h.object.visible && !!mat && mat.colorWrite !== false && mat.visible !== false && !within(h.object, obj);
};
/** is the segment from `a` to `b` free of blocking surfaces? */
function clear(scene: Object3D, a: Vector3, b: Vector3, obj: Object3D) {
  const d = dir.copy(b).sub(a), len = d.length(); if (len < 1e-3) return true;
  ray.set(a, d.divideScalar(len)); ray.far = len;
  return !ray.intersectObject(scene, true).some((h) => blocks(h, obj));
}
/** share (0…1) of five points on the object (centre, left, right, top, bottom) seen from `eye` */
export function visibility(scene: Object3D, eye: Vector3, f: Frame, obj: Object3D) {
  const side = tmp.set(f.centre.z - eye.z, 0, eye.x - f.centre.x).normalize().multiplyScalar(f.radius * 0.55);
  const pts = [f.centre.clone(), f.centre.clone().add(side), f.centre.clone().sub(side),
    f.centre.clone().setY(f.centre.y + f.radius * 0.45), f.centre.clone().setY(f.centre.y - f.radius * 0.35)];
  return pts.filter((p) => clear(scene, eye, p, obj)).length / pts.length;
}

/** the smallest camera move from `eye` (sideways, forward, up; ≤ ~1.1 m) that sees the object clearly; zero if the
 *  view is already clear, and the clearest candidate if none is fully clear. The move itself must not pass through
 *  anything. */
export function clearShot(scene: Object3D, eye: Vector3, f: Frame, obj: Object3D) { return bestShot(scene, eye, f, obj).offset; }

/** as clearShot, with how much of the object that position sees (0…1) */
export function bestShot(scene: Object3D, eye: Vector3, f: Frame, obj: Object3D): { offset: Vector3; vis: number } {
  const here = visibility(scene, eye, f, obj);
  if (here >= 0.6) return { offset: new Vector3(), vis: here };
  const fwd = new Vector3(f.centre.x - eye.x, 0, f.centre.z - eye.z).normalize(), right = new Vector3(-fwd.z, 0, fwd.x);
  let best = new Vector3(), bestV = -1;
  for (const [s, fw, up] of [[0.35, 0, 0], [-0.35, 0, 0], [0.6, 0.2, 0], [-0.6, 0.2, 0], [0, 0.5, 0.1], [0.9, 0.3, 0.1], [-0.9, 0.3, 0.1], [0.4, 0.7, 0.15], [-0.4, 0.7, 0.15], [0, 0, 0.35], [0, 0.45, 0.5], [0.5, 0.4, 0.45], [-0.5, 0.4, 0.45], [0, 0.8, 0.45]]) {
    const off = right.clone().multiplyScalar(s).addScaledVector(fwd, fw).setY(up), at = eye.clone().add(off);
    if (!clear(scene, eye, at.clone().addScaledVector(off.clone().normalize(), 0.25), obj)) continue;   // keep 25 cm from walls
    const v = visibility(scene, at, f, obj);
    if (v >= 0.8) return { offset: off, vis: v };
    if (v > bestV) { bestV = v; best = off; }
  }
  return here >= bestV ? { offset: new Vector3(), vis: here } : { offset: best, vis: bestV };
}

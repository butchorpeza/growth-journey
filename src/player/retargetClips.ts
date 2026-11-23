/* Direction-based retargeting of animation clips between two skeletons that share bone names (Mixamo naming).
   The skeletons may differ in axes (Mixamo FBX exports: Z-up with a rotated armature; MPFB: Y-up), units (cm vs m),
   bone roll conventions and rest pose (T-pose vs A-pose). Copying rotations — local or world — breaks on those
   differences (we tried: twisted limbs, stretched hands). Instead, for every frame:
     1. pose the source skeleton with the clip,
     2. turn each target bone (root first) so it points at the same world direction as the source bone
        (bone -> child); the hips additionally match the left-right hip axis so the body faces the right way,
     3. record the resulting local rotations.
   Bone lengths, proportions and the rest height of the hips stay the character's own; the clip stays in place. */
import { AnimationClip, AnimationMixer, Matrix4, Quaternion, QuaternionKeyframeTrack, SkinnedMesh, Vector3, type Bone, type Object3D } from 'three';

const skinned = (root: Object3D) => {
  let best: SkinnedMesh | null = null;
  root.traverse((o) => { const s = o as SkinnedMesh; if (s.isSkinnedMesh && (!best || s.skeleton.bones.length > best.skeleton.bones.length)) best = s; });
  return best as SkinnedMesh | null;
};

const v1 = new Vector3(), v2 = new Vector3(), v3 = new Vector3(), v4 = new Vector3();
const qa = new Quaternion(), qb = new Quaternion(), qp = new Quaternion();
const m1 = new Matrix4(), m2 = new Matrix4();
const wp = (o: Object3D, out: Vector3) => o.getWorldPosition(out);

/** rotation that maps basis (up a, side b) onto (up c, side d) */
function basisRotation(a: Vector3, b: Vector3, c: Vector3, d: Vector3, out: Quaternion) {
  const an = a.clone().normalize(), cn = c.clone().normalize();
  const ax = new Vector3().crossVectors(an, b).normalize(), bx = new Vector3().crossVectors(ax, an).normalize();
  const cx = new Vector3().crossVectors(cn, d).normalize(), dx = new Vector3().crossVectors(cx, cn).normalize();
  m1.makeBasis(ax, an, bx);
  m2.makeBasis(cx, cn, dx);
  return out.setFromRotationMatrix(m2.multiply(m1.invert()));
}

function setWorldQuaternion(b: Bone, world: Quaternion) {
  (b.parent ? b.parent.getWorldQuaternion(qp) : qp.identity()).invert();
  b.quaternion.copy(qp.multiply(world));
  b.updateMatrixWorld(true);
}

const FINGER = /(Thumb|Index|Middle|Ring|Pinky)\d/;

interface Pair { t: Bone; s: Bone; tc?: Bone; sc?: Bone }

function buildPairs(target: SkinnedMesh, source: SkinnedMesh): Pair[] {
  const src = new Map(source.skeleton.bones.map((b) => [b.name, b]));
  const out: Pair[] = [];
  const walk = (b: Bone) => {
    const s = src.get(b.name);
    // fingers keep the character's relaxed rest pose (short chains retarget poorly and stretched the hands)
    if (s && !FINGER.test(b.name)) {
      // the child to aim at: prefer the main chain (Spine -> Spine1, Hand -> middle finger, …)
      const kids = b.children.filter((c) => (c as Bone).isBone && src.has(c.name)) as Bone[];
      const main = kids.find((c) => /(Spine\d?|Neck|Head|HandMiddle1|Arm|ForeArm|Hand|UpLeg|Leg|Foot|ToeBase)$/.test(c.name)) ?? kids[0];
      out.push({ t: b, s, tc: main, sc: main ? src.get(main.name) : undefined });
    }
    b.children.forEach((c) => (c as Bone).isBone && walk(c as Bone));
  };
  target.skeleton.bones.filter((b) => !(b.parent as Bone)?.isBone).forEach(walk);
  return out;
}

function matchFrame(pairs: Pair[], target: SkinnedMesh, source: SkinnedMesh) {
  target.skeleton.pose();
  target.updateMatrixWorld(true);
  const tb = (n: string) => target.skeleton.getBoneByName(n), sb = (n: string) => source.skeleton.getBoneByName(n);
  for (const p of pairs) {
    if (/hips$/i.test(p.t.name)) {
      // hips: match up (hips -> spine) and side (right thigh -> left thigh)
      const tS = tb('mixamorigSpine'), sS = sb('mixamorigSpine'), tL = tb('mixamorigLeftUpLeg'), tR = tb('mixamorigRightUpLeg');
      const sL = sb('mixamorigLeftUpLeg'), sR = sb('mixamorigRightUpLeg');
      if (tS && sS && tL && tR && sL && sR) {
        const tu = wp(tS, v1).sub(wp(p.t, v2)).clone(), su = wp(sS, v1).sub(wp(p.s, v2)).clone();
        const tsd = wp(tL, v3).sub(wp(tR, v4)).clone(), ssd = wp(sL, v3).sub(wp(sR, v4)).clone();
        basisRotation(tu, tsd, su, ssd, qa);
        p.t.getWorldQuaternion(qb).premultiply(qa);
        setWorldQuaternion(p.t, qb);
      }
      continue;
    }
    if (!p.tc || !p.sc) continue;
    const dt = wp(p.tc, v1).sub(wp(p.t, v2)).normalize(), ds = wp(p.sc, v3).sub(wp(p.s, v4)).normalize();
    if (dt.lengthSq() < 1e-8 || ds.lengthSq() < 1e-8) continue;
    qa.setFromUnitVectors(dt, ds);
    p.t.getWorldQuaternion(qb).premultiply(qa);
    setWorldQuaternion(p.t, qb);
  }
}

export function retargetClips(clips: AnimationClip[], targetRoot: Object3D, sourceRoot: Object3D, fps = 30): AnimationClip[] {
  const target = skinned(targetRoot), source = skinned(sourceRoot);
  if (!target || !source) return [];
  const pairs = buildPairs(target, source);
  const mixer = new AnimationMixer(sourceRoot);
  const result = clips.map((clip) => {
    const action = mixer.clipAction(clip); action.reset().play();
    const frames = Math.max(2, Math.round(clip.duration * fps) + 1);
    const times: number[] = [];
    const values = new Map<string, number[]>(pairs.map((p) => [p.t.name, []]));
    for (let f = 0; f < frames; f++) {
      const t = Math.min(clip.duration, f / fps);
      mixer.setTime(t); sourceRoot.updateMatrixWorld(true);
      matchFrame(pairs, target, source);
      times.push(t);
      for (const p of pairs) { const q = p.t.quaternion; values.get(p.t.name)!.push(q.x, q.y, q.z, q.w); }
    }
    action.stop(); mixer.uncacheAction(clip);
    const tracks = pairs.map((p) => new QuaternionKeyframeTrack(`${p.t.name}.quaternion`, times, values.get(p.t.name)!));
    return new AnimationClip(clip.name, clip.duration, tracks);
  });
  mixer.stopAllAction();
  target.skeleton.pose(); source.skeleton.pose();
  targetRoot.updateMatrixWorld(true); sourceRoot.updateMatrixWorld(true);
  return result;
}

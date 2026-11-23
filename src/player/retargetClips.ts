/* Re-use Mixamo clips authored on one Mixamo-rigged model on another (same bone names, different scale/units).
   - keeps every bone's rotation track (that is the motion)
   - drops position/scale tracks except the hips, and rescales the hips height to the target skeleton
     (the source sample is in centimetres, MPFB is in metres), so the character never floats or sinks
   - optional in-place: removes horizontal hips drift (the controller moves the character, not the clip) */
import { AnimationClip, KeyframeTrack, VectorKeyframeTrack, type Object3D } from 'three';

export function retargetClips(clips: AnimationClip[], target: Object3D, source: Object3D, { inPlace = true } = {}): AnimationClip[] {
  const hipsName = (root: Object3D) => { let n = ''; root.traverse((o) => { if (!n && /hips$/i.test(o.name)) n = o.name; }); return n; };
  const tHips = target.getObjectByName(hipsName(target)), sHips = source.getObjectByName(hipsName(source));
  const tH = tHips ? tHips.position.y : 1, sH = sHips ? sHips.position.y : 1;
  const k = sH ? tH / sH : 1;
  return clips.map((clip) => {
    const tracks: KeyframeTrack[] = [];
    for (const t of clip.tracks) {
      if (t.name.endsWith('.quaternion')) { tracks.push(t); continue; }
      if (/hips\.position$/i.test(t.name)) {
        const v = (t.values as Float32Array).slice();
        const x0 = v[0], z0 = v[2];
        for (let i = 0; i < v.length; i += 3) {
          v[i] = inPlace ? x0 * k : v[i] * k; v[i + 1] *= k; v[i + 2] = inPlace ? z0 * k : v[i + 2] * k;
        }
        tracks.push(new VectorKeyframeTrack(t.name, Array.from(t.times), Array.from(v)));
      }
    }
    return new AnimationClip(clip.name, clip.duration, tracks);
  });
}

/* The creature: "THE RAKE" by The WarVet (Sketchfab, CC-BY 4.0, credited in CREDITS.md), a fully rigged and
   animated horror creature: long-limbed, dark, with a mouth that splits open vertically. Its own animations are used:
   idle, walk, run, sprint, an enraged roar, and its jump scare. Here it is:
   - scaled to stand about 2.5 m tall, its materials kept (its own textures, normal map and glowing eyes), with only a
     faint cold edge added where light grazes it, so in the dark it reads as a silhouette first;
   - played at the pace it actually covers (no sliding feet: the clips run in place, and their speed follows its own);
   - given one unnatural extra on top of the clips: the head now and then snaps to a new angle and holds it.
   Pursuit.tsx places it and says what it's doing through `creature`. */
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AnimationMixer, Box3, LoopOnce, LoopRepeat, MathUtils, Vector3, type AnimationAction, type Bone, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CREATURE_URL } from './materials';

export type CreatureAnim = 'idle' | 'walk' | 'run' | 'sprint' | 'enrage' | 'jumpscare';
/** what Pursuit.tsx tells it; `head` is written back (world position of its face) and `headHeight` (its face above
 *  its feet); `mouth` is 1 while it lunges (the head then looks straight at the visitor) */
export const creature = { visible: false, pos: new Vector3(), yaw: 0, anim: 'idle' as CreatureAnim, speed: 0, head: new Vector3(), headHeight: 2.2, mouth: 0, fade: 0 };

/** how tall it stands (m), and the ground speed its clips are made for at that size (m/s at 1×) */
const HEIGHT = 2.55;
const PACE: Partial<Record<CreatureAnim, number>> = { walk: 1.5, run: 4.2, sprint: 6.2 };
/** its model's forward, relative to +z */
export const FACING = { yaw: 0 };

export function Creature() {
  const gltf = useGLTF(CREATURE_URL);
  const rig = useMemo(() => {
    const root = clone(gltf.scene);
    const bones: Record<string, Bone> = {};
    const mats: MeshStandardMaterial[] = [];
    root.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
        const list = (Array.isArray(m.material) ? m.material : [m.material]).map((mm: Material) => {
          const c = (mm as MeshStandardMaterial).clone();
          // a faint cold edge where light grazes it: the silhouette reads in the dark, the body only up close
          c.onBeforeCompile = (sh) => {
            sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
              float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.5);
              totalEmissiveRadiance += vec3(0.02, 0.026, 0.036) * rim;`);
          };
          c.customProgramCacheKey = () => `rake_${mm.name}`;
          mats.push(c);
          return c;
        });
        m.material = Array.isArray(m.material) ? list : list[0];
      }
      if ((o as Bone).isBone) bones[o.name.replace(/_\d+$/, '')] = o as Bone;
    });
    const mixer = new AnimationMixer(root);
    const actions: Partial<Record<CreatureAnim, AnimationAction>> = {};
    for (const n of ['idle', 'walk', 'run', 'sprint', 'enrage', 'jumpscare'] as CreatureAnim[]) {
      const clip = gltf.animations.find((a) => a.name === n);
      if (!clip) continue;
      const a = mixer.clipAction(clip);
      if (n === 'enrage' || n === 'jumpscare') { a.setLoop(LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(LoopRepeat, Infinity);
      actions[n] = a;
    }
    actions.idle?.play();
    // its size: measured standing in its idle pose, then scaled to HEIGHT, feet on the ground
    mixer.update(0); root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root, true), h = Math.max(0.01, box.max.y - box.min.y);
    root.scale.multiplyScalar(HEIGHT / h); root.updateMatrixWorld(true);
    const box2 = new Box3().setFromObject(root, true), lift = -box2.min.y;
    const head = new Vector3(); bones.head?.getWorldPosition(head);
    creature.headHeight = head.y + lift;
    const base = mats.map((m) => m.color.clone());
    return { root, lift, mixer, actions, bones, mats, base, faded: 0, current: 'idle' as CreatureAnim, twitch: { next: 2, x: 0, z: 0 } };
  }, [gltf]);
  useEffect(() => () => { rig.mixer.stopAllAction(); }, [rig]);

  useFrame((_, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 0), 0.1), r = rig, root = r.root;
    root.visible = creature.visible;
    if (!creature.visible) return;
    if (creature.anim !== r.current) {
      const from = r.actions[r.current], to = r.actions[creature.anim];
      if (to) {
        // running into sprinting keeps the stride (same phase); anything else starts its clip from the top
        const keepPhase = from && (creature.anim === 'sprint' || creature.anim === 'run') && (r.current === 'sprint' || r.current === 'run');
        const phase = keepPhase ? (from!.time / from!.getClip().duration) : 0;
        to.reset(); to.time = phase * to.getClip().duration; to.play();
        if (from) to.crossFadeFrom(from, creature.anim === 'jumpscare' ? 0.08 : 0.3, false);
      }
      r.current = creature.anim;
    }
    // fading into the dark: it goes black first, then dissolves (no pop)
    if (creature.fade !== r.faded) {
      r.faded = creature.fade;
      const f = creature.fade;
      r.mats.forEach((m, i) => {
        m.color.copy(r.base[i]).multiplyScalar(1 - 0.9 * Math.min(1, f * 1.6));
        m.emissiveIntensity = 1 - Math.min(1, f * 1.4);
        const t = f > 0.001; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; }
        m.opacity = 1 - Math.max(0, (f - 0.35) / 0.65); m.depthWrite = f < 0.5;
      });
    }
    const act = r.actions[creature.anim], pace = PACE[creature.anim];
    if (act) act.timeScale = pace ? MathUtils.clamp(creature.speed / pace, 0.5, 1.7) : creature.anim === 'idle' ? 0.8 : 1;
    r.mixer.update(dt);
    root.position.set(creature.pos.x, creature.pos.y + r.lift, creature.pos.z);
    root.rotation.set(0, creature.yaw + FACING.yaw, 0);
    // now and then the head snaps to a new angle and holds it (not while it lunges: then it looks straight at you)
    const tw = r.twitch; tw.next -= dt;
    if (tw.next <= 0) { tw.next = 0.7 + Math.random() * (creature.anim === 'idle' ? 2.4 : 1.4); tw.x = (Math.random() - 0.5) * 0.4; tw.z = (Math.random() - 0.5) * 0.7; }
    const hd = r.bones.head;
    if (hd && creature.mouth < 0.5 && creature.anim !== 'jumpscare') { hd.rotation.x += tw.x; hd.rotation.z += tw.z; }
    root.updateMatrixWorld(true);
    hd?.getWorldPosition(creature.head);
  });
  return <primitive object={rig.root} />;
}

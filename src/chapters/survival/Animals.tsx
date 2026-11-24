/* The village's animals: "Labrador dog" by I-I-love-my-dog-Dixie and "An Animated Cat" by Evil_Katz (Sketchfab,
   CC-BY 4.0, credited in CREDITS.md).
   - The dog (K9) lies in the front yard beside the walk from the door to the gate, under the gate pole's light. It drifts between
     four resting clips (lying, shifting, settling, dozing), crossfading from one to the next.
   - The cat sits on the bench of the sungka shelter, grooming (its one clip, looped). The bench top is found by
     probing the scene, so the cat sits on the real seat.
   Both are scaled to real size from their skinned bounds and set on the surface below them; they cast shadows, take
   the weather, and never block interaction raycasts. */
import { useAnimations, useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Group, LoopOnce, LoopRepeat, MeshBasicMaterial, Raycaster, Vector3, type AnimationAction, type Mesh, type Object3D } from 'three';
import { Interactable } from '../../interactions/Interactable';
import { openDiscovery } from './Discoveries';

const HIT = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ignoreRaycast } from '../../rendering/bvh';
import { applyWeather } from '../../rendering/weather';
import { SURVIVAL_BASE } from './layout';

/** height of the first visible upward-facing surface below (x, z), searched from `from` metres down */
function surfaceBelow(root: Object3D, x: number, z: number, from: number) {
  const ray = new Raycaster(); (ray as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = false; ray.far = from + 5;
  ray.set(new Vector3(x, from, z), new Vector3(0, -1, 0));
  const hit = ray.intersectObject(root, true).find((h) => h.object.visible && h.face && h.face.normal.y > 0.5);
  return hit ? hit.point.y : null;
}

/** a skinned model clone, scaled so its longest horizontal side is `length` metres, its base at y = 0 */
function useCreature(url: string, length: number) {
  const gltf = useGLTF(url, false, true);
  const model = useMemo(() => {
    const inner = cloneSkinned(gltf.scene);
    inner.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => applyWeather(mm));
      ignoreRaycast(m);
    });
    inner.updateMatrixWorld(true);
    const box = new Box3().setFromObject(inner, true), size = box.getSize(new Vector3());
    const k = length / Math.max(size.x, size.z);
    inner.scale.multiplyScalar(k);
    inner.updateMatrixWorld(true);
    const b2 = new Box3().setFromObject(inner, true), c = b2.getCenter(new Vector3());
    inner.position.sub(new Vector3(c.x, b2.min.y, c.z));
    const outer = new Group(); outer.add(inner);
    return outer;
  }, [gltf.scene, length]);
  return { model, animations: gltf.animations };
}

export function Animals({ world }: { world: Object3D }) {
  return (
    <>
      <Dog world={world} />
      <Cat world={world} />
    </>
  );
}

function Dog({ world }: { world: Object3D }) {
  const { model, animations } = useCreature(`${SURVIVAL_BASE}/animals/dog.glb`, 0.95);
  const group = useRef<Group>(null);
  const { actions, names, mixer } = useAnimations(animations, group);
  // in the front yard, right of the walk from the door to the gate, under the gate pole's light, facing the path:
  // in view as the visitor walks out (beside the door, the open door hid him)
  const spot = useMemo(() => ({ x: 2.1, z: 5.9, y: surfaceBelow(world, 2.1, 5.9, 1.5) ?? 0 }), [world]);
  const react = useRef<() => void>(() => {});
  useEffect(() => {
    if (!names.length) return;
    let i = 0, current: AnimationAction | null = null;
    // E at K9: he shifts and lifts his head (the lying one-off clip) straight away, then carries on resting
    react.current = () => {
      const a = actions[names.find((n) => /lay_one_off_01/.test(n)) ?? names[0]];
      if (!a || a === current) return;
      a.reset(); a.setLoop(LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 1;
      if (current) a.crossFadeFrom(current, 0.5, false); a.play(); current = a;
    };
    const next = () => {
      const a = actions[names[i % names.length]]; i++;
      if (!a) return;
      a.reset(); a.setLoop(LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 0.9 + Math.random() * 0.2;
      if (current) a.crossFadeFrom(current, 0.8, false); a.play();
      current = a;
    };
    const onFinish = () => next();
    mixer.addEventListener('finished', onFinish);
    next();
    return () => { mixer.removeEventListener('finished', onFinish); mixer.stopAllAction(); };
  }, [actions, names, mixer]);
  return (
    <>
      <group ref={group} position={[spot.x, spot.y, spot.z]} rotation-y={-2.3}><primitive object={model} /></group>
      <Interactable id="survival-k9" label="K9" verb="greet" reach={4.2} onInteract={() => { react.current(); openDiscovery('survival-k9'); }} position={[spot.x, spot.y + 0.3, spot.z]}>
        <mesh material={HIT}><boxGeometry args={[0.95, 0.55, 0.45]} /></mesh>
      </Interactable>
    </>
  );
}

function Cat({ world }: { world: Object3D }) {
  const { model, animations } = useCreature(`${SURVIVAL_BASE}/animals/cat.glb`, 0.46);
  const group = useRef<Group>(null);
  const { actions, names } = useAnimations(animations, group);
  // the bench in the sungka shelter: probe around it for a seat-height surface (0.3–0.75 m above the ground)
  const spot = useMemo(() => {
    const ground = surfaceBelow(world, 3.4, 27.6, 0.25) ?? 0;
    let best: { x: number; z: number; y: number } | null = null, bestD = Infinity;
    for (let dx = -1.4; dx <= 1.4; dx += 0.1) for (let dz = -0.8; dz <= 0.8; dz += 0.1) {
      const x = 3.1 + dx, z = 26.7 + dz, y = surfaceBelow(world, x, z, 1.6);
      if (y === null || y - ground < 0.3 || y - ground > 0.75) continue;
      const d = Math.hypot(dx + 0.6, dz);                                  // prefer the end of the bench, away from the board
      if (d < bestD) { bestD = d; best = { x, z, y }; }
    }
    return best ?? { x: 2.2, z: 27.6, y: ground };
  }, [world]);
  useEffect(() => {
    const a = actions[names[0]]; if (!a) return;
    a.setLoop(LoopRepeat, Infinity); a.play();
    return () => { a.stop(); };
  }, [actions, names]);
  return (
    <>
      <group ref={group} position={[spot.x, spot.y, spot.z]} rotation-y={-0.4}><primitive object={model} /></group>
      <Interactable id="survival-cat" label="the cat" verb="watch" reach={5} onInteract={() => openDiscovery('survival-cat')} position={[spot.x, spot.y + 0.2, spot.z]}>
        <mesh material={HIT}><boxGeometry args={[0.5, 0.4, 0.5]} /></mesh>
      </Interactable>
    </>
  );
}

/* Crows at the gate. Seven crows ("Crow" by Alexei Ostapenko, with its take-off animation, and "Crow Ascend" by
   Lahcen.el for the wing-beats in flight; Sketchfab, CC-BY 4.0, credited in CREDITS.md) perch on the iron arch, the
   pillar tops and the wall, still. The first time the visitor walks up to the gate they burst up all at once: each
   plays its real take-off, then beats away into the dark (a clatter of wings and harsh calls, AudioEngine.crows, and
   a flinch of the view), one of them straight past the visitor's head. Gone after a few seconds. */
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Vector3, type AnimationAction, type Mesh, type Object3D } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { audio } from '../../audio/AudioEngine';
import { director } from '../../game/director';
import { getGame } from '../../game/GameState';
import { playerState } from '../../player/playerState';
import { GATE, groundHeight } from './layout';
import { SHADOWS_BASE } from './materials';

const PERCHED_URL = `${SHADOWS_BASE}/birds/crow.glb`, FLYING_URL = `${SHADOWS_BASE}/birds/crow_flying.glb`;
useGLTF.preload(PERCHED_URL); useGLTF.preload(FLYING_URL);

const Y0 = groundHeight(0, GATE.z);
/** perches: [x, y, z, facing] */
const PERCHES: [number, number, number, number][] = [
  [-0.55, Y0 + 3.7, GATE.z, 0.4], [0.62, Y0 + 3.68, GATE.z + 0.02, 2.6], [-2.75, Y0 + 4.44, GATE.z, 3.6],
  [2.75, Y0 + 4.03, GATE.z, 1.0], [-5.6, groundHeight(-5.6, GATE.z) + 0.83, GATE.z, 2.0], [6.7, groundHeight(6.7, GATE.z) + 0.83, GATE.z, 4.4],
  [-8.4, groundHeight(-8.4, GATE.z) + 0.83, GATE.z, 0.9],
];
const LENGTH = 0.62;   // m, beak to tail (a big crow)

/** a copy of a model, scaled so its longest side is LENGTH, feet at its origin */
function sized(scene: Object3D) {
  const o = clone(scene);
  o.traverse((c) => { const m = c as Mesh; if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
  const holder = new Group(); holder.add(o);
  o.updateMatrixWorld(true);
  const b = new Box3().setFromObject(o, true), size = b.getSize(new Vector3());
  const s = LENGTH / Math.max(size.x, size.z, 1e-4);
  o.scale.multiplyScalar(s); o.updateMatrixWorld(true);
  const b2 = new Box3().setFromObject(o, true);
  o.position.y -= b2.min.y; o.position.x -= (b2.min.x + b2.max.x) / 2; o.position.z -= (b2.min.z + b2.max.z) / 2;
  return { holder, model: o };
}

export function Crows() {
  const perched = useGLTF(PERCHED_URL), flying = useGLTF(FLYING_URL);
  const birds = useMemo(() => PERCHES.map(([x, y, z, f], i) => {
    const g = new Group(); g.position.set(x, y, z); g.rotation.y = f;
    const sit = sized(perched.scene), fly = sized(flying.scene);
    fly.holder.visible = false;
    g.add(sit.holder, fly.holder);
    const sitMixer = new AnimationMixer(sit.model), flyMixer = new AnimationMixer(fly.model);
    const takeOff: AnimationAction | null = perched.animations[0] ? sitMixer.clipAction(perched.animations[0]) : null;
    if (takeOff) { takeOff.setLoop(LoopOnce, 1); takeOff.clampWhenFinished = true; takeOff.play(); takeOff.paused = true; takeOff.time = 0; }
    const beat: AnimationAction | null = flying.animations[0] ? flyMixer.clipAction(flying.animations[0]) : null;
    if (beat) { beat.setLoop(LoopRepeat, Infinity); beat.play(); beat.time = Math.random() * flying.animations[0].duration; }
    sitMixer.update(0);
    return { g, sit, fly, sitMixer, flyMixer, takeOff, vel: new Vector3(), t: 0, i, lift: 0 };
  }), [perched, flying]);
  const st = useRef({ flown: -1 });
  const tmp = useMemo(() => new Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 0), 0.1), s = st.current, g = getGame(), p = playerState.position;
    if (s.flown < 0) {
      if (g.mode === 'playing' && !director.active && Math.abs(p.z - GATE.z) < 5.5 && Math.abs(p.x) < 6) {
        s.flown = 0; audio.crows();
        if (g.settings.cameraFx && !g.settings.reducedMotion) director.shake = 0.18;
        birds.forEach((b, i) => {
          if (b.takeOff) { b.takeOff.paused = false; b.takeOff.timeScale = 1.2 + Math.random() * 0.3; }
          if (i === 0) b.vel.copy(tmp.set(p.x + 0.7, p.y + 1.9, p.z).sub(b.g.position).normalize().multiplyScalar(8));
          else {
            tmp.set(b.g.position.x - p.x, 0, b.g.position.z - p.z).normalize();
            b.vel.set(tmp.x * (2 + Math.random() * 2) + (Math.random() - 0.5) * 3, 2.5 + Math.random() * 2, tmp.z * (2 + Math.random() * 2) - 2 - Math.random() * 3);
          }
        });
      }
      return;
    }
    s.flown += dt;
    if (s.flown > 0.45 && director.shake > 0 && !director.active) director.shake = Math.max(0, director.shake - dt * 2);
    birds.forEach((b) => {
      b.t += dt;
      // the take-off first (it springs up and opens its wings), then the wing-beats as it climbs away
      const takingOff = b.takeOff && b.t < b.takeOff.getClip().duration / b.takeOff.timeScale * 0.8;
      b.sit.holder.visible = !!takingOff; b.fly.holder.visible = !takingOff;
      if (takingOff) b.sitMixer.update(dt); else b.flyMixer.update(dt * 1.4);
      const k = Math.min(1, b.t / 0.35);                                  // it leaves its perch quickly, not at once
      b.vel.y += (b.i === 0 ? 0.6 : 1.2) * dt;
      b.vel.x += Math.sin(b.t * 1.7 + b.i) * 2 * dt;
      b.g.position.addScaledVector(b.vel, dt * k);
      b.g.rotation.y = Math.atan2(b.vel.x, b.vel.z);
      b.g.rotation.x = -Math.atan2(b.vel.y, Math.hypot(b.vel.x, b.vel.z)) * 0.5;
      b.g.visible = s.flown < 6;
    });
  });
  return <>{birds.map((b) => <primitive key={b.i} object={b.g} />)}</>;
}

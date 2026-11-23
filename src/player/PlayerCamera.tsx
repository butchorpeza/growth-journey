/* Third-person over-the-shoulder camera.
   - Orbits a pivot at shoulder height (mouse: yaw/pitch, wheel: distance), slightly offset to the right.
   - Collision-aware: a ray from the pivot towards the camera stops it in front of walls; it pulls in fast and
     eases back out slowly, so it never clips through geometry and never pops.
   - Follows with critically-damped smoothing; FOV widens a little while running.
   - A cinematic mode (camera rails driven by GSAP) can take over through `cameraOverride`. */
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { getGame } from '../game/GameState';
import { GROUPS } from '../physics/CollisionLayers';
import { MOVE } from './characterConfig';
import { input } from './PlayerInput';
import { playerState } from './playerState';

export const cameraOverride = { active: false, position: new Vector3(), target: new Vector3(), fov: 50 };

const PITCH_MIN = -0.45, PITCH_MAX = 1.15;
const DIST_MIN = 1.6, DIST_MAX = 6.5;
const PIVOT_HEIGHT = 1.55, SHOULDER = 0.42, MARGIN = 0.22;

export function PlayerCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { world, rapier } = useRapier();
  const v = useMemo(() => ({ pivot: new Vector3(), dir: new Vector3(), desired: new Vector3(), right: new Vector3(), look: new Vector3() }), []);
  const dist = useRef(playerState.camDistance), first = useRef(true);
  const smoothPivot = useRef(new Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const g = getGame();

    if (cameraOverride.active) {
      camera.position.copy(cameraOverride.position);
      camera.lookAt(cameraOverride.target);
      camera.fov = MathUtils.lerp(camera.fov, cameraOverride.fov, 1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix();
      return;
    }

    // look input (consumed every frame)
    if (g.mode === 'playing') {
      const s = 0.0022 * g.settings.sensitivity;
      playerState.camYaw -= input.lookX * s;
      playerState.camPitch = MathUtils.clamp(playerState.camPitch + input.lookY * s * (g.settings.invertY ? -1 : 1), PITCH_MIN, PITCH_MAX);
      playerState.camDistance = MathUtils.clamp(playerState.camDistance + input.zoom * 0.45, DIST_MIN, DIST_MAX);
    }
    input.lookX = 0; input.lookY = 0; input.zoom = 0;

    // pivot: shoulder height, smoothed so footsteps and small bumps don't shake the view
    v.pivot.copy(playerState.position).y += PIVOT_HEIGHT;
    if (first.current) smoothPivot.current.copy(v.pivot);
    smoothPivot.current.lerp(v.pivot, 1 - Math.exp(-14 * dt));
    const yaw = playerState.camYaw, pitch = playerState.camPitch;
    v.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    v.look.copy(smoothPivot.current).addScaledVector(v.right, SHOULDER);

    // direction from pivot to camera
    v.dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).normalize();
    const want = playerState.camDistance;

    // collision: cast from the shoulder towards the camera, stop just in front of the first hit
    let allowed = want;
    const ray = new rapier.Ray(v.look, v.dir);
    const hit = world.castRay(ray, want + MARGIN, true, undefined, GROUPS.cameraObstruction);
    if (hit) allowed = Math.max(DIST_MIN * 0.5, hit.timeOfImpact - MARGIN);
    // pull in fast, ease out slowly
    const rate = allowed < dist.current ? 30 : 3;
    dist.current = first.current ? allowed : MathUtils.lerp(dist.current, allowed, 1 - Math.exp(-rate * dt));

    v.desired.copy(v.look).addScaledVector(v.dir, dist.current);
    if (first.current) camera.position.copy(v.desired);
    else camera.position.lerp(v.desired, 1 - Math.exp(-18 * dt));
    camera.lookAt(v.look);

    // a touch wider while running
    const runFov = 50 + Math.min(1, playerState.speed / MOVE.runSpeed) * 5;
    camera.fov = MathUtils.lerp(camera.fov, runFov, 1 - Math.exp(-3 * dt));
    camera.updateProjectionMatrix();
    first.current = false;
  });
  return null;
}

/* Scroll-mode movement: scroll (wheel / trackpad / swipe, or W·S·arrow keys) moves the visitor along a curve
   through the chapter's waypoints. The curve is arc-length parameterised (scrolling feels even), the ground height
   under every point comes from a raycast at load (floors, thresholds, terrain), and movement eases toward the
   scroll target with a capped speed, so it reads as walking, not sliding. Head bob, footsteps, foliage culling and
   the sun's shadow area all follow, because the controller writes the same playerState the free mode uses. */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { CatmullRomCurve3, MathUtils, Raycaster, Vector3 } from 'three';
import { getGame } from '../game/GameState';
import { input } from './PlayerInput';
import { playerState } from './playerState';
import { RAIL, rail, type RailWaypoint } from './rail';

export function RailController({ path }: { path: RailWaypoint[] }) {
  const scene = useThree((s) => s.scene);

  const curves = useMemo(() => {
    // ground height at each waypoint: highest walkable surface below 2.6 m (under the house roofs)
    const ray = new Raycaster(); (ray as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true; ray.far = 20;
    const down = new Vector3(0, -1, 0);
    const ground = (x: number, z: number) => {
      ray.set(new Vector3(x, 2.6, z), down);
      const hit = ray.intersectObject(scene, true).find((h) => h.object.visible && h.face && h.face.normal.y > 0.3);
      return hit ? hit.point.y : 0;
    };
    const pos = new CatmullRomCurve3(path.map((w) => new Vector3(w.at[0], ground(w.at[0], w.at[1]), w.at[1])), false, 'centripetal');
    const look = new CatmullRomCurve3(path.map((w) => new Vector3(...w.look)), false, 'centripetal');
    return { pos, look, length: pos.getLength() };
  }, [path, scene]);

  useEffect(() => {
    rail.active = true; rail.length = curves.length; rail.s = 0; rail.target = 0; rail.offsetYaw = 0; rail.offsetPitch = 0;
    return () => { rail.active = false; };
  }, [curves]);

  const tmp = useMemo(() => ({ p: new Vector3(), l: new Vector3(), eye: new Vector3() }), []);

  useFrame((_, rawDt) => {
    const dt = MathUtils.clamp(rawDt, 0, 1 / 20);          // never negative (a clock jump) nor a huge step
    const playing = getGame().mode === 'playing';
    if (playing) {
      rail.target += input.scroll * RAIL.metresPerPixel + input.forward * RAIL.keySpeed * dt;
      rail.target = MathUtils.clamp(rail.target, 0, rail.length);
    }
    input.scroll = 0;
    // ease toward the target with a capped speed
    const want = (rail.target - rail.s) * (1 - Math.exp(-RAIL.follow * dt));
    const step = MathUtils.clamp(want, -RAIL.maxSpeed * dt, RAIL.maxSpeed * dt);
    rail.s = MathUtils.clamp(rail.s + step, 0, rail.length);

    const t = curves.pos.getUtoTmapping(MathUtils.clamp(rail.s / rail.length, 0, 1), 0);
    curves.pos.getPoint(t, tmp.p);
    curves.look.getPoint(t, tmp.l);
    playerState.position.copy(tmp.p);
    playerState.grounded = true;
    playerState.speed = Math.abs(step) / Math.max(dt, 1e-4);
    playerState.velocity.set(0, 0, 0);
    // composed aim from the eye toward the look point
    tmp.eye.copy(tmp.p); tmp.eye.y += 1.62;
    const d = tmp.l.sub(tmp.eye);
    rail.baseYaw = Math.atan2(-d.x, -d.z);
    rail.basePitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    // glance drifts back to the composed angle while moving
    if (Math.abs(step) > 1e-4) {
      const k = Math.exp(-RAIL.recentre * dt);
      rail.offsetYaw *= k; rail.offsetPitch *= k;
    }
  });
  return null;
}

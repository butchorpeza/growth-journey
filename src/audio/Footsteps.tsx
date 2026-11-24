/* Footsteps from the real movement (mounted inside the Canvas): a step every ~0.75 m walking / ~1.05 m running of
   distance actually travelled (pushing into a wall makes no steps), the surface read from whatever is directly
   underfoot (BVH raycast: concrete floors, wooden planks, everything else is earth/grass), and a heavier step on
   landing from a jump or a drop. */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Raycaster, Vector3, type Mesh } from 'three';
import { MOVE } from '../player/movement';
import { playerState } from '../player/playerState';
import { audio, type Surface } from './AudioEngine';

const WOOD = /wood_floor|weathered_planks|plank|timber|siding|bamboo/i;
const CONCRETE = /concrete|floor|tile|cement/i;

export function Footsteps() {
  const scene = useThree((s) => s.scene);
  const ray = useMemo(() => { const r = new Raycaster(); r.far = 2.5; (r as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true; return r; }, []);
  const origin = useMemo(() => new Vector3(), []), down = useMemo(() => new Vector3(0, -1, 0), []);
  const st = useRef({ dist: 0, wasGrounded: true, air: 0 });

  const surface = (): Surface => {
    ray.set(origin.copy(playerState.position).setY(playerState.position.y + 0.5), down);
    const hit = ray.intersectObject(scene, true).find((h) => h.object.visible && (h.object as Mesh).isMesh);
    const m = hit && (hit.object as Mesh).material;
    const name = (Array.isArray(m) ? m[0] : m)?.name ?? '';
    return WOOD.test(name) ? 'wood' : CONCRETE.test(name) ? 'concrete' : 'grass';
  };

  useFrame((_, rawDt) => {
    if (!audio.running) return;
    const dt = Math.min(rawDt, 0.1), s = st.current, g = playerState.grounded;
    const airborne = s.air;
    s.air = g ? 0 : s.air + dt;
    if (g && !s.wasGrounded && airborne > 0.25) { audio.footstep(surface(), 1); s.dist = 0; }   // landing (not stair hops)
    s.wasGrounded = g;
    if (!g) return;
    const speed = playerState.speed;
    if (speed < 0.3) { s.dist = Math.min(s.dist, 0.4); return; }             // standing: next step comes quickly
    const running = speed > (MOVE.walkSpeed + MOVE.runSpeed) / 2;
    s.dist += speed * dt;
    const stride = running ? 1.05 : 0.75;
    if (s.dist >= stride) { s.dist -= stride; audio.footstep(surface(), running ? 0.75 : 0.45); }
  });
  return null;
}

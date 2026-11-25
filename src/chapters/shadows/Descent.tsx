/* The way down and out: one straight line from the house.
   - From the foot of the corridor's stairs a short brick tunnel runs straight on, east, a bulb or two, some haze,
     water dripping, towards cold light: its mouth in the cliff.
   - Across the mouth, an old iron gate standing open. The pursuit ends here: the visitor runs through, it slams shut
     behind them, and the creature hits the bars from the other side (Pursuit.tsx).
   - Outside, a rock ledge just above the sea under the island's east cliffs. Walking out to its end ends the chapter
     (Ending): the view goes out to sea, the cloud thins in the east and the first gold of the sunrise opens low over
     the water (Chapter 03's light), the light grows to white, and the closing card. */
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useMemo, useRef, useState } from 'react';
import { Box3, Color, Group, MeshBasicMaterial, Vector3, type Mesh, type MeshStandardMaterial, type PointLight } from 'three';
import { useGLTF } from '@react-three/drei';
import { audio } from '../../audio/AudioEngine';
import { caption } from '../../audio/narrator';
import { director, resetShot } from '../../game/director';
import { getGame, setGame, updateSave } from '../../game/GameState';
import { GROUPS } from '../../physics/CollisionLayers';
import { playerState } from '../../player/playerState';
import { leafGeometry, useEstateMaterials } from './Estate';
import { pieces, type WallSpec } from './House';
import { ESCAPE_GATE, FY, PASSAGE_Y, SHELF, TUNNEL } from './layout';
import { SHADOWS_BASE, boxUV, useShadowsMaterials, type ShadowsMats } from './materials';
import { skyState } from './Seascape';

const P = PASSAGE_Y, T = TUNNEL, ZC = (T.z0 + T.z1) / 2;
const WALLS: WallSpec[] = [
  { a: [T.x0, T.z1], b: [T.x1, T.z1], y0: P, h: T.h, mat: 'brick' },
  { a: [T.x0, T.z0], b: [T.x1, T.z0], y0: P, h: T.h, mat: 'brick' },
];

function Tunnel({ mats }: { mats: ShadowsMats }) {
  const parts = useMemo(() => WALLS.flatMap(pieces), []);
  const len = T.x1 - T.x0, w = T.z1 - T.z0, cx = (T.x0 + T.x1) / 2;
  return (
    <>
      {parts.map((pc, i) => <mesh key={i} geometry={boxUV(...pc.s, 1.2)} material={mats.brick} position={pc.p} castShadow receiveShadow />)}
      <mesh geometry={boxUV(len, 0.2, w, 1.4)} material={mats.brick} position={[cx, P - 0.09, ZC]} receiveShadow />
      <mesh geometry={boxUV(len, 0.2, w, 1.4)} material={mats.brick} position={[cx, P + T.h + 0.1, ZC]} castShadow />
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        {parts.map((pc, i) => <CuboidCollider key={i} args={[pc.s[0] / 2, pc.s[1] / 2, pc.s[2] / 2]} position={pc.p} />)}
        <CuboidCollider args={[len / 2, 0.15, w / 2]} position={[cx, P - 0.15, ZC]} />
      </RigidBody>
    </>
  );
}

/** a bulb on the stairs, one in the tunnel, and the cold light coming in at the mouth */
function Lights() {
  const B: [number, number, number][] = [[18.8, FY + 2.6, -67.3], [24.6, P + 2.3, -67.3]];
  const lights = useRef<(PointLight | null)[]>([]);
  const glow = useMemo(() => B.map(() => new MeshBasicMaterial({ color: '#ffcf8a' })), [B]);
  const warm = useMemo(() => new Color('#ffcf8a'), []);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    B.forEach((_, i) => {
      let k = 0.9 + 0.1 * Math.sin(t * 13 + i * 3);
      if (i === 1 && (t % 5) > 3.7) k *= Math.sin(t * 37) > 0.2 ? 1 : 0.05;
      const l = lights.current[i]; if (l) l.intensity = 12 * k;
      glow[i].color.copy(warm).multiplyScalar(0.4 + 0.6 * k);
    });
  });
  return (
    <>
      {B.map((b, i) => (
        <group key={i} position={b}>
          <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.006, 0.006, 0.4, 4]} /><meshStandardMaterial color="#111" /></mesh>
          <mesh material={glow[i]}><sphereGeometry args={[0.05, 10, 8]} /></mesh>
          <pointLight ref={(l) => { lights.current[i] = l; }} color="#ffb874" intensity={12} distance={9} decay={2} />
        </group>
      ))}
      <pointLight position={[T.x1 - 0.8, P + 1.8, ZC]} color="#8fb0d8" intensity={6} distance={9} decay={2} />
    </>
  );
}

/** scanned rock (Poly Haven, CC0: rock face 01 / 02, mossy rock set 01): a copy sat on its own base, centred, at a
 *  given size; it reports its footprint for a collider */
const ROCK_URL = (n: string) => `${SHADOWS_BASE}/rocks/${n}.glb`;
['rock_face_01', 'rock_face_02', 'rock_moss_set_01'].forEach((n) => useGLTF.preload(ROCK_URL(n)));
function Rock({ name, at, yaw = 0, scale = 1, tint = '#8d9096' }: { name: string; at: [number, number, number]; yaw?: number; scale?: number; tint?: string }) {
  const { scene } = useGLTF(ROCK_URL(name));
  const { obj, half } = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((c) => {
      const m = c as Mesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true;
      const mat = (m.material as MeshStandardMaterial).clone(); mat.color.multiply(new Color(tint)); m.material = mat;
    });
    o.updateMatrixWorld(true);
    const b = new Box3().setFromObject(o), c = b.getCenter(new Vector3());
    o.position.set(-c.x, -b.min.y, -c.z);
    const g = new Group(); g.add(o); g.scale.setScalar(scale); g.rotation.y = yaw;
    g.updateMatrixWorld(true);
    const size = new Box3().setFromObject(g).getSize(new Vector3());
    return { obj: g, half: size.multiplyScalar(0.5) };
  }, [scene, yaw, scale, tint]);
  return (
    <>
      <primitive object={obj} position={at} />
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        <CuboidCollider args={[half.x * 0.85, half.y, half.z * 0.85]} position={[at[0], at[1] + half.y, at[2]]} />
      </RigidBody>
    </>
  );
}

/** outside: the cliff round the tunnel's mouth (real scanned rock faces either side and over it), the ledge over
 *  the sea, mossy rocks along its edges */
function Shore() {
  const em = useEstateMaterials();
  const rock = useMemo(() => { const m = em.stone.clone(); m.color = new Color('#45484b'); m.normalScale.set(2.4, 2.4); return m; }, [em]);
  const cx = (SHELF.x0 + SHELF.x1) / 2, cz = (SHELF.z0 + SHELF.z1) / 2, hx = (SHELF.x1 - SHELF.x0) / 2, hz = (SHELF.z1 - SHELF.z0) / 2;
  return (
    <>
      {/* the cliff: big rock faces either side of the mouth and one over it */}
      <Rock name="rock_face_01" at={[T.x1 + 1.1, P - 0.8, T.z0 - 2.9]} yaw={0.35} scale={1.25} />
      <Rock name="rock_face_01" at={[T.x1 + 1.1, P - 0.8, T.z1 + 2.9]} yaw={2.6} scale={1.2} />
      <Rock name="rock_face_02" at={[T.x1 + 0.5, P + T.h - 0.1, ZC]} yaw={Math.PI / 2} scale={1.35} />
      <Rock name="rock_face_02" at={[T.x1 + 0.4, P + 2.8, T.z0 - 6.5]} yaw={1.1} scale={1.25} />
      <Rock name="rock_face_02" at={[T.x1 + 0.4, P + 2.8, T.z1 + 6.5]} yaw={-0.6} scale={1.25} />
      {/* mossy rocks along the ledge's edges and at its far end, half in the sea */}
      <Rock name="rock_moss_set_01" at={[SHELF.x1 + 2.6, P - 1.1, cz]} yaw={0.2} scale={0.8} tint="#7d8487" />
      <Rock name="rock_moss_set_01" at={[cx + 1.5, P - 1.0, SHELF.z0 - 1.6]} yaw={1.4} scale={0.7} tint="#7d8487" />
      <Rock name="rock_moss_set_01" at={[cx + 1.5, P - 1.0, SHELF.z1 + 1.6]} yaw={-1.7} scale={0.7} tint="#7d8487" />
      {/* cold light off the sea on the cliff face, so the rock reads */}
      <pointLight position={[T.x1 + 5, P + 3.2, ZC]} color="#9fb4d8" intensity={14} distance={16} decay={2} />
      <mesh geometry={boxUV(hx * 2, 1.2, hz * 2, 3)} material={rock} position={[cx, SHELF.y - 0.6, cz]} receiveShadow />
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        <CuboidCollider args={[hx, 0.6, hz]} position={[cx, SHELF.y - 0.6, cz]} />
        {/* the ledge's edges: the sea is not for walking into */}
        <CuboidCollider args={[0.3, 2, hz]} position={[SHELF.x1 + 0.3, SHELF.y + 1.5, cz]} />
        <CuboidCollider args={[hx, 2, 0.3]} position={[cx, SHELF.y + 1.5, SHELF.z0 - 0.3]} />
        <CuboidCollider args={[hx, 2, 0.3]} position={[cx, SHELF.y + 1.5, SHELF.z1 + 0.3]} />
      </RigidBody>
    </>
  );
}

/** the iron gate across the tunnel's mouth: standing open; it slams shut behind the visitor (Pursuit.tsx) */
export const escapeDoor = { shut: false, k: 1 };
function Gate() {
  const em = useEstateMaterials();
  const geo = useMemo(() => leafGeometry(T.z1 - T.z0 - 0.1, T.h - 0.15), []);
  const g = useRef<Group>(null);
  const [solid, setSolid] = useState(false);
  useFrame((_, dt) => {
    const want = escapeDoor.shut ? 0 : 1;
    escapeDoor.k += (want - escapeDoor.k) * (1 - Math.exp(-(escapeDoor.shut ? 11 : 2) * Math.min(dt, 0.1)));
    // hinged on the north wall: shut it spans the mouth (towards +z); open it lies back along the cliff outside
    if (g.current) g.current.rotation.y = -Math.PI / 2 * (1 - escapeDoor.k);
    if (escapeDoor.shut !== solid) setSolid(escapeDoor.shut);
  });
  return (
    <>
      <group ref={g} position={[ESCAPE_GATE.x, P, T.z0 + 0.05]}><mesh geometry={geo} material={em.iron} castShadow /></group>
      {solid && (
        <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
          <CuboidCollider args={[0.08, T.h / 2, (T.z1 - T.z0) / 2]} position={[ESCAPE_GATE.x, P + T.h / 2, ZC]} />
        </RigidBody>
      )}
    </>
  );
}

/** water dripping in the tunnel */
function TunnelSounds() {
  const st = useRef({ next: 1 });
  useFrame((_, dt) => {
    const p = playerState.position, s = st.current;
    if (!(p.x > T.x0 - 4 && p.x < T.x1 && p.y < FY - 0.5)) return;
    s.next -= dt;
    if (s.next <= 0) { s.next = 0.9 + Math.random() * 2.6; audio.drip(Math.random() * 1.6 - 0.8); }
  });
  return null;
}

/** the end of the chapter, at the end of the ledge */
function Ending() {
  const st = useRef({ t: -1 });
  const target = useMemo(() => new Vector3(400, 6, ZC), []);
  useFrame((_, rawDt) => {
    const g = getGame(), s = st.current, p = playerState.position;
    if (g.mode === 'paused') return;
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    if (s.t < 0) {
      if (g.mode === 'playing' && !director.active && p.x > SHELF.end && p.y > SHELF.y - 1) {
        s.t = 0; director.active = 'ending'; director.skip = null; setGame({ cinematic: 'ending', prompt: null });
        audio.heartbeat(0);
        void caption('shadows-threshold');                         // 05 · The Threshold (chapter02.ts), as subtitles
      }
      return;
    }
    s.t += dt;
    const t = s.t, e = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
    director.move.lock = true;
    // the light comes up slowly while the lines are read (about 16 s), then the warm white, then the card
    director.shot.target.copy(target); director.shot.weight = 0.9 * e(0, 2.5); director.shot.zoom = 1 - 0.12 * e(1, 14);
    skyState.dawn = e(0.5, 14);
    director.whiteout = e(16.5, 20);
    if (t > 20.2 && g.titleCard !== 'shadows-end') {
      resetShot(); director.active = null;
      setGame({ cinematic: null, titleCard: 'shadows-end', mode: 'reading', reading: null });
      document.exitPointerLock?.();
      const save = getGame().save;
      updateSave({ completed: [...new Set([...save.completed, 'shadows' as const])] });
    }
  });
  return null;
}

export function Descent() {
  const mats = useShadowsMaterials();
  return (
    <group>
      <Tunnel mats={mats} />
      <Lights />
      <Gate />
      <Shore />
      <TunnelSounds />
      <Ending />
    </group>
  );
}

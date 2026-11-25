/* 03 · The House of Memories, and 04 · the Descent below it.
   The house (walls, floors, ceilings, doors, the stair to nowhere, the rooms' furniture and light):
   - the hall: double height, a chandelier giving a weak, unsteady light, a grandfather clock, a cabinet, a console
     under a framed photograph (the one that is different when you look back), a staircase up to a landing where the
     upper flight has collapsed;
   - the living room: a stone fireplace, a sofa and armchairs facing it, a bookcase, a rocking chair that rocks on its
     own, moonlight through the front windows;
   - a dark side room: furniture under dust sheets, a mirror, a cabinet; its door is found open after you look away;
   - the corridor behind the hall: long and low, a runner, dim sconces, frames along the walls;
   - a small bedroom off it: a bed, a commode, a mirror, curtains moving at a window;
   - at the corridor's east end, stone stairs down into the east wing, to the passage.
   The passage, the cistern and the way out are Descent.tsx.
   Every interior door opens as the visitor reaches it (front door included). Real smoke drifts low along the
   floors, faintly green and lit from inside. Butch's story here (E, text in data/chapter02.ts): the drawing desk in
   the bedroom, the games in the living room, the empty rocking chair. Moonlight comes in as cold light from
   the windows; inside, the sky's fill light is turned down (ShadowsChapter) so the rooms are properly dark. */
import { RoundedBox, useGLTF } from '@react-three/drei';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box3, CanvasTexture, Color, DoubleSide, Group, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry,
  SRGBColorSpace, SpotLight, Sprite, SpriteMaterial, TextureLoader, Vector3, type Mesh, type PointLight,
} from 'three';
import { audio } from '../../audio/AudioEngine';
import { Interactable } from '../../interactions/Interactable';
import { GROUPS } from '../../physics/CollisionLayers';
import { playerState } from '../../player/playerState';
import { openDiscovery } from '../survival/Discoveries';
import { useEstateMaterials } from './Estate';
import { FY, HOUSE, PASSAGE_Y } from './layout';
import { SHADOWS_BASE, boxUV, useProp, useShadowsMaterials, type PropName, type ShadowsMats } from './materials';

// ------------------------------------------------------------------------------------------------- walls
export type Hole = [number, number, number];   // from, to (along the wall), top (above the wall's base)
export interface WallSpec { a: [number, number]; b: [number, number]; y0: number; h: number; t?: number; holes?: Hole[]; mat: keyof ShadowsMats; wainscot?: boolean }
export interface Piece { p: [number, number, number]; s: [number, number, number]; mat: keyof ShadowsMats }
export function pieces(w: WallSpec): Piece[] {
  const t = w.t ?? 0.3, alongX = w.a[1] === w.b[1];
  const lo = alongX ? Math.min(w.a[0], w.b[0]) : Math.min(w.a[1], w.b[1]), hi = alongX ? Math.max(w.a[0], w.b[0]) : Math.max(w.a[1], w.b[1]);
  const fixed = alongX ? w.a[1] : w.a[0];
  const out: Piece[] = [];
  const add = (from: number, to: number, y0: number, y1: number) => {
    if (to - from < 0.01 || y1 - y0 < 0.01) return;
    const c = (from + to) / 2, len = to - from, cy = (y0 + y1) / 2, hh = y1 - y0;
    out.push(alongX ? { p: [c, cy, fixed], s: [len, hh, t], mat: w.mat } : { p: [fixed, cy, c], s: [t, hh, len], mat: w.mat });
  };
  let cur = lo;
  for (const [f, to, top] of [...(w.holes ?? [])].map(([a, b, c]) => [Math.min(a, b), Math.max(a, b), c] as Hole).sort((x, y) => x[0] - y[0])) {
    add(cur, f, w.y0, w.y0 + w.h); add(f, to, w.y0 + top, w.y0 + w.h); cur = to;
  }
  add(cur, hi, w.y0, w.y0 + w.h);
  return out;
}

const H = HOUSE, P = PASSAGE_Y, top = FY + H.corridor.h;
const WALLS: WallSpec[] = [
  // the house: front skin, the hall's sides and back, the rooms
  { a: [H.west, -56.5], b: [H.east, -56.5], y0: FY, h: H.hall.h, holes: [[H.door.x0, H.door.x1, H.door.h]], mat: 'wallpaper' },
  { a: [H.hall.x0, H.hall.z1], b: [H.hall.x1, H.hall.z1], y0: FY, h: H.hall.h, holes: [[...H.corridor.hallDoor, 2.6]], mat: 'wallpaper' },
  { a: [H.living.x0, -66], b: [H.living.x1, -66], y0: FY, h: H.living.h, mat: 'wallpaper' },
  { a: [H.side.x0, -66], b: [H.side.x1, -66], y0: FY, h: H.side.h, mat: 'plaster' },
  { a: [H.hall.x0, H.hall.z0], b: [H.hall.x0, H.hall.z1], y0: FY, h: H.hall.h, holes: [[...H.living.door, 2.6]], mat: 'wallpaper' },
  { a: [H.hall.x1, H.hall.z0], b: [H.hall.x1, H.hall.z1], y0: FY, h: H.hall.h, holes: [[...H.side.door, 2.6]], mat: 'wallpaper' },
  { a: [H.living.x0, H.living.z0], b: [H.living.x0, H.living.z1], y0: FY, h: H.living.h, mat: 'wallpaper' },
  { a: [H.side.x1, H.side.z0], b: [H.side.x1, H.side.z1], y0: FY, h: H.side.h, mat: 'plaster' },
  // the corridor and the bedroom
  { a: [H.corridor.x0, H.corridor.z1], b: [H.corridor.x1, H.corridor.z1], y0: FY, h: H.corridor.h, holes: [[...H.bedroom.door, 2.5]], mat: 'wallpaper' },
  { a: [H.corridor.x0, H.corridor.z0], b: [H.corridor.x0, H.corridor.z1], y0: FY, h: H.corridor.h, mat: 'wallpaper' },
  { a: [H.bedroom.x0, -71.95], b: [H.bedroom.x1, -71.95], y0: FY, h: H.bedroom.h, mat: 'wallpaper' },
  { a: [H.bedroom.x1, H.bedroom.z0], b: [H.bedroom.x1, H.bedroom.z1], y0: FY, h: H.bedroom.h, mat: 'wallpaper' },
  // the stairwell (from the passage floor up to the corridor's ceiling); the passage itself is Descent.tsx
  { a: [H.stairs.x0, -66], b: [H.stairs.x1, -66], y0: P, h: top - P, mat: 'brick' },
  { a: [H.stairs.x0, -68.6], b: [H.stairs.x1, -68.6], y0: P, h: top - P, mat: 'brick' },
  { a: [22.2, -68.6], b: [22.2, -66], y0: P + 2.6, h: top - P - 2.6, mat: 'brick' },
];
/** floors and ceilings: [x0, x1, z0, z1, y (top of a floor / underside of a ceiling), kind] */
const SLABS: [number, number, number, number, number, 'floor' | 'ceil', keyof ShadowsMats][] = [
  [H.west, H.stairs.x0, -56.35, -72, FY, 'floor', 'planks'],
  [H.hall.x0, H.hall.x1, H.hall.z0, H.hall.z1, FY + H.hall.h, 'ceil', 'plaster'],
  [H.living.x0, H.living.x1, H.living.z0, H.living.z1, FY + H.living.h, 'ceil', 'plaster'],
  [H.side.x0, H.side.x1, H.side.z0, H.side.z1, FY + H.side.h, 'ceil', 'plaster'],
  [H.corridor.x0, H.corridor.x1, H.corridor.z0, H.corridor.z1, top, 'ceil', 'plaster'],
  [H.bedroom.x0, H.bedroom.x1, H.bedroom.z0, -72, FY + H.bedroom.h, 'ceil', 'plaster'],
  [H.stairs.x0, 22.2, -66, -68.6, top, 'ceil', 'brick'],
];

function Shell({ mats }: { mats: ShadowsMats }) {
  const parts = useMemo(() => WALLS.flatMap(pieces), []);
  return (
    <>
      {parts.map((pc, i) => <mesh key={i} geometry={boxUV(...pc.s, pc.mat === 'brick' ? 1.2 : 1.6)} material={mats[pc.mat] as MeshStandardMaterial} position={pc.p} castShadow receiveShadow />)}
      {SLABS.map(([x0, x1, z0, z1, y, kind, mat], i) => {
        const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0), t = 0.2;
        return <mesh key={`s${i}`} geometry={boxUV(w, t, d, mat === 'planks' ? 2.2 : 1.8)} material={mats[mat] as MeshStandardMaterial} position={[(x0 + x1) / 2, kind === 'floor' ? y - t / 2 + 0.01 : y + t / 2, (z0 + z1) / 2]} castShadow={kind === 'ceil'} receiveShadow />;
      })}
      {/* dark wainscot panelling, the lower metre of the hall and the corridor */}
      {([[-6, -1.1, -65.83], [1.1, 6, -65.83], [-15.6, -1.1, -66.17], [1.1, 15.6, -66.17], [-15.6, -10.4, -68.43], [-9.0, 15.6, -68.43]] as const).map(([x0, x1, z], i) => (
        <mesh key={`w${i}`} material={mats.darkWood} position={[(x0 + x1) / 2, FY + 0.5, z]} receiveShadow><boxGeometry args={[x1 - x0, 1.0, 0.04]} /></mesh>
      ))}
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        {parts.map((pc, i) => <CuboidCollider key={i} args={[pc.s[0] / 2, pc.s[1] / 2, pc.s[2] / 2]} position={pc.p} />)}
        {SLABS.filter((s) => s[5] === 'floor' && s[4] < FY - 1).map(([x0, x1, z0, z1, y], i) => <CuboidCollider key={`f${i}`} args={[Math.abs(x1 - x0) / 2, 0.15, Math.abs(z1 - z0) / 2]} position={[(x0 + x1) / 2, y - 0.15, (z0 + z1) / 2]} />)}
        {/* the stairs down, as a smooth ramp under the steps */}
        <StairRamp />
      </RigidBody>
    </>
  );
}

function StairRamp() {
  const x0 = 15.2, x1 = H.stairs.x1, run = x1 - x0, drop = FY - P, len = Math.hypot(run, drop), a = Math.atan2(drop, run);
  return <CuboidCollider args={[len / 2, 0.1, 1.3]} position={[(x0 + x1) / 2, (FY + P) / 2 - 0.1 / Math.cos(a), -67.3]} rotation={[0, 0, -a]} />;
}

/** the stairs down: worn wooden treads on a brick carcass, each with a dark nosing so every step reads */
function Steps({ mats }: { mats: ShadowsMats }) {
  const n = 14, run = (H.stairs.x1 - H.stairs.x0) / n, rise = (FY - P) / n;
  const riser = useMemo(() => boxUV(run, rise, 2.6, 1.2), [run, rise]);
  const tread = useMemo(() => boxUV(run + 0.06, 0.05, 2.5, 1.0), [run]);
  const nosing = useMemo(() => boxUV(0.06, 0.07, 2.5, 1.0), []);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const x = H.stairs.x0 + run * (i + 0.5), top = FY - rise * (i + 1);
        return (
          <group key={i}>
            <mesh geometry={riser} material={mats.brick} position={[x, top - rise / 2 + 0.005, -67.3]} receiveShadow />
            <mesh geometry={tread} material={mats.planks} position={[x, top + 0.02, -67.3]} receiveShadow castShadow />
            <mesh geometry={nosing} material={mats.darkWood} position={[x - run / 2, top + 0.02, -67.3]} />
          </group>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------------------------------------- doors
/** a door that swings open (inward) as the visitor comes within `near` m; `ajar` opens it a little on its own
 *  first (the side room: it is found standing open after the visitor has looked away from it) */
function Door({ hinge, width, height, closedYaw, openYaw, near = 2.4, children, onOpen, ajar }: {
  hinge: [number, number, number]; width: number; height: number; closedYaw: number; openYaw: number; near?: number;
  children: React.ReactNode; onOpen?: () => void; ajar?: { current: number };
}) {
  const g = useRef<Group>(null);
  const [solid, setSolid] = useState(true);
  const st = useRef({ k: 0, opened: false });
  const tmp = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    const s = st.current, p = playerState.position;
    tmp.set(hinge[0] + Math.cos(closedYaw) * width / 2, hinge[1], hinge[2] - Math.sin(closedYaw) * width / 2);
    const close = Math.hypot(p.x - tmp.x, p.z - tmp.z) < near && Math.abs(p.y - hinge[1]) < 2;
    if (close && !s.opened) { s.opened = true; audio.creak(0.6); onOpen?.(); }
    const want = s.opened ? 1 : ajar?.current ?? 0;
    s.k += (want - s.k) * (1 - Math.exp(-(s.opened ? 1.6 : 0.8) * Math.min(dt, 0.1)));
    if (g.current) g.current.rotation.y = closedYaw + (openYaw - closedYaw) * s.k;
    if (solid && s.k > 0.35) setSolid(false);
  });
  return (
    <>
      <group ref={g} position={hinge} rotation={[0, closedYaw, 0]}>{children}</group>
      {solid && (
        <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
          <CuboidCollider args={[width / 2, height / 2, 0.06]} position={[hinge[0] + Math.cos(closedYaw) * width / 2, hinge[1] + height / 2, hinge[2] - Math.sin(closedYaw) * width / 2]} rotation={[0, closedYaw, 0]} />
        </RigidBody>
      )}
    </>
  );
}

function PlankDoor({ width, height, mats }: { width: number; height: number; mats: ShadowsMats }) {
  return (
    <group>
      <mesh material={mats.darkWood} position={[width / 2, height / 2, 0]} castShadow receiveShadow><boxGeometry args={[width - 0.04, height - 0.02, 0.06]} /></mesh>
      {[0.25, 0.75].map((f) => <mesh key={f} material={mats.darkWood} position={[width / 2, height * f, 0.035]}><boxGeometry args={[width - 0.2, height * 0.38, 0.02]} /></mesh>)}
      <mesh material={mats.soot} position={[width - 0.12, height * 0.47, 0.06]}><sphereGeometry args={[0.035, 10, 8]} /></mesh>
    </group>
  );
}

// ------------------------------------------------------------------------------------------------- furniture
export function Prop({ name, p, yaw = 0, rot, scale = 1, age = 0.45, onRef }: { name: PropName; p: [number, number, number]; yaw?: number; rot?: [number, number, number]; scale?: number | [number, number, number]; age?: number; onRef?: (o: Object3D) => void }) {
  const o = useProp(name, age);
  useEffect(() => { onRef?.(o); }, [o, onRef]);
  return <primitive object={o} position={p} rotation={rot ?? [0, yaw, 0]} scale={scale} />;
}

/** the photograph in the hall: a doorway in this house; after it has been seen, and then not looked at for a few
 *  seconds, the doorway has someone standing in it */
function ChangingPhoto() {
  const camera = useThree((s) => s.camera);
  const [a, b] = useMemo(() => [photo(false), photo(true)], []);
  const mat = useMemo(() => new MeshStandardMaterial({ map: a, roughness: 0.55 }), [a]);
  const st = useRef({ seen: 0, away: 0, changed: false });
  const pos = useMemo(() => new Vector3(-3.6, FY + 2.15, -65.81), []), dir = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    const s = st.current; if (s.changed) return;
    camera.getWorldDirection(dir);
    const to = pos.clone().sub(camera.position), d = to.length();
    const looking = d < 9 && dir.dot(to.normalize()) > 0.92;
    if (looking) { s.seen += dt; s.away = 0; } else if (s.seen > 1.2) s.away += dt;
    if (s.away > 3) { s.changed = true; mat.map = b; mat.needsUpdate = true; }
  });
  return (
    <group position={pos.toArray()}>
      <Prop name="fancy_picture_frame_01" p={[0, 0, -0.02]} scale={1.25} age={0.4} />
      <mesh material={mat} position={[0, 0, 0.012]}><planeGeometry args={[0.6, 0.44]} /></mesh>
    </group>
  );
}
function photo(figure: boolean) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 280;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 280); g.addColorStop(0, '#8a7a62'); g.addColorStop(1, '#5b4c3a'); x.fillStyle = g; x.fillRect(0, 0, 384, 280);
  // a panelled wall with a doorway, a floor, the sepia of an old print
  x.fillStyle = 'rgba(40,30,20,0.35)'; for (let i = 0; i < 6; i++) x.fillRect(20 + i * 62, 40, 46, 120);
  x.fillStyle = '#6d5c47'; x.fillRect(0, 205, 384, 75);
  x.fillStyle = '#120d09'; x.fillRect(158, 64, 74, 145);
  x.fillStyle = '#3b2d20'; x.fillRect(150, 58, 90, 8); x.fillRect(150, 58, 8, 152); x.fillRect(232, 58, 8, 152);
  if (figure) {
    // someone standing just inside the doorway, very tall, the head bowed, in shadow
    x.fillStyle = '#050403';
    x.beginPath(); x.ellipse(197, 84, 7, 10, 0.3, 0, Math.PI * 2); x.fill();
    x.fillRect(188, 93, 17, 58); x.fillRect(185, 98, 4, 70); x.fillRect(204, 98, 4, 72);
    x.fillRect(190, 150, 5, 58); x.fillRect(198, 150, 5, 58);
  }
  // grain, scratches, vignette
  const img = x.getImageData(0, 0, 384, 280);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 26; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  x.putImageData(img, 0, 0);
  const v = x.createRadialGradient(192, 140, 60, 192, 140, 240); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,6,2,0.75)'); x.fillStyle = v; x.fillRect(0, 0, 384, 280);
  x.strokeStyle = 'rgba(230,220,200,0.15)'; for (let i = 0; i < 5; i++) { x.beginPath(); const sx = Math.random() * 384; x.moveTo(sx, 0); x.lineTo(sx + (Math.random() - 0.5) * 40, 280); x.stroke(); }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/** the rocking chair, rocking on its own; it stops when looked at for a while, and starts again when not */
function RockingChair({ p, yaw }: { p: [number, number, number]; yaw: number }) {
  const ref = useRef<Object3D | null>(null);
  const st = useRef({ amp: 0.12, t: 0 });
  const camera = useThree((s) => s.camera), dir = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    const o = ref.current; if (!o) return; const s = st.current;
    camera.getWorldDirection(dir);
    const to = new Vector3(...p).sub(camera.position), looking = to.length() < 8 && dir.dot(to.normalize()) > 0.9;
    s.amp += ((looking ? 0.015 : 0.13) - s.amp) * (1 - Math.exp(-(looking ? 0.5 : 0.3) * dt));
    s.t += dt;
    o.rotation.x = Math.sin(s.t * 1.9) * s.amp;
  });
  return <group position={p} rotation={[0, yaw, 0]}><Prop name="Rockingchair_01" p={[0, -0.1, 0]} age={0.55} onRef={(o) => { ref.current = o; }} /></group>;
}

function Fireplace({ mats }: { mats: ShadowsMats }) {
  const em = useEstateMaterials();
  const x = H.living.x0 + 0.35, z = -61.2;
  return (
    <group position={[x, FY, z]}>
      <mesh material={em.stone} position={[0, 0.65, -0.95]} castShadow receiveShadow><boxGeometry args={[0.7, 1.3, 0.35]} /></mesh>
      <mesh material={em.stone} position={[0, 0.65, 0.95]} castShadow receiveShadow><boxGeometry args={[0.7, 1.3, 0.35]} /></mesh>
      <mesh material={em.stone} position={[0, 1.42, 0]} castShadow receiveShadow><boxGeometry args={[0.85, 0.25, 2.5]} /></mesh>
      <mesh material={em.stone} position={[0.05, 1.6, 0]} castShadow><boxGeometry args={[0.62, 0.1, 2.7]} /></mesh>
      <mesh material={mats.soot} position={[-0.2, 0.65, 0]}><boxGeometry args={[0.3, 1.3, 1.6]} /></mesh>
      <mesh material={em.stone} position={[0.25, 0.04, 0]} receiveShadow><boxGeometry args={[0.6, 0.08, 2.6]} /></mesh>
    </group>
  );
}

/** cold light through a window: a pale pane on the wall, and a soft beam into the room */
function MoonWindow({ p, yaw, w = 1.3, h = 2.0, target, power = 5 }: { p: [number, number, number]; yaw: number; w?: number; h?: number; target: [number, number, number]; power?: number }) {
  const spot = useMemo(() => { const s = new SpotLight('#9db5dc', power * 7, 14, 0.62, 0.9, 1.2); s.position.set(...p); s.target.position.set(...target); return s; }, [p, target, power]);
  const pane = useMemo(() => new MeshStandardMaterial({ color: '#0b0f14', emissive: new Color('#7f9cc4'), emissiveIntensity: 0.6, roughness: 0.6 }), []);
  return (
    <>
      <mesh material={pane} position={p} rotation={[0, yaw, 0]}><planeGeometry args={[w, h]} /></mesh>
      {[-w / 4, w / 4].map((o) => <mesh key={o} position={[p[0] + Math.cos(yaw) * o, p[1], p[2] - Math.sin(yaw) * o]} rotation={[0, yaw, 0]}><boxGeometry args={[0.04, h, 0.03]} /><meshStandardMaterial color="#111" /></mesh>)}
      <primitive object={spot} /><primitive object={spot.target} />
    </>
  );
}

/** a dim wall light: a small lantern and a warm point light; `flick` is driven by the pursuit (and the sighting) */
export const sconces: { lights: (PointLight | null)[]; dim: number[]; burst: boolean[] } = { lights: [], dim: [], burst: [] };
export const SCONCES: [number, number][] = [[-12.4, -68.4], [-6.8, -68.4], [-2.6, -66.2], [3.6, -68.4], [9.2, -66.2], [14.0, -68.4]];

function Sconces() {
  const glass = useMemo(() => SCONCES.map(() => new MeshStandardMaterial({ color: '#221a12', emissive: new Color('#ffad62'), emissiveIntensity: 1.6, transparent: true, opacity: 0.9 })), []);
  useEffect(() => { sconces.dim = SCONCES.map(() => 1); sconces.burst = SCONCES.map(() => false); }, []);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    SCONCES.forEach((_, i) => {
      const base = sconces.burst[i] ? 0 : (0.85 + 0.08 * Math.sin(t * 9 + i * 2) + 0.07 * Math.sin(t * 23 + i)) * (sconces.dim[i] ?? 1);
      const l = sconces.lights[i]; if (l) l.intensity = 5 * base;
      glass[i].emissiveIntensity = 1.6 * base;
    });
  });
  return (
    <>
      {SCONCES.map(([x, z], i) => {
        const facing = z > -67 ? Math.PI : 0;
        return (
          <group key={i} position={[x, FY + 2.05, z]} rotation={[0, facing, 0]}>
            <mesh material={glass[i]} position={[0, 0, 0.14]}><cylinderGeometry args={[0.07, 0.09, 0.22, 10]} /></mesh>
            <mesh position={[0, -0.12, 0.08]}><boxGeometry args={[0.05, 0.05, 0.16]} /><meshStandardMaterial color="#1a1816" metalness={0.7} roughness={0.5} /></mesh>
            <pointLight ref={(l) => { sconces.lights[i] = l; }} position={[0, 0, 0.3]} color="#ffaa5c" intensity={5} distance={7} decay={2} />
          </group>
        );
      })}
    </>
  );
}

/** a dark shape that slides along the corridor wall, once, the first time the visitor is in its west half */
function WallShadow() {
  const m = useRef<Mesh>(null);
  const mat = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const x = c.getContext('2d')!, g = x.createRadialGradient(64, 110, 4, 64, 120, 90);
    g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.6, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(64, 70, 26, 34, 0, 0, Math.PI * 2); x.ellipse(64, 170, 46, 90, 0, 0, Math.PI * 2); x.fill();
    return new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0 });
  }, []);
  const st = useRef({ t: -1 });
  useFrame((_, dt) => {
    const s = st.current, p = playerState.position;
    if (s.t < 0 && p.x < -4 && p.x > -11 && p.z < -66 && p.z > -68.6 && p.y > FY - 0.5) { s.t = 0; audio.whisper(); }
    if (s.t < 0 || !m.current) return;
    s.t += dt;
    const k = Math.min(1, s.t / 1.4);
    m.current.position.x = -11.6 - k * 3.4;
    mat.opacity = Math.sin(Math.min(1, s.t / 1.4) * Math.PI) * 0.8;
    if (s.t > 1.5) { mat.opacity = 0; s.t = 99; }
  });
  return <mesh ref={m} material={mat} position={[-11.6, FY + 1.5, -68.43]}><planeGeometry args={[1.2, 2.6]} /></mesh>;
}

/** a curtain at a window: a hanging cloth that stirs in a draught */
function Curtain({ p, w, h }: { p: [number, number, number]; w: number; h: number }) {
  const geo = useMemo(() => new PlaneGeometry(w, h, 12, 10), [w, h]);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#4c4238', roughness: 1, side: DoubleSide, transparent: true, opacity: 0.92 }), []);
  useFrame((st) => {
    const t = st.clock.elapsedTime, pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], hang = (h / 2 - y) / h;
      pos.setZ(i, Math.sin(x * 9 + t * 1.1) * 0.03 + Math.sin(t * 0.7 + x * 3) * 0.06 * hang * hang);
    }
    pos.needsUpdate = true;
  });
  return <mesh geometry={geo} material={mat} position={p} castShadow />;
}

/** the smoke in the house: photographic vapour sprites ("Smoke vapor particles", OpenGameArt, CC0), each a slow
 *  wisp that rises a little, turns, swells and thins out over ten seconds or so, then begins again elsewhere in its room;
 *  scattered through every room, the corridor and the stairs (about 100 of them), each at about half opacity, lying low (mostly below eye level, so the rooms
 *  and the corridor can still be seen through),  tinted a
 *  sickly green, faintly lit from within, thinned close to the eyes so you look through it */
const WISP_URLS = [1, 2, 3, 4].map((i) => `${SHADOWS_BASE}/fx/smoke_vapor${i}.webp`);
function SmokeWisps() {
  const tex = useLoader(TextureLoader, WISP_URLS);
  const camera = useThree((st) => st.camera);
  const wisps = useMemo(() => {
    tex.forEach((t) => { t.colorSpace = SRGBColorSpace; });
    type Area = [number, number, number, number, number, number, number];   // x0, x1, z0, z1, floor, height, count
    const AREAS: Area[] = [
      [H.hall.x0 + 0.5, H.hall.x1 - 0.5, H.hall.z0 - 0.5, H.hall.z1 + 0.5, FY, 0.9, 26],
      [H.living.x0 + 0.5, H.living.x1 - 0.5, H.living.z0 - 0.5, H.living.z1 + 0.5, FY, 0.8, 22],
      [H.side.x0 + 0.5, H.side.x1 - 0.5, H.side.z0 - 0.5, H.side.z1 + 0.5, FY, 0.8, 18],
      [H.corridor.x0 + 0.4, H.corridor.x1 - 0.4, H.corridor.z0 - 0.35, H.corridor.z1 + 0.35, FY, 0.5, 20],
      [H.bedroom.x0 + 0.5, H.bedroom.x1 - 0.5, H.bedroom.z0 - 0.5, H.bedroom.z1 + 0.5, FY, 0.7, 12],
      [H.stairs.x0 + 0.3, H.stairs.x1, H.stairs.z0 - 0.35, H.stairs.z1 + 0.35, P + 0.6, 1.8, 8],
    ];
    const out: { s: Sprite; area: Area; home: Vector3; life: number; len: number; spin: number; size: number; drift: Vector3 }[] = [];
    const place = (a: Area, v: Vector3) => v.set(a[0] + Math.random() * (a[1] - a[0]), a[4] + 0.1 + Math.random() * a[5], a[3] + Math.random() * (a[2] - a[3]));
    let k = 0;
    for (const a of AREAS) for (let i = 0; i < a[6]; i++, k++) {
      const m = new SpriteMaterial({ map: tex[k % tex.length], color: new Color('#8fcf9f'), transparent: true, depthWrite: false, opacity: 0, fog: false });
      const sp = new Sprite(m); sp.raycast = () => {}; sp.renderOrder = 7;
      m.rotation = Math.random() * Math.PI * 2;
      out.push({ s: sp, area: a, home: place(a, new Vector3()), life: Math.random() * 14, len: 10 + Math.random() * 8, spin: (Math.random() - 0.5) * 0.1, size: 1.4 + Math.random() * 1.6, drift: new Vector3((Math.random() - 0.5) * 0.1, 0.01 + Math.random() * 0.02, (Math.random() - 0.5) * 0.1) });
    }
    return { out, place };
  }, [tex]);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    for (const w of wisps.out) {
      w.life += dt;
      if (w.life > w.len) { w.life = 0; wisps.place(w.area, w.home); }       // begins again somewhere else in the room
      const t = w.life / w.len;
      // about half opacity for most of its life, easing in and out at the ends
      const env = Math.min(1, t / 0.18) * Math.min(1, (1 - t) / 0.22);
      w.s.position.copy(w.home).addScaledVector(w.drift, w.life);
      w.s.scale.setScalar(w.size * (0.8 + 0.35 * t));
      const m = w.s.material as SpriteMaterial;
      m.rotation += w.spin * dt;
      const near = Math.min(1, Math.max(0, (w.s.position.distanceTo(camera.position) - 0.8) / 1.6));   // thinner right at the eyes
      m.opacity = 0.5 * env * near;
    }
  });
  return (
    <>
      {wisps.out.map((w, i) => <primitive key={i} object={w.s} />)}
      {/* the glow inside it */}
      {[[0, -61], [-11, -61], [-8, -67.3], [6, -67.3], [-11, -70.2], [11, -61]].map(([x, z], i) => (
        <pointLight key={`g${i}`} position={[x, FY + 0.35, z]} color="#5fd88a" intensity={2.4} distance={6} decay={2} />
      ))}
    </>
  );
}

/** a page of pencil drawings for the drawing desk (loose doodles; no subject or story behind them) */
function drawingTexture(seed: number) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 340;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ddd5c0'; x.fillRect(0, 0, 256, 340);
  x.fillStyle = 'rgba(110,90,60,0.14)'; for (let i = 0; i < 1500; i++) x.fillRect(Math.random() * 256, Math.random() * 340, 1, 1);
  x.strokeStyle = 'rgba(35,35,45,0.7)'; x.lineCap = 'round';
  let r = seed; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 6; k++) {
    x.lineWidth = 1 + rnd() * 1.6; x.beginPath();
    const cx = 40 + rnd() * 176, cy = 50 + rnd() * 240, n = 5 + Math.floor(rnd() * 6);
    for (let i = 0; i <= n; i++) { const a = (i / n) * 6.28, rr = 18 + rnd() * 30; (i ? x.lineTo : x.moveTo).call(x, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    x.stroke();
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/** 03 · The House of Memories: a drawing desk in the bedroom, the games in the living room, the empty rocking chair */
function HouseMemories({ mats }: { mats: ShadowsMats }) {
  const SURV = `${import.meta.env.BASE_URL}models/survival/props`;
  const consoleScene = useGLTF(`${SURV}/gaming_console.glb`).scene, padScene = useGLTF(`${SURV}/gamepad.glb`).scene;
  const games = useMemo(() => {
    const g = new Group();
    const add = (scene: Object3D, p: [number, number, number], yaw: number) => {
      const o = scene.clone(true); o.traverse((c) => { const m = c as Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; const mm = (m.material as MeshStandardMaterial).clone(); mm.color.multiplyScalar(0.7); m.material = mm; } });
      const b = new Box3().setFromObject(o); o.position.y -= b.min.y;
      const h = new Group(); h.add(o); h.position.set(...p); h.rotation.y = yaw; g.add(h);
    };
    add(consoleScene, [-14.85, FY, -60.25], 1.4);
    add(padScene, [-13.2, FY + 0.005, -60.7], 2.4);
    return g;
  }, [consoleScene, padScene]);
  const pages = useMemo(() => [11, 47, 93].map((seed) => new MeshStandardMaterial({ map: drawingTexture(seed), roughness: 0.95 })), []);
  return (
    <>
      {/* the drawing desk, against the bedroom's east wall: loose pages, a pencil */}
      <Prop name="ClassicConsole_01" p={[-6.5, FY, -70.3]} yaw={-Math.PI / 2} age={0.5} />
      {pages.map((m, i) => (
        <mesh key={i} material={m} position={[-6.55 + (i - 1) * 0.04, FY + 0.958 + i * 0.002, -70.3 + (i - 1) * 0.32]} rotation={[-Math.PI / 2, 0, 1.57 + (i - 1) * 0.25]} receiveShadow><planeGeometry args={[0.21, 0.28]} /></mesh>
      ))}
      <mesh position={[-6.5, FY + 0.965, -69.95]} rotation={[0, 0.4, Math.PI / 2]}><cylinderGeometry args={[0.0035, 0.0035, 0.17, 6]} /><meshStandardMaterial color="#b48a2c" /></mesh>
      {/* the games: an old television on the floor by the hearth, the console beside it, a controller by the sofa */}
      <Prop name="Television_01" p={[-14.9, FY, -59.2]} yaw={Math.PI / 2} age={0.45} />
      {/* the set is still on, a faint cold glow on the floor in front of it */}
      <pointLight color="#9fb8d8" intensity={1.1} distance={3.2} decay={2} position={[-14.2, FY + 0.45, -59.2]} />
      <primitive object={games} />
      <Interactable id="shadows-drawing" label="the drawing desk" verb="look at" reach={3} onInteract={() => openDiscovery('shadows-drawing')} position={[-6.6, FY + 1.05, -70.3]}>
        <mesh visible={false}><boxGeometry args={[0.6, 0.4, 1.5]} /></mesh>
      </Interactable>
      <Interactable id="shadows-games" label="the games" verb="look at" reach={3.2} onInteract={() => openDiscovery('shadows-games')} position={[-14.6, FY + 0.35, -59.6]}>
        <mesh visible={false}><boxGeometry args={[0.8, 0.6, 1.4]} /></mesh>
      </Interactable>
      <Interactable id="shadows-chair" label="the empty chair" verb="look at" reach={3} onInteract={() => openDiscovery('shadows-chair')} position={[-8.4, FY + 0.6, -64.3]}>
        <mesh visible={false}><boxGeometry args={[0.8, 1.1, 0.9]} /></mesh>
      </Interactable>
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        <CuboidCollider args={[0.3, 0.48, 0.77]} position={[-6.5, FY + 0.48, -70.3]} />
        <CuboidCollider args={[0.3, 0.25, 0.3]} position={[-14.9, FY + 0.25, -59.2]} />
      </RigidBody>
      {void mats}
    </>
  );
}

// ------------------------------------------------------------------------------------------------- the house
export function House() {
  const mats = useShadowsMaterials();
  const sideAjar = useRef(0);
  const camera = useThree((s) => s.camera);
  const sideEvent = useRef({ seen: 0, away: 0, done: false, thud: false });
  const dir = useMemo(() => new Vector3(), []);
  // the side room's door: once it has been seen shut from the hall and then not looked at for a while, it stands open
  useFrame((_, dt) => {
    const e = sideEvent.current, p = playerState.position;
    const inHall = p.x > H.hall.x0 && p.x < H.hall.x1 && p.z < H.hall.z0 && p.z > H.hall.z1 && p.y > FY - 0.5;
    if (!e.done && inHall) {
      camera.getWorldDirection(dir);
      const to = new Vector3(H.side.x0, FY + 1.3, -62.3).sub(camera.position).normalize();
      if (dir.dot(to) > 0.85) { e.seen += dt; e.away = 0; } else if (e.seen > 0.8) e.away += dt;
      if (e.away > 2.5) { e.done = true; sideAjar.current = 0.28; audio.creak(0.25); }
    }
    // something falls upstairs, the first time the visitor stands in the side room
    if (!e.thud && p.x > H.side.x0 + 1 && p.z < H.side.z0 && p.z > H.side.z1 && p.y > FY - 0.5) { e.thud = true; audio.thud(0.7); }
  });
  const doorFront = 1.22;
  return (
    <group>
      <Shell mats={mats} />
      <SmokeWisps />
      <HouseMemories mats={mats} />
      <Steps mats={mats} />
      {/* the front door (opens inward), the room doors */}
      <Door hinge={[H.door.x0 + 0.02, FY, -56.42]} width={2.46} height={3.6} closedYaw={0} openYaw={1.75} near={4.2}>
        <Prop name="large_castle_door" p={[1.23, 0, 0]} scale={doorFront} age={0.4} />
      </Door>
      <Door hinge={[H.hall.x0, FY, H.living.door[1]]} width={2.0} height={2.55} closedYaw={Math.PI / 2} openYaw={Math.PI / 2 + 1.6} near={2.2}>
        <PlankDoor width={2.0} height={2.55} mats={mats} />
      </Door>
      <Door hinge={[H.hall.x1, FY, H.side.door[1]]} width={1.8} height={2.55} closedYaw={Math.PI / 2} openYaw={Math.PI / 2 - 1.5} near={2.0} ajar={sideAjar}>
        <PlankDoor width={1.8} height={2.55} mats={mats} />
      </Door>
      <Door hinge={[H.bedroom.door[1], FY, H.corridor.z1]} width={1.4} height={2.45} closedYaw={Math.PI} openYaw={Math.PI - 1.6} near={2.0}>
        <PlankDoor width={1.4} height={2.45} mats={mats} />
      </Door>

      {/* the hall */}
      <Prop name="Chandelier_01" p={[0, FY + H.hall.h, -61.2]} scale={2.3} age={0.5} />
      <HallLight />
      <Prop name="vintage_grandfather_clock_01" p={[H.hall.x0 + 0.3, FY, -58.4]} yaw={Math.PI / 2} scale={1.1} age={0.45} />
      <Prop name="GothicCabinet_01" p={[H.hall.x1 - 0.5, FY, -58.6]} yaw={-Math.PI / 2} age={0.5} />
      <Prop name="ClassicConsole_01" p={[-3.6, FY, -65.5]} age={0.5} />
      <ChangingPhoto />
      <HallStair mats={mats} />
      <MoonWindow p={[-3.6, FY + 2.3, -56.33]} yaw={Math.PI} target={[-2, FY, -61]} />
      <MoonWindow p={[3.6, FY + 2.3, -56.33]} yaw={Math.PI} target={[2.2, FY, -61]} />
      <MoonWindow p={[0, FY + 5.6, -56.33]} yaw={Math.PI} w={1.6} h={1.8} target={[0, FY, -63]} power={4} />

      {/* the living room */}
      <Fireplace mats={mats} />
      <Prop name="Sofa_01" p={[-12.4, FY, -61.2]} yaw={-Math.PI / 2} scale={1.15} age={0.55} />
      <Prop name="ArmChair_01" p={[-13.6, FY, -58.3]} yaw={-2.2} age={0.55} />
      <Prop name="ArmChair_01" p={[-13.6, FY, -64.1]} yaw={-0.9} age={0.55} />
      <RockingChair p={[-8.4, FY, -64.3]} yaw={2.6} />
      <Prop name="wooden_bookshelf_worn" p={[-10.5, FY, -65.55]} age={0.4} />
      <Prop name="GothicCommode_01" p={[-8.6, FY, -56.98]} yaw={Math.PI} age={0.5} />
      <pointLight position={[-8.6, FY + 1.6, -57.4]} color="#ff9e57" intensity={5} distance={8} decay={2} />
      <mesh position={[-8.6, FY + 1.3, -57.1]}><cylinderGeometry args={[0.025, 0.025, 0.14, 8]} /><meshStandardMaterial color="#d9cfb8" emissive="#ffb56e" emissiveIntensity={0.6} /></mesh>
      <MoonWindow p={[-10.6, FY + 2.2, -56.33]} yaw={Math.PI} target={[-11, FY, -61]} />
      <MoonWindow p={[-14.2, FY + 2.2, -56.33]} yaw={Math.PI} target={[-14, FY, -61]} power={3.5} />

      {/* the side room: dust sheets, a mirror, a cabinet; no light but the moon */}
      {[[9, -60.2, 1.8, 0.9, 0.9], [12.6, -63.8, 1.2, 1.4, 0.8], [14.2, -59.2, 0.9, 1.0, 0.9]].map(([x, z, w, h, d], i) => (
        <RoundedBox key={i} args={[w, h, d]} radius={0.12} smoothness={3} position={[x, FY + h / 2, z]} rotation={[0, i * 0.4, 0]} material={mats.cloth} castShadow receiveShadow />
      ))}
      <Prop name="ornate_mirror_01" p={[H.side.x1 - 0.17, FY + 1.75, -61.8]} yaw={-Math.PI / 2} scale={1.6} age={0.6} />
      <Prop name="GothicCommode_01" p={[10.6, FY, -65.55]} age={0.6} />
      <MoonWindow p={[11, FY + 2.2, -56.33]} yaw={Math.PI} target={[11, FY, -61]} power={3} />

      {/* the corridor */}
      <mesh position={[0, FY + 0.014, -67.3]} rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[30, 1.15]} /><meshStandardMaterial color="#2e1414" roughness={1} /></mesh>
      <Sconces />
      {[-13.6, -8.6, -4.4, 2.2, 6.6, 11.6].map((x, i) => (
        <Prop key={x} name="fancy_picture_frame_01" p={[x, FY + 1.8 + (i % 2) * 0.12, i % 2 ? -66.17 : -68.43]} yaw={i % 2 ? Math.PI : 0} rot={[0, i % 2 ? Math.PI : 0, (i % 3 - 1) * 0.05]} scale={1.1} age={0.6} />
      ))}
      <WallShadow />

      {/* the bedroom */}
      <Prop name="GothicBed_01" p={[-14.5, FY, -70.25]} yaw={Math.PI / 2} age={0.55} />
      <Prop name="GothicCommode_01" p={[-10.2, FY, -71.6]} age={0.55} />
      <Prop name="ornate_mirror_01" p={[-10.2, FY + 1.9, -71.93]} scale={1.3} age={0.65} />
      <MoonWindow p={[-7.6, FY + 1.9, -71.93]} yaw={0} w={1.1} h={1.7} target={[-10, FY, -69.6]} power={3.5} />
      <Curtain p={[-8.25, FY + 1.85, -71.85]} w={0.5} h={2.2} />
      <Curtain p={[-6.95, FY + 1.85, -71.85]} w={0.5} h={2.2} />


      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        <CuboidCollider args={[0.35, 1.1, 0.25]} position={[H.hall.x0 + 0.35, FY + 1.1, -58.4]} />
        <CuboidCollider args={[0.6, 1.2, 0.9]} position={[H.hall.x1 - 0.5, FY + 1.2, -58.6]} />
        <CuboidCollider args={[0.8, 0.5, 0.3]} position={[-3.6, FY + 0.5, -65.5]} />
        <CuboidCollider args={[0.45, 0.45, 0.95]} position={[-12.4, FY + 0.45, -61.2]} />
        <CuboidCollider args={[0.7, 1.0, 0.3]} position={[-10.5, FY + 1.0, -65.55]} />
        <CuboidCollider args={[0.65, 0.65, 0.3]} position={[-8.6, FY + 0.6, -56.98]} />
        <CuboidCollider args={[1.05, 0.7, 0.75]} position={[-14.5, FY + 0.7, -70.25]} />
        <CuboidCollider args={[0.6, 0.6, 0.3]} position={[-10.2, FY + 0.6, -71.6]} />
        <CuboidCollider args={[0.45, 0.8, 1.3]} position={[H.living.x0 + 0.35, FY + 0.8, -61.2]} />
      </RigidBody>
    </group>
  );
}

/** the chandelier's few working bulbs: weak, warm, unsteady */
function HallLight() {
  const l = useRef<PointLight>(null);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    let k = 0.8 + 0.12 * Math.sin(t * 6.1) + 0.08 * Math.sin(t * 15.3);
    if ((t % 11) > 9.4) k *= Math.sin(t * 50) > -0.2 ? 0.4 : 1;
    if (l.current) l.current.intensity = 30 * k;
  });
  return <pointLight ref={l} position={[0, FY + 5.6, -61.2]} color="#ffb06a" intensity={22} distance={15} decay={2} castShadow={false} />;
}

/** the hall staircase: a flight up along the back wall to a landing, where the upper flight has fallen in */
function HallStair({ mats }: { mats: ShadowsMats }) {
  const em = useEstateMaterials();
  const n = 14, x0 = 1.6, x1 = 5.0, rise = 2.7 / n, run = (x1 - x0) / n, z = -65.05;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} material={mats.darkWood} position={[x0 + run * (i + 0.5), FY + rise * (i + 1) / 2, z]} castShadow receiveShadow><boxGeometry args={[run + 0.02, rise * (i + 1), 1.55]} /></mesh>
      ))}
      <mesh material={mats.darkWood} position={[5.45, FY + 1.35, -64.7]} castShadow receiveShadow><boxGeometry args={[1.0, 2.7, 2.2]} /></mesh>
      {/* the balustrade: posts and a rail, some missing */}
      {Array.from({ length: 12 }, (_, i) => i).filter((i) => i !== 5 && i !== 8).map((i) => {
        const x = x0 + 0.15 + i * (x1 - x0 - 0.3) / 11, y = FY + (x - x0) / (x1 - x0) * 2.7;
        return <mesh key={i} material={mats.darkWood} position={[x, y + 0.5, -64.32]} castShadow><cylinderGeometry args={[0.025, 0.03, 0.95, 8]} /></mesh>;
      })}
      <mesh material={mats.darkWood} position={[(x0 + x1) / 2, FY + 1.35 + 1.0, -64.32]} rotation={[0, 0, Math.atan2(2.7, x1 - x0)]} castShadow><boxGeometry args={[Math.hypot(x1 - x0, 2.7), 0.07, 0.08]} /></mesh>
      {/* the collapsed upper flight: broken boards and beams fallen across the landing */}
      {[[5.2, 0.4, 0.4, 0.2], [5.6, 0.7, -0.3, 1.1], [5.0, 0.55, 0.2, -0.7]].map(([x, h, r1, r2], i) => (
        <mesh key={i} material={mats.darkWood} position={[x, FY + 2.7 + h, -64.4 + i * 0.3]} rotation={[r1, i, r2]} castShadow><boxGeometry args={[2.2, 0.16, 0.24]} /></mesh>
      ))}
      <mesh material={em.stone} position={[5.4, FY + 2.85, -63.9]} rotation={[0.3, 0.5, 0.2]} castShadow><dodecahedronGeometry args={[0.35, 0]} /></mesh>
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        <CuboidCollider args={[Math.hypot(x1 - x0, 2.7) / 2, 0.08, 0.78]} position={[(x0 + x1) / 2, FY + 1.35 - 0.09, z]} rotation={[0, 0, Math.atan2(2.7, x1 - x0)]} />
        <CuboidCollider args={[0.5, 1.35, 1.1]} position={[5.45, FY + 1.35, -64.7]} />
        <CuboidCollider args={[0.5, 0.6, 1.1]} position={[5.45, FY + 3.3, -64.7]} />
      </RigidBody>
    </group>
  );
}

/* Chapter 01's discoveries that need more than an invisible hit box (content: data/chapter01.ts, photos.ts):
   - the photo wall: a rough timber memory board on house A's east wall, above the cabinet, holding six framed
     photographs from photos.ts (each its own frame and image texture, slightly askew, hung on nails). Pressing E
     leans in to the photographs one at a time (no panel: the photo fills the view, its caption as plain text below;
     InfoPanel's PhotoViewer).
   - the motorcycle: an interaction point on the existing model. (The portal has none: walking into it carries the
     visitor straight on to Chapter 02, PortalPull.tsx.)
   - the views rendered for the sungka and motorcycle panels.
   - the oil lamp's response to E: the flame swells and a warm glow blooms around it for a few seconds.
   All use the existing white-diamond interaction system (Interactable). */
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Box3, Color, DoubleSide, Group, MathUtils, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SRGBColorSpace, Sprite, SpriteMaterial, TextureLoader, CanvasTexture, Vector3, type Mesh, type Object3D, type PerspectiveCamera, type PointLight, type Texture } from 'three';
import { useGLTF } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { GROUPS } from '../../physics/CollisionLayers';
import { wallPhotos } from '../../data/photos';
import { getGame, setGame } from '../../game/GameState';
import { director } from '../../game/director';
import { Interactable } from '../../interactions/Interactable';
import { lookFor } from '../../rendering/looks';
import { snapshotters, takeSnapshot } from '../../rendering/snapshots';
import { applyWeather } from '../../rendering/weather';
import type { PlacedHouse } from './Houses';
import { SURVIVAL_BASE } from './layout';
import { VEHICLE_PLACEMENTS } from './Props';

const UP = new Vector3(0, 1, 0);
const HIT = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });

/** open a discovery's information panel (movement and look pause while it is open) */
export function openDiscovery(id: string) {
  setGame({ mode: 'reading', reading: id, prompt: null });
  document.exitPointerLock?.();
}

// ------------------------------------------------------------------------------------------------- the photo wall
const WALL = { x: 2.86, z: -1.42, y: 1.66, w: 1.25, h: 0.86 };       // on the inside of the east wall, above the cabinet
type Slot = { z: number; y: number; w: number; h: number; tilt: number };
/** five or six photographs: a grid of smaller frames */
const GRID: Slot[] = [
  { z: -0.38, y: 0.18, w: 0.3, h: 0.22, tilt: 0.04 },
  { z: -0.02, y: 0.2, w: 0.24, h: 0.3, tilt: -0.03 },
  { z: 0.36, y: 0.16, w: 0.3, h: 0.22, tilt: 0.02 },
  { z: -0.36, y: -0.16, w: 0.26, h: 0.2, tilt: -0.05 },
  { z: 0.0, y: -0.17, w: 0.3, h: 0.22, tilt: 0.03 },
  { z: 0.37, y: -0.15, w: 0.22, h: 0.29, tilt: -0.02 },
];
/** up to four: a loose, staggered row of larger frames, portrait-shaped like most phone photos */
const ROW: Slot[] = [
  { z: -0.43, y: 0.14, w: 0.25, h: 0.36, tilt: 0.035 },
  { z: -0.14, y: -0.11, w: 0.26, h: 0.27, tilt: -0.03 },
  { z: 0.15, y: 0.13, w: 0.25, h: 0.34, tilt: 0.02 },
  { z: 0.44, y: -0.1, w: 0.25, h: 0.34, tilt: -0.025 },
];

/** fit a photo to its frame like CSS object-fit: cover (no stretching). A portrait crop keeps more of the top,
 *  where faces usually are. */
function cover(t: Texture, frameAspect: number) {
  const img = t.image as { width?: number; height?: number } | undefined;
  const aspect = img?.width && img.height ? img.width / img.height : frameAspect;
  t.repeat.set(1, 1); t.offset.set(0, 0);
  if (aspect > frameAspect) { t.repeat.x = frameAspect / aspect; t.offset.x = (1 - t.repeat.x) / 2; }
  else { t.repeat.y = aspect / frameAspect; t.offset.y = (1 - t.repeat.y) * 0.72; }
}

function PhotoWall() {
  const photos = wallPhotos();
  const slots = photos.length <= ROW.length ? ROW : GRID;
  const tex = useLoader(TextureLoader, photos.map((p) => p.src));
  const timberTex = useLoader(TextureLoader, [`${SURVIVAL_BASE}/housea/timber_diff.webp`, `${SURVIVAL_BASE}/housea/timber_nor.webp`]);
  const mats = useMemo(() => {
    tex.forEach((t, i) => { t.colorSpace = SRGBColorSpace; t.anisotropy = 8; if (slots[i]) cover(t, slots[i].w / slots[i].h); });
    const board = new MeshStandardMaterial({ map: timberTex[0], normalMap: timberTex[1], color: 0x8a7764, roughness: 0.9 });
    const frame = new MeshStandardMaterial({ map: timberTex[0], normalMap: timberTex[1], color: 0x4a3a2c, roughness: 0.8 });
    const nail = new MeshStandardMaterial({ color: 0x333230, metalness: 0.7, roughness: 0.45 });
    // each photo can glow softly (its own image as the emissive map) when it is the one picked in the gallery
    const pics = tex.map((t) => new MeshStandardMaterial({ map: t, roughness: 0.55, side: DoubleSide, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0 }));
    [board, frame, nail, ...pics].forEach((m) => applyWeather(m));
    return { board, frame, nail, pics };
  }, [tex, timberTex, slots]);
  // E at the wall: the camera leans in to one photograph at a time (InfoPanel's PhotoViewer picks it), filling most
  // of the view, square to the frame and tilted with it, and glides along the wall from one to the next
  const pics = useRef<(Mesh | null)[]>([]);
  const view = useRef({ on: false, pos: new Vector3(), look: new Vector3(), up: new Vector3(0, 1, 0), w: 0, t: 0 });
  const tmp = useMemo(() => ({ c: new Vector3(), n: new Vector3(), u: new Vector3(), q: new Quaternion() }), []);
  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 0), 0.1), open = getGame().reading === 'survival-photograph';
    mats.pics.forEach((m, i) => { const want = open && director.photo === i ? 0.22 : 0; m.emissiveIntensity += (want - m.emissiveIntensity) * (1 - Math.exp(-5 * dt)); });
    const v = view.current, o = director.override, mesh = pics.current[director.photo];
    const want = open && mesh ? 1 : 0;
    if (!v.on && !want) return;
    if (!v.on) {                                                          // start from where the eyes are
      v.on = true; v.pos.copy(camera.position); camera.getWorldDirection(tmp.n); v.look.copy(camera.position).addScaledVector(tmp.n, 2); v.up.set(0, 1, 0);
    }
    if (mesh) {
      const s = slots[director.photo], cam = camera as PerspectiveCamera, fov = 38;
      mesh.getWorldPosition(tmp.c); mesh.getWorldDirection(tmp.n);
      tmp.u.set(0, 1, 0).applyQuaternion(mesh.getWorldQuaternion(tmp.q));
      // far enough that the whole photo fills ~55% of the view (by its height, or its width on a narrow screen), and
      // sitting a little above the middle, clear of the caption below it
      const tan = Math.tan(MathUtils.degToRad(fov / 2));
      const half = Math.max(s.h, s.w / Math.max(0.5, cam.aspect)) / 2;
      const dist = half / tan / 0.55;
      tmp.c.addScaledVector(UP, -0.16 * 2 * dist * tan);
      v.t += dt;
      const k = 1 - Math.exp(-3.2 * dt);
      v.pos.lerp(tmp.n.multiplyScalar(dist).add(tmp.c).setY(tmp.c.y + Math.sin(v.t * 1.3) * 0.003), k);
      v.look.lerp(tmp.c, k);
      v.up.lerp(tmp.u.lerp(UP, 0.45), k).normalize();
      o.fov = fov;
    }
    v.w += (want - v.w) * (1 - Math.exp(-(want ? 2.6 : 3.4) * dt));
    o.pos.copy(v.pos); o.look.copy(v.look); o.up.copy(v.up); o.weight = MathUtils.smootherstep(v.w, 0, 1);
    if (!want && v.w < 0.004) { v.on = false; v.w = 0; o.weight = 0; o.up.set(0, 1, 0); }
  });
  return (
    <Interactable id="survival-photograph" label="the photo wall" verb="look at" onInteract={() => openDiscovery('survival-photograph')} position={[WALL.x, WALL.y, WALL.z]}>
      {/* facing into the room (−x): local z of the board points along −x */}
      <group rotation-y={-Math.PI / 2}>
        <mesh material={mats.board} castShadow receiveShadow><boxGeometry args={[WALL.w, WALL.h, 0.025]} /></mesh>
        {slots.slice(0, photos.length).map((s, i) => (
          // each frame a hair further out than the one before: overlapping frame edges never fight (flicker)
          <group key={i} position={[s.z, s.y, 0.018 + i * 0.003]} rotation-z={s.tilt}>
            <mesh material={mats.frame} castShadow><boxGeometry args={[s.w + 0.04, s.h + 0.04, 0.014]} /></mesh>
            {mats.pics[i] && <mesh ref={(m) => { pics.current[i] = m; }} material={mats.pics[i]} position={[0, 0, 0.0075]}><planeGeometry args={[s.w, s.h]} /></mesh>}
            <mesh material={mats.nail} position={[0, s.h / 2 + 0.035, 0.008]}><cylinderGeometry args={[0.005, 0.005, 0.02, 6]} /></mesh>
          </group>
        ))}
        <mesh material={HIT} position={[0, 0, 0.06]}><boxGeometry args={[WALL.w, WALL.h, 0.1]} /></mesh>
      </group>
    </Interactable>
  );
}

// ------------------------------------------------------------------------------------------------- the oil lamp
/** when the lamp is examined: time of the press (s, page clock), read by the lamp light and its glow */
export const lampFx = { at: -1e9 };
export const nowS = () => performance.now() / 1000;
/** the lamp's swell over time since E: up over half a second, held, eased back after ~9 s */
export function lampBoost(now = nowS()) {
  const t = now - lampFx.at;
  if (t < 0 || t > 11) return 0;
  return Math.min(1, t / 0.5) * (t < 9 ? 1 : 1 - (t - 9) / 2);
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,220,170,1)'); r.addColorStop(0.25, 'rgba(255,170,90,0.55)'); r.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

export function LampGlow({ p }: { p: [number, number, number] }) {
  const sprite = useMemo(() => {
    const s = new Sprite(new SpriteMaterial({ map: glowTexture(), color: new Color('#ffb46b'), blending: AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    s.position.set(p[0], p[1] + 0.06, p[2]); s.raycast = () => {};
    return s;
  }, [p]);
  useFrame(({ clock }) => {
    const k = lampBoost(), t = clock.elapsedTime;
    const flick = 0.92 + 0.05 * Math.sin(t * 9.1) + 0.03 * Math.sin(t * 17.3);
    sprite.scale.setScalar((0.22 + 0.38 * k) * flick);
    (sprite.material as SpriteMaterial).opacity = (0.35 + 0.9 * k) * flick;
  });
  return <primitive object={sprite} />;
}

// --------------------------------------------------------------------------------- games and drawings (the bench)
/** where the sungka board lay on the shelter's bench (SurvivalChapter placeSungka): seat height, spot, bench yaw */
export const gamesSpot: { seat: number; at: [number, number, number] | null; yaw: number } = { seat: 0, at: null, yaw: 0 };
const PROPS_BASE = `${SURVIVAL_BASE}/props`;
useGLTF.preload(`${PROPS_BASE}/gaming_console.glb`); useGLTF.preload(`${PROPS_BASE}/gamepad.glb`); useGLTF.preload(`${PROPS_BASE}/old_computer.glb`);

/** a page of a kid's pencil drawings (a sketchbook spread): loose doodles, no particular subject or story */
function sketchTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 360;
  const x = c.getContext('2d')!;
  x.fillStyle = '#e9e2cf'; x.fillRect(0, 0, 512, 360);
  x.fillStyle = 'rgba(120,100,70,0.12)'; for (let i = 0; i < 2500; i++) x.fillRect(Math.random() * 512, Math.random() * 360, 1, 1);
  x.strokeStyle = 'rgba(40,40,48,0.75)'; x.lineCap = 'round'; x.lineJoin = 'round';
  const wob = (a: number) => a + (Math.random() - 0.5) * 2.2;
  const path = (pts: [number, number][], w = 2) => { x.lineWidth = w; x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(wob(px), wob(py)) : x.moveTo(px, py))); x.stroke(); };
  // left page: a robot; right page: a little house under a sun, and some practice shapes
  path([[70, 120], [150, 120], [150, 210], [70, 210], [70, 120]], 2.4); path([[90, 90], [130, 90], [130, 120], [90, 120], [90, 90]]);
  x.beginPath(); x.arc(102, 103, 5, 0, 6.3); x.arc(120, 103, 5, 0, 6.3); x.stroke();
  path([[110, 90], [110, 70]]); x.beginPath(); x.arc(110, 66, 5, 0, 6.3); x.stroke();
  path([[70, 140], [40, 175]]); path([[150, 140], [182, 168]]); path([[90, 210], [86, 260]]); path([[130, 210], [134, 260]]);
  path([[82, 150], [138, 150]], 1.4); path([[82, 165], [118, 165]], 1.4);
  path([[300, 230], [300, 170], [350, 130], [400, 170], [400, 230], [300, 230]], 2.4); path([[340, 230], [340, 195], [362, 195], [362, 230]]);
  x.beginPath(); x.arc(450, 70, 22, 0, 6.3); x.stroke(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; path([[450 + Math.cos(a) * 30, 70 + Math.sin(a) * 30], [450 + Math.cos(a) * 42, 70 + Math.sin(a) * 42]], 1.4); }
  for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(300 + i * 38, 300, 12, 0, 6.3); x.stroke(); }
  x.fillStyle = 'rgba(30,30,40,0.2)'; x.fillRect(255, 0, 2, 360);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

/** on the shelter's bench, where the sungka board was: a games console, its controller, and an open sketchbook */
function GamesCorner() {
  const consoleScene = useGLTF(`${PROPS_BASE}/gaming_console.glb`).scene, padScene = useGLTF(`${PROPS_BASE}/gamepad.glb`).scene;
  const { group, sketch } = useMemo(() => {
    const g = new Group();
    const add = (scene: Object3D, along: number, across: number, turn: number, scale = 1) => {
      const o = scene.clone(true); o.traverse((c) => { const m = c as Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      const b = new Box3().setFromObject(o); o.position.y -= b.min.y; o.scale.setScalar(scale);
      const holder = new Group(); holder.add(o); holder.position.set(along, 0, across); holder.rotation.y = turn; g.add(holder);
    };
    add(consoleScene, 0.12, 0.02, 0.15);
    add(padScene, 0.44, 0.06, -0.6);
    const mat = new MeshStandardMaterial({ map: sketchTexture(), roughness: 0.95 });
    return { group: g, sketch: mat };
  }, [consoleScene, padScene]);
  if (!gamesSpot.at) return null;
  const [x, y, z] = gamesSpot.at;
  return (
    <group position={[x, y + 0.002, z]} rotation-y={gamesSpot.yaw}>
      <primitive object={group} />
      {/* the sketchbook, open, a pencil across it */}
      <mesh material={sketch} position={[-0.17, 0.006, 0.03]} rotation={[-Math.PI / 2, 0, 0.12]} receiveShadow><planeGeometry args={[0.3, 0.21]} /></mesh>
      <mesh position={[-0.13, 0.012, 0.06]} rotation={[0, 0.6, Math.PI / 2]} castShadow><cylinderGeometry args={[0.0035, 0.0035, 0.17, 6]} /><meshStandardMaterial color="#c99a2e" roughness={0.6} /></mesh>
    </group>
  );
}

// ------------------------------------------------------------------------------------------- the old computer
/** against house A's east wall: a worn desk with a beige CRT computer ("Office - Assets" by SeverDoes3D, CC-BY 4.0);
 *  on its screen, an early design in progress in a plain drawing program. When its panel is open the screen glows
 *  brighter and a warm light comes up around it: the first glimpse of Chapter 03's golden light. */
const DESK = { x: 2.64, y: 0.12, z: 1.68 };
function screenTexture() {
  const c = document.createElement('canvas'); c.width = 320; c.height = 240;
  const x = c.getContext('2d')!;
  x.fillStyle = '#3a6ea5'; x.fillRect(0, 0, 320, 240);                              // the desktop
  x.fillStyle = '#c3c3c3'; x.fillRect(14, 12, 292, 206);                             // a window
  x.fillStyle = '#000080'; x.fillRect(17, 15, 286, 14);
  x.fillStyle = '#fff'; x.font = 'bold 10px monospace'; x.fillText('untitled - draw', 22, 25);
  x.fillStyle = '#c3c3c3'; for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? '#b0b0b0' : '#d8d8d8'; x.fillRect(20, 34 + i * 17, 16, 15); }   // tools
  x.fillStyle = '#fff'; x.fillRect(42, 34, 256, 150);                                // the canvas
  // the design: shapes being tried out, a guide line, a selection
  x.fillStyle = '#e8a33d'; x.beginPath(); x.arc(110, 100, 34, 0, 6.3); x.fill();
  x.fillStyle = '#2b4b7a'; x.fillRect(150, 70, 90, 22); x.fillRect(150, 100, 64, 10); x.fillRect(150, 116, 76, 10);
  x.strokeStyle = '#00a2ff'; x.setLineDash([3, 3]); x.strokeRect(70, 62, 182, 78); x.setLineDash([]);
  x.strokeStyle = '#ff4aa0'; x.beginPath(); x.moveTo(42, 150); x.lineTo(298, 150); x.stroke();
  const sw = ['#000', '#fff', '#e8a33d', '#2b4b7a', '#c0392b', '#27ae60', '#8e44ad', '#f1c40f', '#7f8c8d', '#16a085'];
  sw.forEach((col, i) => { x.fillStyle = col; x.fillRect(42 + i * 18, 190, 16, 16); });
  x.fillStyle = '#000'; x.beginPath(); x.moveTo(200, 128); x.lineTo(200, 142); x.lineTo(204, 138); x.lineTo(208, 146); x.lineTo(210, 145); x.lineTo(206, 137); x.lineTo(211, 137); x.fill();
  x.fillStyle = '#c3c3c3'; x.fillRect(0, 226, 320, 14); x.fillStyle = '#9a9a9a'; x.fillRect(3, 228, 40, 10);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
function OldComputer() {
  const { scene } = useGLTF(`${PROPS_BASE}/old_computer.glb`);
  const obj = useMemo(() => { const o = scene.clone(true); o.traverse((c) => { const m = c as Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }, [scene]);
  const screen = useMemo(() => new MeshStandardMaterial({ map: screenTexture(), emissiveMap: null, emissive: new Color('#ffffff'), emissiveIntensity: 0.35, roughness: 0.35 }), []);
  useMemo(() => { screen.emissiveMap = screen.map; }, [screen]);
  const warm = useRef<PointLight>(null);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1), open = getGame().reading === 'survival-computer';
    screen.emissiveIntensity += ((open ? 1.1 : 0.35) - screen.emissiveIntensity) * (1 - Math.exp(-3 * dt));
    if (warm.current) warm.current.intensity += ((open ? 2.6 : 0) - warm.current.intensity) * (1 - Math.exp(-2 * dt));
  });
  return (
    <group>
      <group position={[DESK.x, DESK.y, DESK.z]} rotation-y={Math.PI}><primitive object={obj} /></group>
      {/* the screen (the monitor faces into the room, -x) and its faint glow */}
      <mesh material={screen} position={[DESK.x - 0.318, DESK.y + 1.15, DESK.z - 0.505]} rotation-y={-Math.PI / 2}><planeGeometry args={[0.3, 0.225]} /></mesh>
      <pointLight position={[DESK.x - 0.6, DESK.y + 1.15, DESK.z - 0.5]} color="#cfe0ff" intensity={0.6} distance={2.2} decay={2} />
      <pointLight ref={warm} position={[DESK.x - 0.9, DESK.y + 1.5, DESK.z - 0.4]} color="#ffc27a" intensity={0} distance={4.5} decay={2} />
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        <CuboidCollider args={[0.44, 0.4, 1.02]} position={[DESK.x - 0.21, DESK.y + 0.4, DESK.z - 1.17]} />
      </RigidBody>
      <Interactable id="survival-computer" label="the computer" verb="look at" reach={3} onInteract={() => openDiscovery('survival-computer')} position={[DESK.x - 0.2, DESK.y + 1.05, DESK.z - 0.5]}>
        <mesh material={HIT}><boxGeometry args={[0.7, 0.7, 0.7]} /></mesh>
      </Interactable>
    </group>
  );
}

// ------------------------------------------------------------------------------------------- the other discoveries
export function Discoveries({ vehicles }: { vehicles: PlacedHouse[]; portal?: PlacedHouse }) {
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene);
  // the rendered views for the panels (taken the first time a panel opens)
  useEffect(() => {
    const exposure = () => Math.pow(2, lookFor('survival').post.exposure) * 1.25;
    snapshotters.sungka = () => takeSnapshot(gl, scene, 'sungka', [4.55, 1.45, 25.75], [3.62, 0.86, 26.95], exposure());
    const m = VEHICLE_PLACEMENTS.find((v) => v.model === 'motorbike');
    if (m) snapshotters.motorbike = () => takeSnapshot(gl, scene, 'motorbike', [m.at[0] - 2.2, 1.25, m.at[1] - 1.7], [m.at[0], 0.55, m.at[1]], exposure());
    return () => { delete snapshotters.sungka; delete snapshotters.motorbike; };
  }, [gl, scene]);
  const bike = vehicles.find((v) => v.object.name === 'vehicle:motorbike');
  return (
    <>
      <PhotoWall />
      <OldComputer />
      <GamesCorner />
      {bike && (
        <Interactable id="survival-motorbike" label="the motorcycle" verb="look at" reach={5.2} onInteract={() => openDiscovery('survival-motorbike')} position={[bike.box.p[0], bike.box.p[1] + 0.2, bike.box.p[2]]}>
          <mesh material={HIT}><boxGeometry args={[1.0, 0.9, 1.0]} /></mesh>
        </Interactable>
      )}
      {/* the portal has no panel: walking into it is the way on to Chapter 02 (PortalPull.tsx) */}
    </>
  );
}

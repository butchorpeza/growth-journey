/* Chapter 01's discoveries that need more than an invisible hit box (content: data/chapter01.ts, photos.ts):
   - the photo wall: a rough timber memory board on house A's east wall, above the cabinet, holding six framed
     photographs from photos.ts (each its own frame and image texture, slightly askew, hung on nails). Pressing E
     opens the gallery "Fragments of My Journey".
   - the motorcycle and the portal: interaction points on the existing models (the portal no longer ends the chapter
     on its own; its panel offers "Enter Chapter 02").
   - the views rendered for the sungka and motorcycle panels.
   - the oil lamp's response to E: the flame swells and a warm glow blooms around it for a few seconds.
   All use the existing white-diamond interaction system (Interactable). */
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace, Sprite, SpriteMaterial, TextureLoader, CanvasTexture } from 'three';
import { COLLAGE } from '../../data/photos';
import { setGame } from '../../game/GameState';
import { Interactable } from '../../interactions/Interactable';
import { lookFor } from '../../rendering/looks';
import { snapshotters, takeSnapshot } from '../../rendering/snapshots';
import { applyWeather } from '../../rendering/weather';
import type { PlacedHouse } from './Houses';
import { SURVIVAL_BASE } from './layout';
import { VEHICLE_PLACEMENTS } from './Props';
import { PORTAL } from './path';

const HIT = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });

/** open a discovery's information panel (movement and look pause while it is open) */
export function openDiscovery(id: string) {
  setGame({ mode: 'reading', reading: id, prompt: null });
  document.exitPointerLock?.();
}

// ------------------------------------------------------------------------------------------------- the photo wall
const WALL = { x: 2.86, z: -1.42, y: 1.66, w: 1.25, h: 0.86 };       // on the inside of the east wall, above the cabinet
const SLOTS: { z: number; y: number; w: number; h: number; tilt: number }[] = [
  { z: -0.38, y: 0.18, w: 0.3, h: 0.22, tilt: 0.04 },
  { z: -0.02, y: 0.2, w: 0.24, h: 0.3, tilt: -0.03 },
  { z: 0.36, y: 0.16, w: 0.3, h: 0.22, tilt: 0.02 },
  { z: -0.36, y: -0.16, w: 0.26, h: 0.2, tilt: -0.05 },
  { z: 0.0, y: -0.17, w: 0.3, h: 0.22, tilt: 0.03 },
  { z: 0.37, y: -0.15, w: 0.22, h: 0.29, tilt: -0.02 },
];

function PhotoWall() {
  const photos = COLLAGE.slice(0, SLOTS.length);
  const tex = useLoader(TextureLoader, photos.map((p) => p.src));
  const timberTex = useLoader(TextureLoader, [`${SURVIVAL_BASE}/housea/timber_diff.webp`, `${SURVIVAL_BASE}/housea/timber_nor.webp`]);
  const mats = useMemo(() => {
    tex.forEach((t) => { t.colorSpace = SRGBColorSpace; t.anisotropy = 8; });
    const board = new MeshStandardMaterial({ map: timberTex[0], normalMap: timberTex[1], color: 0x8a7764, roughness: 0.9 });
    const frame = new MeshStandardMaterial({ map: timberTex[0], normalMap: timberTex[1], color: 0x4a3a2c, roughness: 0.8 });
    const nail = new MeshStandardMaterial({ color: 0x333230, metalness: 0.7, roughness: 0.45 });
    const pics = tex.map((t) => new MeshStandardMaterial({ map: t, roughness: 0.55, side: DoubleSide }));
    [board, frame, nail, ...pics].forEach((m) => applyWeather(m));
    return { board, frame, nail, pics };
  }, [tex, timberTex]);
  return (
    <Interactable id="survival-photograph" label="the photo wall" verb="look at" onInteract={() => openDiscovery('survival-photograph')} position={[WALL.x, WALL.y, WALL.z]}>
      {/* facing into the room (−x): local z of the board points along −x */}
      <group rotation-y={-Math.PI / 2}>
        <mesh material={mats.board} castShadow receiveShadow><boxGeometry args={[WALL.w, WALL.h, 0.025]} /></mesh>
        {SLOTS.map((s, i) => (
          <group key={i} position={[s.z, s.y, 0.018]} rotation-z={s.tilt}>
            <mesh material={mats.frame} castShadow><boxGeometry args={[s.w + 0.04, s.h + 0.04, 0.014]} /></mesh>
            {mats.pics[i] && <mesh material={mats.pics[i]} position={[0, 0, 0.0075]}><planeGeometry args={[s.w, s.h]} /></mesh>}
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

// ------------------------------------------------------------------------------------------- the other discoveries
export function Discoveries({ vehicles, portal }: { vehicles: PlacedHouse[]; portal: PlacedHouse }) {
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
  const portalCentre: [number, number, number] = [PORTAL.at[0], portal.box.p[1] - portal.box.h[1] + 3.0, PORTAL.at[1]];
  return (
    <>
      <PhotoWall />
      {bike && (
        <Interactable id="survival-motorbike" label="the motorcycle" verb="look at" reach={5.2} onInteract={() => openDiscovery('survival-motorbike')} position={[bike.box.p[0], bike.box.p[1] + 0.2, bike.box.p[2]]}>
          <mesh material={HIT}><boxGeometry args={[1.0, 0.9, 1.0]} /></mesh>
        </Interactable>
      )}
      <Interactable id="survival-portal" label="the portal" verb="approach" reach={6.5} onInteract={() => openDiscovery('survival-portal')} position={portalCentre}>
        <mesh material={HIT}><boxGeometry args={[2.4, 4, 1.2]} /></mesh>
      </Interactable>
    </>
  );
}

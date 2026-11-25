/* 01 · The Entrance: "Growing Up Without Them" (data/chapter02.ts). An old framed studio portrait left leaning against
   the gate's left pillar: a faded painted backdrop, a carpet, and the places where a family would sit and stand, the
   chairs empty. No people are shown (there are no photographs of Butch's parents here, and none are invented). */
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useMemo } from 'react';
import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { Interactable } from '../../interactions/Interactable';
import { GROUPS } from '../../physics/CollisionLayers';
import { openDiscovery } from '../survival/Discoveries';
import { GATE, groundHeight } from './layout';
import { useProp } from './materials';

function emptyPortrait() {
  const c = document.createElement('canvas'); c.width = 600; c.height = 460;
  const x = c.getContext('2d')!;
  // a mottled painted backdrop, in faded sepia
  const g = x.createRadialGradient(300, 180, 40, 300, 220, 420); g.addColorStop(0, '#9c8a6c'); g.addColorStop(1, '#4b3f30');
  x.fillStyle = g; x.fillRect(0, 0, 600, 460);
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${60 + Math.random() * 60},${50 + Math.random() * 40},${30 + Math.random() * 30},0.08)`; x.beginPath(); x.arc(Math.random() * 600, Math.random() * 340, 20 + Math.random() * 70, 0, 6.3); x.fill(); }
  // the floor, a patterned carpet
  x.fillStyle = '#5b4836'; x.fillRect(0, 340, 600, 120);
  x.strokeStyle = 'rgba(30,20,12,0.4)'; for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(0, 350 + i * 9); x.lineTo(600, 350 + i * 9); x.stroke(); }
  // two empty chairs, side by side, and a space between and behind them
  const chair = (cx: number) => {
    x.fillStyle = '#2c2119';
    x.fillRect(cx - 46, 250, 92, 12); x.fillRect(cx - 44, 262, 8, 80); x.fillRect(cx + 36, 262, 8, 80);
    x.fillRect(cx - 44, 170, 8, 82); x.fillRect(cx + 36, 170, 8, 82); x.fillRect(cx - 44, 170, 88, 10); x.fillRect(cx - 44, 205, 88, 6);
  };
  chair(200); chair(400);
  // age: grain, scratches, a light leak, a vignette
  const img = x.getImageData(0, 0, 600, 460);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 30; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  x.putImageData(img, 0, 0);
  x.strokeStyle = 'rgba(235,225,200,0.18)'; for (let i = 0; i < 7; i++) { x.beginPath(); const sx = Math.random() * 600; x.moveTo(sx, 0); x.lineTo(sx + (Math.random() - 0.5) * 60, 460); x.stroke(); }
  const v = x.createRadialGradient(300, 230, 120, 300, 230, 380); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(12,8,4,0.8)');
  x.fillStyle = v; x.fillRect(0, 0, 600, 460);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

export function EntrancePortrait() {
  const frame = useProp('fancy_picture_frame_01', 0.55);
  const photo = useMemo(() => new MeshStandardMaterial({ map: emptyPortrait(), roughness: 0.6 }), []);
  const x = -(GATE.halfWidth + GATE.pillar / 2), z = GATE.z + GATE.pillar / 2 + 0.22, y = groundHeight(x, z);
  const S = 2.2;   // the frame model is 0.6 × 0.46 m: about 1.3 × 1.0 m here
  return (
    <group position={[x, y, z]} rotation={[-0.22, 0.12, 0]}>
      <group position={[0, 0.5 * S, 0]}>
        <primitive object={frame} scale={S} />
        <mesh material={photo} position={[0, 0, 0.012 * S]}><planeGeometry args={[0.6 * S * 0.84, 0.46 * S * 0.8]} /></mesh>
      </group>
      <Interactable id="shadows-portrait" label="the portrait" verb="look at" reach={3.5} onInteract={() => openDiscovery('shadows-portrait')} position={[0, 0.55 * S, 0.1]}>
        <mesh visible={false}><boxGeometry args={[1.3, 1.0, 0.3]} /></mesh>
      </Interactable>
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        <CuboidCollider args={[0.66, 0.55, 0.12]} position={[0, 0.55, 0]} />
      </RigidBody>
    </group>
  );
}

/* Chapter 03 · The System (Phase 02 foundation): a central core with five connected platforms, one per service
   zone (data/services.ts). Phase 04/05 give every zone its own installation and make it selectable. */
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import { PALETTE } from '../../data/chapters';
import { services } from '../../data/services';
import type { SceneProps } from '../../three/SceneManager';

const R = 30;
export const zonePosition = (i: number): [number, number, number] => {
  const a = (i / services.length) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(a) * R, 0, Math.sin(a) * R];
};

export default function SystemScene(_props: SceneProps) {
  const core = useRef<Mesh>(null), spin = useRef<Group>(null);
  const links = useMemo(() => services.map((_, i) => {
    const p = zonePosition(i), q = zonePosition((i + 1) % services.length);
    return { spoke: [[0, 6, 0], [p[0], 1.2, p[2]]] as [number, number, number][], rim: [[p[0], 1.2, p[2]], [q[0], 1.2, q[2]]] as [number, number, number][] };
  }), []);

  useFrame((_, dt) => {
    if (core.current) { core.current.rotation.y += dt * 0.12; core.current.rotation.x += dt * 0.05; }
    if (spin.current) spin.current.rotation.y += dt * 0.02;
  });

  return (
    <group ref={spin}>
      <mesh position={[0, -0.6, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[R + 16, 96]} />
        <meshStandardMaterial color="#0f1b29" roughness={0.9} />
      </mesh>
      <mesh ref={core} position={[0, 8, 0]}>
        <icosahedronGeometry args={[6.5, 1]} />
        <meshStandardMaterial color={PALETTE.navy} metalness={0.7} roughness={0.25} flatShading emissive={PALETTE.gold} emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[0, 8, 0]}>
        <sphereGeometry args={[3.2, 32, 16]} />
        <meshBasicMaterial color={PALETTE.gold} transparent opacity={0.35} toneMapped={false} />
      </mesh>
      {services.map((s, i) => (
        <group key={s.id} position={zonePosition(i)}>
          <mesh>
            <cylinderGeometry args={[7, 7.6, 1.4, 48]} />
            <meshStandardMaterial color={PALETTE.charcoal} metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.75, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[7, 0.12, 6, 96]} />
            <meshBasicMaterial color={PALETTE.gold} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {links.map((l, i) => (
        <group key={i}>
          <Line points={l.spoke} color={PALETTE.gold} lineWidth={1} transparent opacity={0.45} />
          <Line points={l.rim} color={PALETTE.white} lineWidth={0.6} transparent opacity={0.25} />
        </group>
      ))}
    </group>
  );
}

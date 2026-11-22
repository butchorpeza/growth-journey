/* Chapter 05 · The Next Frontier (Phase 02 foundation): a golden-hour skyline seen from an elevated platform.
   Phase 04 adds the avatar facing the horizon, clouds and the final camera approach. */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Object3D } from 'three';
import { PALETTE } from '../../data/chapters';
import type { SceneProps } from '../../three/SceneManager';
import { seeded } from '../../utils/random';

export default function FrontierScene({ quality }: SceneProps) {
  const count = quality === 'high' ? 260 : 140;
  const towers = useMemo(() => {
    const r = seeded(21);
    return Array.from({ length: count }, () => {
      const x = (r() - 0.5) * 520, z = -120 - r() * 220;
      const near = 1 - Math.min(1, Math.abs(x) / 260);
      return { x, z, w: 6 + r() * 10, h: 12 + r() * 40 + near * near * 90 * r() };
    });
  }, [count]);
  const city = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new Object3D(), c = new Color('#2b2f3a');
    towers.forEach((t, i) => {
      o.position.set(t.x, t.h / 2 - 20, t.z); o.scale.set(t.w, t.h, t.w); o.updateMatrix();
      city.current!.setMatrixAt(i, o.matrix);
      city.current!.setColorAt(i, c.clone().offsetHSL(0, 0, (i % 5) * 0.015));
    });
    city.current!.instanceMatrix.needsUpdate = true;
    if (city.current!.instanceColor) city.current!.instanceColor.needsUpdate = true;
  }, [towers]);

  return (
    <group>
      <instancedMesh ref={city} args={[undefined, undefined, towers.length]}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.7} metalness={0.25} />
      </instancedMesh>
      {/* observation platform */}
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[12, 12.5, 1.2, 64]} />
        <meshStandardMaterial color={PALETTE.charcoal} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 4.4, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[11.6, 0.08, 6, 128]} />
        <meshBasicMaterial color={PALETTE.gold} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* Chapter 02 · The Discovery (Phase 02 foundation): an instanced procedural city with a central observation tower.
   Phase 04 adds the five challenge metaphors (dim building, broken path, empty storefront, disconnected blocks,
   faded signage) and the data connections. */
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Matrix4, Object3D, type Mesh } from 'three';
import { PALETTE } from '../../data/chapters';
import type { SceneProps } from '../../three/SceneManager';
import { seeded } from '../../utils/random';

export default function DiscoveryScene({ quality }: SceneProps) {
  const n = quality === 'high' ? 22 : 14, gap = 9;
  const blocks = useMemo(() => {
    const r = seeded(7), out: { x: number; z: number; w: number; d: number; h: number; lit: boolean }[] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i % 5 === 2 || j % 5 === 2) continue;                       // avenues
      const x = (i - (n - 1) / 2) * gap, z = (j - (n - 1) / 2) * gap;
      if (Math.abs(x) < gap * 1.6 && Math.abs(z) < gap * 1.6) continue; // plaza around the tower
      const centre = 1 - Math.min(1, Math.hypot(x, z) / (n * gap * 0.55));
      out.push({ x, z, w: 4 + r() * 3, d: 4 + r() * 3, h: 5 + r() * 14 + centre * centre * 46 * r(), lit: r() > 0.72 });
    }
    return out;
  }, [n]);

  const city = useRef<InstancedMesh>(null), caps = useRef<InstancedMesh>(null), ring = useRef<Mesh>(null);
  useLayoutEffect(() => {
    const o = new Object3D(), m = new Matrix4(), c = new Color(), base = new Color(PALETTE.navy);
    let k = 0;
    blocks.forEach((b, i) => {
      o.position.set(b.x, b.h / 2, b.z); o.scale.set(b.w, b.h, b.d); o.updateMatrix();
      city.current!.setMatrixAt(i, o.matrix);
      city.current!.setColorAt(i, c.copy(base).offsetHSL(0, 0, (i % 7) * 0.012 - 0.03));
      if (b.lit) { m.makeScale(b.w * 0.9, 0.25, b.d * 0.9).setPosition(b.x, b.h + 0.13, b.z); caps.current!.setMatrixAt(k++, m); }
    });
    caps.current!.count = k;
    city.current!.instanceMatrix.needsUpdate = true; caps.current!.instanceMatrix.needsUpdate = true;
    if (city.current!.instanceColor) city.current!.instanceColor.needsUpdate = true;
  }, [blocks]);

  useFrame((_, dt) => { if (ring.current) ring.current.rotation.z += dt * 0.15; });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#0d1520" roughness={0.95} />
      </mesh>
      <instancedMesh ref={city} args={[undefined, undefined, blocks.length]}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.55} metalness={0.35} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, blocks.length]}>
        <boxGeometry />
        <meshBasicMaterial color={PALETTE.gold} toneMapped={false} />
      </instancedMesh>
      {/* the observation tower */}
      <mesh position={[0, 34, 0]}>
        <cylinderGeometry args={[1.6, 3.2, 68, 24]} />
        <meshStandardMaterial color={PALETTE.charcoal} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh ref={ring} position={[0, 64, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[7, 0.25, 8, 96]} />
        <meshBasicMaterial color={PALETTE.gold} toneMapped={false} />
      </mesh>
    </group>
  );
}

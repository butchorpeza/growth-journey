/* Chapter 04 · The Results (Phase 02 foundation): floating display panels in an arc, one per case study, showing
   the real project covers. Phase 04/05 turn them into selectable buildings with a camera fly-to. */
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { SRGBColorSpace, type Group } from 'three';
import { PALETTE } from '../../data/chapters';
import { projects } from '../../data/projects';
import type { SceneProps } from '../../three/SceneManager';

const shown = projects.filter((p) => p.image);
const RADIUS = 46, SPAN = Math.PI * 0.78;

export default function ResultsScene(_props: SceneProps) {
  const textures = useTexture(shown.map((p) => `${import.meta.env.BASE_URL}${p.image}`));
  useMemo(() => textures.forEach((t) => { t.colorSpace = SRGBColorSpace; t.anisotropy = 4; }), [textures]);
  const panels = useRef<Group>(null);

  useFrame(({ clock }) => {
    panels.current?.children.forEach((c, i) => { c.position.y = 10 + Math.sin(clock.elapsedTime * 0.5 + i) * 0.45; });
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[140, 96]} />
        <meshStandardMaterial color="#13243a" roughness={0.6} metalness={0.2} />
      </mesh>
      <group ref={panels}>
        {shown.map((p, i) => {
          const a = -SPAN / 2 + (i / (shown.length - 1)) * SPAN;
          const x = Math.sin(a) * RADIUS, z = -Math.cos(a) * RADIUS + 20;
          return (
            <group key={p.slug} position={[x, 10, z]} rotation-y={-a}>
              <mesh position={[0, 0, -0.25]}>
                <boxGeometry args={[16.6, 11.2, 0.4]} />
                <meshStandardMaterial color={PALETTE.charcoal} metalness={0.5} roughness={0.4} />
              </mesh>
              <mesh>
                <planeGeometry args={[16, 10.4]} />
                <meshBasicMaterial map={textures[i]} toneMapped={false} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

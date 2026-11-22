/* Chapter 01 · The Beginning: the floating island with the avatar (Blender export, optimised by
   scripts/optimize-island.mjs to public/models/island.glb, 3 MB, meshopt + WebP). Phase 02: island, avatar idle
   animation and a slow float. Phase 03 adds clouds, the avatar turn and the cinematic camera polish. */
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group, Mesh } from 'three';
import type { SceneProps } from '../../three/SceneManager';

export const ISLAND_URL = `${import.meta.env.BASE_URL}models/island.glb`;

export default function BeginningScene(_props: SceneProps) {
  const root = useRef<Group>(null);
  const { scene, animations } = useGLTF(ISLAND_URL, false, true);
  const { actions, names } = useAnimations(animations, root);

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as Mesh & { isSkinnedMesh?: boolean };
      if (m.isMesh) m.frustumCulled = !m.isSkinnedMesh;   // skinned bounds are unreliable: never cull the avatar
    });
  }, [scene]);

  useEffect(() => {
    const idle = names[0] ? actions[names[0]] : null;
    idle?.reset().fadeIn(0.8).play();
    return () => { idle?.fadeOut(0.3); };
  }, [actions, names]);

  useFrame(({ clock }) => {
    if (root.current) root.current.position.y = Math.sin(clock.elapsedTime * 0.35) * 0.5;
  });

  return (
    <group ref={root}>
      <primitive object={scene} />
    </group>
  );
}

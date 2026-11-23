/* Image-based lighting from a CC0 Poly Haven HDRI + one sun with shadows that follow the player
   (a small shadow frustum around the character keeps shadows sharp without a huge shadow map). */
import { Environment } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { DirectionalLight } from 'three';
import { playerState } from '../player/playerState';

export interface LightingProps {
  hdri: string;              // path under public/
  sunDirection?: [number, number, number];
  sunColor?: string;
  sunIntensity?: number;
  envIntensity?: number;
  shadows?: boolean;
  background?: boolean;
  blur?: number;
}

export function Lighting({ hdri, sunDirection = [0.45, 0.8, 0.35], sunColor = '#fff4e6', sunIntensity = 1.6, envIntensity = 1, shadows = true, background = true, blur = 0 }: LightingProps) {
  const sun = useRef<DirectionalLight>(null);
  useEffect(() => {
    const s = sun.current; if (!s) return;
    const c = s.shadow.camera; c.left = -22; c.right = 22; c.top = 22; c.bottom = -22; c.near = 1; c.far = 120; c.updateProjectionMatrix();
    s.shadow.bias = -0.0004; s.shadow.normalBias = 0.03;
  }, []);
  useFrame(() => {
    const s = sun.current; if (!s) return;
    const p = playerState.position;
    s.position.set(p.x + sunDirection[0] * 50, p.y + sunDirection[1] * 50, p.z + sunDirection[2] * 50);
    s.target.position.copy(p); s.target.updateMatrixWorld();
  });
  return (
    <>
      <Environment files={`${import.meta.env.BASE_URL}${hdri}`} background={background} backgroundBlurriness={blur} environmentIntensity={envIntensity} />
      <directionalLight ref={sun} color={sunColor} intensity={sunIntensity} castShadow={shadows} shadow-mapSize={[2048, 2048]} />
    </>
  );
}

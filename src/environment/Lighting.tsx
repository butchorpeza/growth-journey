/* Lighting + atmosphere for the current chapter's Look:
   - image-based light from a CC0 Poly Haven HDRI (environment + background, separately dimmable)
   - one sun with soft shadows that follows the visitor. The shadow frustum is small (sharp shadows from a
     modest map, PCF-filtered for soft penumbrae) and its position is snapped to whole shadow-map texels in light space, so shadow edges don't
     crawl or shimmer as you walk. High: 2048² map; medium: 1024²; low: no shadows.
   - height fog (see rendering/heightFog.ts) in the Look's colour and density */
import { Environment } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { FogExp2, Matrix4, Vector3, type DirectionalLight } from 'three';
import { playerState } from '../player/playerState';
import type { Look } from '../rendering/looks';

const EXTENT = 24;        // m, half-size of the shadow frustum around the visitor
const DISTANCE = 60;      // m, sun distance from the visitor along its direction

export function Lighting({ look, quality }: { look: Look; quality: 'high' | 'medium' | 'low' }) {
  const sun = useRef<DirectionalLight>(null);
  const shadows = quality !== 'low';
  const mapSize = quality === 'high' ? 2048 : 1024;
  const dir = useMemo(() => new Vector3(...look.sun.direction).normalize(), [look.sun.direction]);

  useEffect(() => {
    const s = sun.current; if (!s) return;
    const c = s.shadow.camera; c.left = -EXTENT; c.right = EXTENT; c.top = EXTENT; c.bottom = -EXTENT; c.near = 1; c.far = DISTANCE * 2; c.updateProjectionMatrix();
    s.shadow.bias = -0.00025; s.shadow.normalBias = 0.025;
    s.shadow.radius = mapSize >= 2048 ? 3 : 2;      // PCF filter width: soft penumbrae
    s.shadow.mapSize.set(mapSize, mapSize);
    s.shadow.map?.dispose(); s.shadow.map = null;   // re-allocate at the new size
  }, [mapSize]);

  // light-space basis for texel snapping
  const basis = useMemo(() => {
    const m = new Matrix4().lookAt(new Vector3(), dir.clone().negate(), Math.abs(dir.y) > 0.99 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0));
    return { toLight: m.clone().invert(), toWorld: m };
  }, [dir]);
  const tmp = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const s = sun.current; if (!s) return;
    const texel = (EXTENT * 2) / mapSize;
    tmp.copy(playerState.position).applyMatrix4(basis.toLight);
    tmp.x = Math.round(tmp.x / texel) * texel; tmp.y = Math.round(tmp.y / texel) * texel;
    tmp.applyMatrix4(basis.toWorld);
    s.target.position.copy(tmp); s.target.updateMatrixWorld();
    s.position.copy(tmp).addScaledVector(dir, DISTANCE);
  });

  // atmosphere
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    const prev = scene.fog;
    scene.fog = look.fog ? new FogExp2(look.fog.color, look.fog.density) : null;
    return () => { scene.fog = prev; };
  }, [scene, look.fog]);

  return (
    <>
      <Environment files={`${import.meta.env.BASE_URL}${look.sky.hdri}`} background
        environmentIntensity={look.sky.envIntensity} backgroundIntensity={look.sky.backgroundIntensity}
        backgroundBlurriness={look.sky.backgroundBlur} />
      <directionalLight ref={sun} color={look.sun.color} intensity={look.sun.intensity} castShadow={shadows} />
    </>
  );
}

/* One sun + one sky/ground fill, recoloured per chapter. No real-time shadows yet (added per scene where they matter). */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, DirectionalLight, HemisphereLight } from 'three';
import { PALETTE } from '../../data/chapters';
import { progress } from '../../state/journey';
import { airAt, newAir } from '../animations/journeyMath';
import { SUN_DIR } from '../environment/Atmosphere';

export function Lights() {
  const sun = useRef<DirectionalLight>(null), hemi = useRef<HemisphereLight>(null);
  const air = useMemo(newAir, []);
  const ground = useMemo(() => new Color(PALETTE.charcoal), []);
  useFrame(({ camera }) => {
    airAt(progress.value, air);
    if (sun.current) {
      sun.current.color.copy(air.sun); sun.current.intensity = air.sunIntensity;
      // keep the light coming from the sky's sun direction, wherever the camera is
      sun.current.position.set(camera.position.x + SUN_DIR[0] * 200, camera.position.y + SUN_DIR[1] * 200, camera.position.z + SUN_DIR[2] * 200);
      sun.current.target.position.copy(camera.position); sun.current.target.updateMatrixWorld();
    }
    if (hemi.current) { hemi.current.color.copy(air.skyHorizon); hemi.current.groundColor.copy(ground); hemi.current.intensity = air.ambient; }
  });
  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} />
    </>
  );
}

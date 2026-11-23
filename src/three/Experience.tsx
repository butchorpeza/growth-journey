/* The WebGL root: canvas settings, adaptive quality, and the shared layers (camera, air, light, worlds). */
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { ACESFilmicToneMapping, DefaultLoadingManager, SRGBColorSpace } from 'three';
import { setJourney } from '../state/journey';
import { CameraRig } from './camera/CameraRig';
import { Atmosphere } from './environment/Atmosphere';
import { Lights } from './lighting/Lights';
import { SceneManager } from './SceneManager';

export default function Experience({ quality, reduced }: { quality: 'high' | 'low'; reduced: boolean }) {
  const maxDpr = quality === 'high' ? 1.75 : 1.25;
  const [dpr, setDpr] = useState(maxDpr);

  useEffect(() => {
    // loading progress for the interface loader (three's global manager sees every texture / model request)
    DefaultLoadingManager.onProgress = (_url, loaded, total) => setJourney({ loaded: total ? loaded / total : 1 });
    DefaultLoadingManager.onLoad = () => setJourney({ loaded: 1, sceneReady: true });
    // nothing to load (or all cached): ready after the first frames
    const t = window.setTimeout(() => setJourney({ sceneReady: true }), 4000);
    return () => { window.clearTimeout(t); DefaultLoadingManager.onProgress = () => {}; DefaultLoadingManager.onLoad = () => {}; };
  }, []);

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ fov: 38, near: 0.5, far: 3200, position: [70, 34, 96] }}
      onCreated={(state) => {
        const { gl } = state;
        if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as Record<string, unknown>).__r3f = state; gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; gl.outputColorSpace = SRGBColorSpace; }}
      aria-hidden="true"
    >
      {/* drop resolution if the device can't hold the frame rate, raise it again when it can */}
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} flipflops={3} onFallback={() => setDpr(1)} />
      <AdaptiveDpr pixelated={false} />
      <CameraRig reduced={reduced} />
      <Atmosphere />
      <Lights />
      <SceneManager quality={quality} />
    </Canvas>
  );
}

/* The WebGL world: renderer settings, physics world, the current chapter, the player and the camera.
   Only the current chapter is mounted; switching chapters unmounts the old one (R3F disposes its geometry,
   materials and textures) and loads the next one lazily. */
import { AdaptiveDpr, PerformanceMonitor, useProgress } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense, useEffect, useState } from 'react';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import { TestRange } from '../chapters/prototype/TestRange';
import { Lighting } from '../environment/Lighting';
import { InteractionManager } from '../interactions/Interactable';
import { Player } from '../player/Player';
import { PlayerCamera } from '../player/PlayerCamera';
import { playerState } from '../player/playerState';
import { getGame, setGame, useGame } from './GameState';

function LoadWatcher() {
  const { active, progress } = useProgress();
  useEffect(() => { if (!active && progress >= 100) setGame({ mode: 'intro' }); }, [active, progress]);
  return null;
}

export default function GameCanvas() {
  const quality = useGame((s) => s.settings.quality);
  const debugPhysics = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('physics');
  const maxDpr = quality === 'high' ? 1.75 : 1.15;
  const [dpr, setDpr] = useState(maxDpr);
  useEffect(() => setDpr(maxDpr), [maxDpr]);

  return (
    <Canvas
      shadows={quality === 'high' ? { type: PCFSoftShadowMap } : false}
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 50, near: 0.1, far: 600, position: [3, 2.5, 5] }}
      onCreated={(st) => { const { gl } = st; if (new URLSearchParams(window.location.search).has('debug')) { const w = window as unknown as Record<string, unknown>; w.__r3f = st; w.__player = playerState; w.__game = { getGame, setGame }; } gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.outputColorSpace = SRGBColorSpace; }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} flipflops={3} onFallback={() => setDpr(1)} />
      <AdaptiveDpr pixelated={false} />
      <Suspense fallback={null}>
        <Lighting hdri="hdri/overcast_soil_puresky_1k.hdr" shadows={quality === 'high'} sunIntensity={1.4} envIntensity={0.9} />
        <Physics gravity={[0, -9.81, 0]} timeStep="vary" debug={debugPhysics}>
          <TestRange />
          <Player spawn={[0, 0, 6]} />
          <PlayerCamera />
          <InteractionManager />
        </Physics>
        <LoadWatcher />
      </Suspense>
    </Canvas>
  );
}

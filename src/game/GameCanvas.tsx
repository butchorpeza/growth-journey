/* The WebGL world: renderer settings, physics world, the current chapter, the invisible player and the camera.
   Only the current chapter is mounted; switching chapters unmounts the old one (R3F disposes its geometry,
   materials and textures) and loads the next one lazily. */
import { AdaptiveDpr, PerformanceMonitor, useProgress } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense, useEffect, useState } from 'react';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import { TestRange } from '../chapters/prototype/TestRange';
import { SURVIVAL_SPAWN, yawTowards } from '../chapters/survival/layout';
import { SurvivalChapter } from '../chapters/survival/SurvivalChapter';
import type { ChapterId } from '../data/chapters';
import { Lighting, type LightingProps } from '../environment/Lighting';
import { InteractionManager } from '../interactions/Interactable';
import { VIEW } from '../player/movement';
import { Player } from '../player/Player';
import { PlayerCamera } from '../player/PlayerCamera';
import { playerState } from '../player/playerState';
import { getGame, setGame, useGame } from './GameState';

interface ChapterSetup { lighting: LightingProps; spawn: [number, number, number]; spawnYaw: number }

const SETUP: Partial<Record<ChapterId, ChapterSetup>> = {
  prototype: { lighting: { hdri: 'hdri/overcast_soil_puresky_1k.hdr', sunIntensity: 1.4, envIntensity: 0.9 }, spawn: [0, 0, 6], spawnYaw: 0 },
  // overcast: a weak, high sun for soft shadows; most light comes from the sky
  survival: {
    lighting: { hdri: 'hdri/overcast_soil_puresky_1k.hdr', sunIntensity: 0.75, envIntensity: 1.0, sunDirection: [0.35, 0.9, 0.25], sunColor: '#f2f0ea' },
    spawn: SURVIVAL_SPAWN.p, spawnYaw: yawTowards(SURVIVAL_SPAWN.p, SURVIVAL_SPAWN.lookAt),
  },
};

function LoadWatcher() {
  const { active, progress } = useProgress();
  useEffect(() => {
    if (getGame().mode === 'loading') setGame({ loadProgress: Math.round(progress) });
    if (!active && progress >= 100 && getGame().mode === 'loading') setGame({ mode: 'intro' });
  }, [active, progress]);
  return null;
}

export default function GameCanvas() {
  const quality = useGame((s) => s.settings.quality);
  const chapter = useGame((s) => s.chapter);
  const setup = SETUP[chapter] ?? SETUP.prototype!;
  const debugPhysics = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('physics');
  const maxDpr = quality === 'high' ? 1.75 : 1.15;
  const [dpr, setDpr] = useState(maxDpr);
  useEffect(() => setDpr(maxDpr), [maxDpr]);

  return (
    <Canvas
      shadows={quality === 'high' ? { type: PCFSoftShadowMap } : false}
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: VIEW.fov, near: 0.05, far: 600, position: [0, VIEW.eyeHeight, 6] }}
      onCreated={(st) => { const { gl } = st; if (new URLSearchParams(window.location.search).has('debug')) { const w = window as unknown as Record<string, unknown>; w.__r3f = st; w.__player = playerState; w.__game = { getGame, setGame }; } gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.outputColorSpace = SRGBColorSpace; }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr)} flipflops={3} onFallback={() => setDpr(1)} />
      <AdaptiveDpr pixelated={false} />
      <Suspense fallback={null}>
        <Lighting {...setup.lighting} shadows={quality === 'high'} />
        <Physics gravity={[0, -9.81, 0]} timeStep="vary" debug={debugPhysics}>
          {chapter === 'survival' ? <SurvivalChapter /> : <TestRange />}
          <Player key={chapter} spawn={setup.spawn} spawnYaw={setup.spawnYaw} />
          <PlayerCamera />
          <InteractionManager />
        </Physics>
        <LoadWatcher />
      </Suspense>
    </Canvas>
  );
}

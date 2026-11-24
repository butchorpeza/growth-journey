/* The WebGL world: renderer settings, physics world, the current chapter, the invisible player and the camera.
   Only the current chapter is mounted; switching chapters unmounts the old one (R3F disposes its geometry,
   materials and textures) and loads the next one lazily.
   Rendering: each chapter's Look (rendering/looks.ts) sets sky, sun, height fog and the post-processing grade.
   Quality — high: 2K shadows, full post chain, DPR ≤ 1.5 · medium: 1K shadows, lighter post, DPR ≤ 1.2 ·
   low: no shadows, no post (the renderer tone-maps with ACES), DPR 1. The tier is the visitor's choice (High by
   default) and is never changed automatically; only the render resolution adapts when the frame rate drops. */
import { AdaptiveDpr, PerformanceMonitor, useProgress } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense, useEffect, useState } from 'react';
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, type Mesh, type Object3D, type Texture } from 'three';
import { Footsteps } from '../audio/Footsteps';
import { TestRange } from '../chapters/prototype/TestRange';
import { SURVIVAL_SPAWN, yawTowards } from '../chapters/survival/layout';
import { SurvivalChapter } from '../chapters/survival/SurvivalChapter';
import type { ChapterId } from '../data/chapters';
import { Lighting } from '../environment/Lighting';
import { InteractionManager } from '../interactions/Interactable';
import { VIEW } from '../player/movement';
import { Player } from '../player/Player';
import { RailController } from '../player/RailController';
import { SURVIVAL_PATH } from '../chapters/survival/path';
import { PlayerCamera } from '../player/PlayerCamera';
import { playerState } from '../player/playerState';
import { installBVH } from '../rendering/bvh';
import { Autofocus } from '../rendering/focus';
import { installHeightFog } from '../rendering/heightFog';
import { Lightning } from '../rendering/Lightning';
import { lookFor, type Look } from '../rendering/looks';
import { PostFX } from '../rendering/PostFX';
import { getGame, setGame, useGame } from './GameState';

installHeightFog();   // before any material compiles
installBVH();         // fast raycasts (interaction look-at, autofocus)

const SPAWN: Partial<Record<ChapterId, { p: [number, number, number]; yaw: number }>> = {
  prototype: { p: [0, 0, 6], yaw: 0 },
  survival: { p: SURVIVAL_SPAWN.p, yaw: yawTowards(SURVIVAL_SPAWN.p, SURVIVAL_SPAWN.lookAt) },
};

// High renders at the screen's own pixel density (up to 2×): a 1.5× cap left Retina screens visibly soft
const DPR = { high: typeof window !== 'undefined' ? Math.min(2, Math.max(1.5, window.devicePixelRatio || 1)) : 1.5, medium: 1.2, low: 1.0 } as const;

function LoadWatcher() {
  const { active, progress } = useProgress();
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene);
  useEffect(() => {
    if (getGame().mode === 'loading') setGame({ loadProgress: Math.round(progress) });
    if (!active && progress >= 100) sharpenTextures(scene, gl.capabilities.getMaxAnisotropy());
    if (!active && progress >= 100 && getGame().mode === 'loading') setGame({ mode: 'intro' });
  }, [active, progress, gl, scene]);
  return null;
}

/** every texture in the scene at full anisotropic filtering: without it, ground, walls and roofs seen at a slant
 *  smear into blur (the single largest sharpness cost; the GPU cost is small on any recent hardware) */
function sharpenTextures(scene: Object3D, max: number) {
  const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'] as const;
  scene.traverse((o) => {
    const mats = (o as Mesh).material; if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) for (const k of slots) {
      const t = (m as unknown as Record<string, Texture | null>)[k];
      if (t && t.anisotropy < max) { t.anisotropy = max; t.needsUpdate = true; }
    }
  });
}

/** without post-processing the renderer tone-maps itself (with the Look's exposure); with it, the composer does */
function RendererToneMapping({ look, post }: { look: Look; post: boolean }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (post) return;
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = 2 ** look.post.exposure;
  }, [gl, look, post]);
  return null;
}

export default function GameCanvas() {
  const quality = useGame((s) => s.settings.quality);
  const reducedMotion = useGame((s) => s.settings.reducedMotion);
  const chapter = useGame((s) => s.chapter);
  const movement = useGame((s) => s.settings.movement);
  const look = lookFor(chapter);
  const spawn = SPAWN[chapter] ?? SPAWN.prototype!;
  const debugPhysics = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('physics');
  const maxDpr = DPR[quality];
  const [dpr, setDpr] = useState<number>(maxDpr);
  useEffect(() => setDpr(maxDpr), [maxDpr]);
  const post = quality !== 'low';

  return (
    <Canvas
      shadows={quality !== 'low' ? { type: PCFShadowMap } : false}
      dpr={dpr}
      gl={{ antialias: !post, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: VIEW.fov, near: 0.05, far: 600, position: [0, VIEW.eyeHeight, 6] }}
      onCreated={(st) => { const { gl } = st; if (new URLSearchParams(window.location.search).has('debug')) { const w = window as unknown as Record<string, unknown>; w.__r3f = st; w.__player = playerState; w.__game = { getGame, setGame }; } gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.outputColorSpace = SRGBColorSpace; }}
    >
      {/* keep the chosen quality (High by default); only the render resolution adapts when the frame rate drops */}
      <PerformanceMonitor bounds={() => [45, 58]} flipflops={4}
        onDecline={() => { if (document.hidden || !document.hasFocus()) return; setDpr((d) => (d > 1.26 ? Math.max(1, d - 0.25) : 1)); }}   // step down gently, never below native 1×
        onIncline={() => setDpr(maxDpr)} onFallback={() => setDpr(1)} />
      <AdaptiveDpr pixelated={false} />
      <RendererToneMapping look={look} post={post} />
      <Suspense fallback={null}>
        <Lighting look={look} quality={quality} />
        {(look.weather?.lightning ?? 0) > 0 && <Lightning look={look} />}
        <Physics gravity={[0, -9.81, 0]} timeStep="vary" debug={debugPhysics}>
          {chapter === 'survival' ? <SurvivalChapter /> : <TestRange />}
          <Player key={chapter} spawn={spawn.p} spawnYaw={spawn.yaw} />
          {chapter === 'survival' && movement === 'scroll' && <RailController key={`rail-${chapter}`} path={SURVIVAL_PATH} />}
          <PlayerCamera />
          <InteractionManager />
          <Footsteps />
        </Physics>
        {quality === 'high' && <Autofocus />}
        <LoadWatcher />
      </Suspense>
      {/* keyed by quality: the AO pass can't change resolution / MSAA in place, so the chain is rebuilt */}
      {post && <PostFX key={quality} look={look} quality={quality} reducedMotion={reducedMotion} />}
    </Canvas>
  );
}

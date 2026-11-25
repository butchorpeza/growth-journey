/* The WebGL world: renderer settings, physics world, the current chapter, the invisible player and the camera.
   Only the current chapter is mounted; switching chapters unmounts the old one (R3F disposes its geometry,
   materials and textures) and loads the next one lazily.
   Rendering: each chapter's Look (rendering/looks.ts) sets sky, sun, height fog and the post-processing grade.
   Quality — high: 2K shadows, full post chain, DPR ≤ 1.5 · medium: 1K shadows, lighter post, DPR ≤ 1.2 ·
   low: no shadows, no post (the renderer tone-maps with ACES), DPR 1. The tier is the visitor's choice (High by
   default) and is never changed automatically; only the render resolution adapts when the frame rate drops. */
import { useProgress } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense, useEffect, useRef } from 'react';
import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, type Mesh, type Object3D, type Texture } from 'three';
import { audio } from '../audio/AudioEngine';
import { Footsteps } from '../audio/Footsteps';
import { TestRange } from '../chapters/prototype/TestRange';
import { SURVIVAL_SPAWN, yawTowards } from '../chapters/survival/layout';
import { SurvivalChapter } from '../chapters/survival/SurvivalChapter';
import { ShadowsChapter } from '../chapters/shadows/ShadowsChapter';
import { SHADOWS_PATH, SHADOWS_SPAWN } from '../chapters/shadows/layout';
import type { ChapterId } from '../data/chapters';
import { Lighting } from '../environment/Lighting';
import { InteractionManager } from '../interactions/Interactable';
import { VIEW } from '../player/movement';
import { Player } from '../player/Player';
import { RailController } from '../player/RailController';
import { SURVIVAL_PATH } from '../chapters/survival/path';
import { PlayerCamera } from '../player/PlayerCamera';
import { viewFocus } from '../player/viewFocus';
import { playerState } from '../player/playerState';
import { installBVH } from '../rendering/bvh';
import { Autofocus } from '../rendering/focus';
import { installHeightFog } from '../rendering/heightFog';
import { adaptive, useBudget } from '../rendering/adaptive';
import { installInstanceCulling } from '../rendering/instanceCulling';
import { installLightRange } from '../rendering/lightRange';
import { warmUpShaders } from '../rendering/warmup';
import { Lightning } from '../rendering/Lightning';
import { lookFor, type Look } from '../rendering/looks';
import { PostFX } from '../rendering/PostFX';
import { getGame, setGame, useGame } from './GameState';

installHeightFog();   // before any material compiles
installBVH();         // fast raycasts (interaction look-at, autofocus)
installLightRange();  // point lights skip the pixels they can't reach (identical image, far less shading)

const SPAWN: Partial<Record<ChapterId, { p: [number, number, number]; yaw: number }>> = {
  prototype: { p: [0, 0, 6], yaw: 0 },
  survival: { p: SURVIVAL_SPAWN.p, yaw: yawTowards(SURVIVAL_SPAWN.p, SURVIVAL_SPAWN.lookAt) },
  shadows: { p: SHADOWS_SPAWN.p, yaw: yawTowards(SHADOWS_SPAWN.p, SHADOWS_SPAWN.lookAt) },
};

/** scroll mode's path through each chapter */
const RAILS: Partial<Record<ChapterId, typeof SURVIVAL_PATH>> = { survival: SURVIVAL_PATH, shadows: SHADOWS_PATH };

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

/** per-instance frustum culling of the instanced vegetation, before every render of the scene */
function InstanceCulling() {
  const scene = useThree((s) => s.scene);
  useEffect(() => installInstanceCulling(scene), [scene]);
  return null;
}

/** the start screen is opaque black until the visitor chooses how to move: rendering the world behind it only heats
 *  the GPU. Behind it the world warms up instead: a few frames (textures uploaded), then every shader the walk and
 *  the panels will need is compiled (rendering/warmup.ts: removes the 0.6 s stalls near the sungka shelter and the
 *  first-panel stall). Then the frame loop stops; the click that starts the game (mode → playing) restarts it before
 *  the black fades, and stops a warm-up that hasn't finished (the rest then compiles on first use, as before). */
function WarmUpBehindIntro() {
  const mode = useGame((s) => s.mode);
  const gl = useThree((s) => s.gl), scene = useThree((s) => s.scene), camera = useThree((s) => s.camera);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const paused = useRef(false), warmed = useRef(false);
  useEffect(() => {
    if (mode !== 'intro') {
      if (paused.current) { paused.current = false; setFrameloop('always'); }
      return;
    }
    let frames = 0, raf = 0, cancelled = false;
    const pause = () => { if (!cancelled) { paused.current = true; setFrameloop('never'); } };
    const warm = () => {
      if (++frames < 10) { raf = requestAnimationFrame(warm); return; }
      if (warmed.current) { pause(); return; }
      void warmUpShaders(gl, scene, camera, () => cancelled).then((done) => { if (done) { warmed.current = true; pause(); } });
    };
    raf = requestAnimationFrame(warm);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [mode, gl, scene, camera, setFrameloop]);
  return null;
}

/** the adaptive quality governor (rendering/adaptive.ts): picks the first step from the GPU, then times real frames
 *  while the visitor plays and steps the budget down when it runs slower than ~45 fps, back up after ~8 s at 60 */
function AdaptiveQuality() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const ctx = gl.getContext(), ext = ctx.getExtension('WEBGL_debug_renderer_info');
    adaptive.start(String(ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER)));
  }, [gl]);
  const st = useRef({ last: 0, sum: 0, n: 0, good: 0, quietUntil: 0 });
  useFrame(() => {
    if (adaptive.pinned) return;
    const now = performance.now(), s = st.current, dt = now - s.last; s.last = now;
    const mode = getGame().mode;
    // only real play counts (not the start screen, a hidden tab or the hitch right after a change)
    if (document.hidden || !document.hasFocus() || (mode !== 'playing' && mode !== 'reading') || dt <= 0 || dt > 250 || now < s.quietUntil) { s.sum = 0; s.n = 0; return; }
    s.sum += dt; s.n++;
    if (s.sum < 1500) return;
    const avg = s.sum / s.n; s.sum = 0; s.n = 0;
    if (avg > 22) { s.good = 0; if (adaptive.down()) s.quietUntil = now + 2500; }
    else if (avg < 17.5) { s.good += 1.5; if (s.good >= 8) { s.good = 0; if (adaptive.up()) s.quietUntil = now + 2500; } }
    else s.good = 0;
  });
  return null;
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
  // render resolution from the adaptive budget, never above the screen's own density
  const budget = useBudget();
  const deviceDpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
  const dpr = quality === 'low' ? 1 : Math.max(0.75, Math.min(budget.dpr, deviceDpr));
  const post = quality !== 'low';

  return (
    <Canvas
      shadows={quality !== 'low' ? { type: PCFShadowMap } : false}
      dpr={dpr}
      gl={{ antialias: !post, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: VIEW.fov, near: 0.05, far: 600, position: [0, VIEW.eyeHeight, 6] }}
      onCreated={(st) => { const { gl } = st; if (new URLSearchParams(window.location.search).has('debug')) { const w = window as unknown as Record<string, unknown>; w.__r3f = st; w.__player = playerState; w.__game = { getGame, setGame }; w.__audio = audio; w.__adaptive = adaptive; w.__viewFocus = viewFocus; } gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1; gl.outputColorSpace = SRGBColorSpace; }}
    >
      <AdaptiveQuality />
      <RendererToneMapping look={look} post={post} />
      <InstanceCulling />
      <WarmUpBehindIntro />
      <Suspense fallback={null}>
        <Lighting look={look} quality={quality} shadowSize={budget.shadow} />
        {(look.weather?.lightning ?? 0) > 0 && <Lightning look={look} />}
        <Physics gravity={[0, -9.81, 0]} timeStep="vary" debug={debugPhysics}>
          {chapter === 'survival' ? <SurvivalChapter /> : chapter === 'shadows' ? <ShadowsChapter /> : <TestRange />}
          <Player key={chapter} spawn={spawn.p} spawnYaw={spawn.yaw} />
          {RAILS[chapter] && movement === 'scroll' && <RailController key={`rail-${chapter}`} path={RAILS[chapter]!} />}
          <PlayerCamera />
          <InteractionManager />
          <Footsteps />
        </Physics>
        {quality === 'high' && <Autofocus />}
        <LoadWatcher />
      </Suspense>
      {/* keyed by quality: the AO pass can't change resolution / MSAA in place, so the chain is rebuilt */}
      {post && <PostFX key={`${quality}-${budget.msaa}`} look={look} quality={quality} budget={budget} reducedMotion={reducedMotion} />}
    </Canvas>
  );
}

/* The post-processing chain ("ENB" layer), driven by the current chapter's Look:
     N8AO ambient occlusion → depth of field (high: gentle autofocus on the centre of frame)
     → sun light rays (god rays through clouds, roofs, poles and trees) → bloom (HDR) → sun lens flare
     → exposure + white balance → tone mapping (AgX / ACES / Neutral)
     → film grade (lift/gamma/gain, contrast, saturation, split toning) → chromatic aberration → vignette → grain
   Quality: high = everything, AO at 'low' sampling, 2× MSAA, light rays at 40% resolution; medium = AO at
   'performance' sampling, no DOF / light rays / flare, lighter bloom, SMAA instead of MSAA (n8ao's half-resolution mode is not used: its render targets break on three.js
   r187); low = no post-processing (the renderer tone-maps directly, see GameCanvas).
   Reduced motion turns off the animated grain, the chromatic fringe and the flare's shimmer. */
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, GodRays, LensFlareEffect, N8AO, Noise, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, DepthOfFieldEffect, ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Color, MathUtils, Raycaster, Vector2, Vector3, type Mesh } from 'three';
import { focus } from './focus';
import { ExposureBalanceEffect, FilmGradeEffect } from './grading';
import type { Look } from './looks';

const TONE: Record<Look['post']['toneMapping'], ToneMappingMode> = {
  aces: ToneMappingMode.ACES_FILMIC, agx: ToneMappingMode.AGX, neutral: ToneMappingMode.NEUTRAL,
};
const SUN_DISTANCE = 450;   // m: the sun disc sits this far along the sun direction (inside the camera's far plane)

export function PostFX({ look, quality, reducedMotion }: { look: Look; quality: 'high' | 'medium'; reducedMotion: boolean }) {
  const p = look.post;
  const high = quality === 'high';
  const camera = useThree((s) => s.camera), scene = useThree((s) => s.scene), size = useThree((s) => s.size);

  // grading
  const exposure = useMemo(() => new ExposureBalanceEffect(), []);
  const grade = useMemo(() => new FilmGradeEffect(), []);
  useEffect(() => { exposure.set(p.exposure, p.temperature, p.tint); grade.set(p); }, [exposure, grade, p]);
  useEffect(() => () => { exposure.dispose(); grade.dispose(); }, [exposure, grade]);
  const fringe = useMemo(() => new Vector2(p.chromatic, p.chromatic * 0.6), [p.chromatic]);

  // depth of field: gentle. Only clearly distant or very near things soften; the in-focus band is wide.
  const dof = useMemo(() => new DepthOfFieldEffect(camera, { focusDistance: 8, focusRange: 20, bokehScale: 0.4, resolutionScale: 0.5 }), [camera]);
  useEffect(() => () => dof.dispose(), [dof]);

  // sun: a disc on the sky's sun (source of the light rays), plus a lens flare that fades when the sun is blocked
  const sunDir = useMemo(() => new Vector3(...look.sun.direction).normalize(), [look.sun.direction]);
  const fx = look.sunFx ?? { flare: 0, rays: 0 };
  const [sun, setSun] = useState<Mesh | null>(null);
  const sunHdr = useMemo(() => new Color(look.sun.color).multiplyScalar(60), [look.sun.color]);
  const flare = useMemo(() => new LensFlareEffect({
    glareSize: 0.12, starPoints: 6, flareSize: 0.004, flareSpeed: 0.004, flareShape: 0.08, animated: true,
    haloScale: 0.35, secondaryGhosts: false, aditionalStreaks: false, ghostScale: 0.03, starBurst: false,
    colorGain: new Color(26, 23, 19), opacity: 1,   // 1 = hidden in this shader (see useFrame)
  }), []);
  useEffect(() => () => flare.dispose(), [flare]);
  const occlusion = useMemo(() => { const r = new Raycaster(); r.far = 300; (r as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true; return r; }, []);
  const tmp = useMemo(() => ({ proj: new Vector3(), view: new Vector3() }), []);
  const visible = useRef(0), frame = useRef(0), flareStrength = useRef(0);

  useFrame((_, dt) => {
    if (high) {
      dof.cocMaterial.focusDistance = focus.distance;
      dof.cocMaterial.focusRange = Math.max(10, focus.distance * 3);   // a gentle falloff: the distance stays readable
    }
    if (sun) sun.position.copy(camera.position).addScaledVector(sunDir, SUN_DISTANCE);
    if (fx.flare <= 0) return;
    // where is the sun on screen, and is anything in front of it?
    tmp.proj.copy(camera.position).addScaledVector(sunDir, SUN_DISTANCE).project(camera);
    camera.getWorldDirection(tmp.view);
    const facing = tmp.view.dot(sunDir);                                   // 1 = looking straight at the sun
    let target = 0;
    if (tmp.proj.z < 1 && facing > 0) {
      if (frame.current++ % 3 === 0) {
        occlusion.set(camera.position, sunDir);
        const blocked = occlusion.intersectObject(scene, true).some((h) => h.object.visible && h.object !== sun);
        visible.current = blocked ? 0 : 1;
      }
      // only while the sun itself is inside the frame (ghosts mirror through the centre, so an off-frame sun
      // would put flare artefacts on the opposite edge)
      const onScreen = 1 - MathUtils.smoothstep(Math.max(Math.abs(tmp.proj.x), Math.abs(tmp.proj.y)), 0.7, 0.95);
      target = visible.current * onScreen * MathUtils.smoothstep(facing, 0.6, 0.95) * fx.flare;
    }
    // NB: the library's shader computes mix(flare, 0, opacity): its "opacity" 1 means NO flare, so invert
    flareStrength.current = MathUtils.damp(flareStrength.current, target, 8, Math.min(Math.max(dt, 0), 0.1));
    flare.uniforms.get('opacity')!.value = 1 - flareStrength.current;
    const lp = flare.uniforms.get('lensPosition')!.value as Vector2;
    lp.set(tmp.proj.x, tmp.proj.y);
    (flare.uniforms.get('screenRes')!.value as Vector2).set(size.width, size.height);
    flare.uniforms.get('animated')!.value = !reducedMotion;
  });

  return (
    <>
      {fx.rays > 0 && (
        <mesh ref={setSun} frustumCulled={false}>
          <sphereGeometry args={[9, 24, 12]} />
          {/* HDR-bright like the sky's own sun (which is thousands of times brighter than white), so the disc
              blends into it instead of showing as a grey spot */}
          <meshBasicMaterial color={sunHdr} fog={false} toneMapped={false} />
        </mesh>
      )}
      <EffectComposer multisampling={high ? 4 : 0} enableNormalPass={false}>
        <N8AO aoRadius={p.ao.radius} intensity={p.ao.intensity} distanceFalloff={p.ao.falloff}
          quality={high ? 'low' : 'performance'} halfRes={false} color="black" />
        {high ? <primitive object={dof} /> : <></>}
        {high && sun && fx.rays > 0 ? (
          <GodRays sun={sun} density={0.94} decay={0.92} weight={0.32 * fx.rays} exposure={0.42 * fx.rays} samples={30} clampMax={1} blur resolutionScale={0.4} />
        ) : <></>}
        <Bloom mipmapBlur intensity={p.bloom.intensity * (high ? 1 : 0.8)} luminanceThreshold={p.bloom.threshold}
          luminanceSmoothing={p.bloom.smoothing} radius={p.bloom.radius} />
        {high && fx.flare > 0 ? <primitive object={flare} /> : <></>}
        <primitive object={exposure} />
        <ToneMapping mode={TONE[p.toneMapping]} />
        <primitive object={grade} />
        {!reducedMotion && p.chromatic > 0 ? <ChromaticAberration offset={fringe} radialModulation modulationOffset={0.35} /> : <></>}
        <Vignette offset={p.vignette.offset} darkness={p.vignette.darkness} />
        {!reducedMotion && p.grain > 0 ? <Noise premultiply blendFunction={BlendFunction.ADD} opacity={p.grain} /> : <></>}
        {high ? <></> : <SMAA />}
      </EffectComposer>
    </>
  );
}

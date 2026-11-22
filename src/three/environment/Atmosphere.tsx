/* Sky dome (gradient shader that follows the camera), exponential fog and background colour, all blended between
   chapters from scroll progress. The fog thickens during chapter flights so worlds dissolve into each other. */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BackSide, Color, FogExp2, Mesh, ShaderMaterial } from 'three';
import { progress } from '../../state/journey';
import { airAt, newAir } from '../animations/journeyMath';

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const fragment = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uFog; uniform vec3 uSun; uniform vec3 uSunDir;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, h));
    col = mix(col, uFog, smoothstep(0.08, -0.25, h));                 // below the horizon: into the fog
    float sun = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
    col += uSun * (pow(sun, 64.0) * 0.55 + pow(sun, 6.0) * 0.12);     // soft sun glow, no hard disc
    // gentle dithering against banding on large gradients
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    gl_FragColor = vec4(col + (n - 0.5) / 255.0, 1.0);
  }`;

export const SUN_DIR: [number, number, number] = [-0.55, 0.32, -0.77];

export function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const dome = useRef<Mesh>(null);
  const air = useMemo(newAir, []);
  const fog = useMemo(() => new FogExp2('#2b3a4c', 0.004), []);
  const bg = useMemo(() => new Color(), []);
  const mat = useMemo(() => new ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, side: BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new Color() }, uHorizon: { value: new Color() }, uFog: { value: new Color() }, uSun: { value: new Color() }, uSunDir: { value: SUN_DIR } },
  }), []);

  useFrame(() => {
    airAt(progress.value, air);
    if (scene.fog !== fog) scene.fog = fog;
    fog.color.copy(air.fog); fog.density = air.fogDensity;
    scene.background = bg.copy(air.fog);
    const u = mat.uniforms;
    (u.uTop.value as Color).copy(air.skyTop); (u.uHorizon.value as Color).copy(air.skyHorizon);
    (u.uFog.value as Color).copy(air.fog); (u.uSun.value as Color).copy(air.sun);
    dome.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={dome} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1400, 32, 16]} />
    </mesh>
  );
}

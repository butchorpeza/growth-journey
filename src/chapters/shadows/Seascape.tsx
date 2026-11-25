/* The night around the island: the sky and the sea.
   - Sky: a dome drawn behind everything. A low, heavy overcast in slow-moving layers (fbm noise), a moon behind it
     that silvers the edges of the thinner cloud, a pale haze at the horizon that meets the fog, and the whole sky
     lit from within for an instant when lightning strikes (rendering/Lightning.tsx `lightningState`).
   - Sea: near-black water to the horizon. Its surface moves (several layers of travelling waves, in the shader),
     reflects the faint sky at grazing angles, catches a broken path of moonlight, and breaks into pale foam where it
     meets the island (the shore from layout.ts). Fogged like everything else, so the island stands alone in it. */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BackSide, Color, ShaderMaterial, UniformsLib, UniformsUtils, Vector3, type Mesh } from 'three';
import { lightningState } from '../../rendering/Lightning';
import { WATER_Y, WOBBLE_GLSL } from './layout';

const NOISE = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }`;

/** the eastern sky's first warmth, at the very end of the chapter (Descent.tsx Ending) */
export const skyState = { dawn: 0 };

export function Sky({ moon }: { moon: [number, number, number] }) {
  const mat = useMemo(() => new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uMoon: { value: new Vector3(...moon).normalize() }, uFlash: { value: 0 }, uDawn: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uMoon; uniform float uFlash; uniform float uDawn;
      varying vec3 vDir;
      ${NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        vec3 horizon = vec3(0.060, 0.072, 0.092), zenith = vec3(0.010, 0.014, 0.022);
        vec3 col = mix(horizon, zenith, pow(up, 0.55));
        // the cloud layers, projected onto a flat ceiling
        vec2 uv = d.xz / max(0.08, d.y + 0.06);
        float c1 = fbm(uv * 0.55 + vec2(uTime * 0.006, uTime * 0.002));
        float c2 = fbm(uv * 1.35 - vec2(uTime * 0.011, -uTime * 0.004) + 3.7);
        float cover = smoothstep(0.32, 0.78, c1 * 0.7 + c2 * 0.45);
        // the end: the cloud thins in the east and the first gold of the sunrise opens low over the sea
        float west = pow(max(dot(d, normalize(vec3(1.0, 0.06, 0.0))), 0.0), 5.0);
        cover *= 1.0 - 0.7 * uDawn * west;
        float md = max(dot(d, uMoon), 0.0);
        // the moon: a dim disc, a wide halo, mostly hidden by the cloud; the thin cloud near it glows silver
        float disc = smoothstep(0.99955, 0.99975, md);
        float halo = pow(md, 90.0) * 0.55 + pow(md, 12.0) * 0.12;
        vec3 moonCol = vec3(0.62, 0.70, 0.82);
        col += moonCol * halo * (1.0 - cover * 0.75);
        col += moonCol * 2.2 * disc * (1.0 - smoothstep(0.35, 0.8, cover));
        vec3 cloud = mix(vec3(0.022, 0.026, 0.034), vec3(0.075, 0.085, 0.105), c2);
        cloud += moonCol * pow(md, 30.0) * 0.35 * (1.0 - c1);                 // silver lining
        col = mix(col, cloud, cover * smoothstep(-0.02, 0.18, d.y));
        // lightning lights the clouds from inside
        col += vec3(0.55, 0.62, 0.78) * uFlash * (0.25 + cover * 0.9) * smoothstep(-0.05, 0.4, d.y);
        col += vec3(1.0, 0.6, 0.3) * uDawn * (west * 0.5 + pow(max(dot(d, normalize(vec3(1.0, 0.02, 0.0))), 0.0), 40.0) * 0.9);
        // haze at the horizon, into the fog colour
        col = mix(col, horizon * 1.1, 1.0 - smoothstep(0.0, 0.12, abs(d.y)));
        if (d.y < 0.0) col = horizon * 0.9;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), [moon]);
  const dome = useRef<Mesh>(null);
  useFrame((st) => {
    mat.uniforms.uTime.value = st.clock.elapsedTime; mat.uniforms.uFlash.value = lightningState.k; mat.uniforms.uDawn.value = skyState.dawn;
    dome.current?.position.copy(st.camera.position);                      // always at the horizon
  });
  return (
    <mesh ref={dome} material={mat} renderOrder={-10} frustumCulled={false} raycast={() => {}}>
      <sphereGeometry args={[480, 48, 24]} />
    </mesh>
  );
}

export function Sea({ moon }: { moon: [number, number, number] }) {
  const mat = useMemo(() => new ShaderMaterial({
    fog: true,
    uniforms: UniformsUtils.merge([UniformsLib.fog, {
      uTime: { value: 0 }, uMoon: { value: new Vector3(...moon).normalize() }, uFlash: { value: 0 },
      uDeep: { value: new Color('#020509') }, uSky: { value: new Color('#121a26') }, uDawn: { value: 0 },
    }]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uMoon; uniform float uFlash; uniform vec3 uDeep; uniform vec3 uSky; uniform float uDawn;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      ${NOISE}
      ${WOBBLE_GLSL}
      // the slope of a few travelling waves (long swell, chop) and fine noise ripples
      vec2 waves(vec2 p, float t) {
        vec2 g = vec2(0.0);
        vec4 dirs[4];
        dirs[0] = vec4(normalize(vec2(0.3, 1.0)), 0.09, 0.55);
        dirs[1] = vec4(normalize(vec2(-0.7, 0.6)), 0.17, 0.32);
        dirs[2] = vec4(normalize(vec2(0.9, 0.2)), 0.31, 0.18);
        dirs[3] = vec4(normalize(vec2(-0.2, -1.0)), 0.53, 0.10);
        for (int i = 0; i < 4; i++) {
          float k = dirs[i].z, a = dirs[i].w;
          float ph = dot(dirs[i].xy, p) * k * 6.0 - t * sqrt(9.8 * k) * 1.4;
          g += dirs[i].xy * cos(ph) * a * k;
        }
        float e = 0.35;
        float n0 = fbm(p * 0.9 + t * 0.15), nx = fbm(p * 0.9 + vec2(e, 0.0) + t * 0.15), nz = fbm(p * 0.9 + vec2(0.0, e) + t * 0.15);
        g += vec2(nx - n0, nz - n0) / e * 0.12;
        return g;
      }
      void main() {
        vec2 p = vWorld.xz;
        vec2 g = waves(p, uTime);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 col = mix(uDeep, uSky, fres);
        // the moon's broken path on the water
        vec3 h = normalize(uMoon + v);
        float spec = pow(max(dot(n, h), 0.0), 420.0) * 3.5 + pow(max(dot(n, h), 0.0), 60.0) * 0.08;
        col += vec3(0.55, 0.63, 0.78) * spec;
        col += vec3(0.4, 0.46, 0.58) * uFlash * fres * 1.5;
        vec3 hw = normalize(normalize(vec3(1.0, 0.04, 0.0)) + v);
        col += vec3(1.0, 0.62, 0.32) * uDawn * (pow(max(dot(n, hw), 0.0), 200.0) * 1.8 + fres * 0.25);
        // foam where it breaks on the shore
        float rn = islandRn(p);
        float band = 1.0 - smoothstep(0.0, 0.035, abs(rn - 1.03));
        float foam = band * smoothstep(0.45, 0.75, fbm(p * 1.7 + vec2(uTime * 0.25, -uTime * 0.18)) + 0.25 * sin(uTime * 0.9 + rn * 120.0));
        col = mix(col, vec3(0.16, 0.18, 0.2), foam * 0.75);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), [moon]);
  useFrame((st) => { mat.uniforms.uTime.value = st.clock.elapsedTime; mat.uniforms.uFlash.value = lightningState.k; mat.uniforms.uDawn.value = skyState.dawn; });
  return (
    <mesh material={mat} rotation-x={-Math.PI / 2} position={[0, WATER_Y, 0]} raycast={() => {}}>
      <planeGeometry args={[1400, 1400, 1, 1]} />
    </mesh>
  );
}

/* Weather, patched into every lit material of a chapter (one patch, shared uniforms):
   - Cloud shadows: drifting noise cells dim the sun's direct light (sky light untouched). Sunny presets only.
   - Wetness: outdoor surfaces in the rain get darker and glossier, most on surfaces facing the sky; puddles form
     in the mud of the road (terrain only). Anything under a roof stays dry.
   - Shelter: a top-down height map of the chapter's static geometry (rendered once at load, see
     buildShelterMap). A point is sheltered when something stands above it. Rain streaks, wetness and the
     "rain on the roof" sound all read it, so no rain falls inside the houses. */
import {
  Camera, Color, DataTexture, FloatType, Mesh, NearestFilter, OrthographicCamera, RGBAFormat, ShaderChunk, ShaderMaterial, Vector3,
  WebGLRenderTarget, type Material, type Object3D, type WebGLRenderer,
} from 'three';

export const weather = {
  time: { value: 0 },
  coverage: { value: 0.42 },
  cloudStrength: { value: 0 },
  wetness: { value: 0 },
  shelterMap: { value: new DataTexture(new Float32Array([-1e4, 0, 0, 1]), 1, 1, RGBAFormat, FloatType) },
  shelterRect: { value: new Vector3(0, 0, 1) },   // min x, max z, size (m)
};
weather.shelterMap.value.needsUpdate = true;

const DIR_LIGHT = 'getDirectionalLightInfo( directionalLight, directLight );';

const COMMON = /* glsl */ `
uniform float uWxTime, uWxCoverage, uWxCloud, uWxWet;
uniform sampler2D uWxShelter;
uniform vec3 uWxRect;
varying vec3 vWxWorld;
float wxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wxNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wxHash(i), wxHash(i + vec2(1.0, 0.0)), f.x), mix(wxHash(i + vec2(0.0, 1.0)), wxHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float cloudLight() {
  vec2 p = vWxWorld.xz / 70.0 + vec2(0.055, 0.018) * uWxTime;
  float n = wxNoise(p) * 0.65 + wxNoise(p * 2.3 + 7.1) * 0.35;
  return 1.0 - uWxCloud * smoothstep(1.0 - uWxCoverage - 0.12, 1.0 - uWxCoverage + 0.12, n);
}
float wxShelterY(vec2 xz) {
  vec2 uv = vec2(xz.x - uWxRect.x, uWxRect.y - xz.y) / uWxRect.z;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return -1e4;
  return texture2D(uWxShelter, uv).r;
}`;

const WET = (puddles: boolean) => /* glsl */ `
{
  vec3 wxN = normalize(transpose(mat3(viewMatrix)) * normal);
  float wxUp = smoothstep(0.2, 0.9, wxN.y);
  float wxDry = step(vWxWorld.y + 0.3, wxShelterY(vWxWorld.xz));          // 1 = a roof is above this point
  float wxWet = uWxWet * (1.0 - wxDry) * mix(0.3, 1.0, wxUp);
  // wet surfaces darken and gain a soft sheen (not a mirror: soaked earth and wood stay fairly rough)
  diffuseColor.rgb *= mix(1.0, 0.58, wxWet);
  roughnessFactor = mix(roughnessFactor, max(0.42, roughnessFactor * 0.6), wxWet * wxUp);
  ${puddles ? `
  // puddles collect in the mud of the road and the wettest yard patches
  float wxPool = smoothstep(0.58, 0.72, wxNoise(vWxWorld.xz * 0.32) * 0.7 + wxNoise(vWxWorld.xz * 1.1) * 0.3);
  float wxPuddle = wxPool * clamp(splatW.x * 1.4 + splatW.y * 0.4, 0.0, 1.0) * wxUp * uWxWet * (1.0 - wxDry);
  diffuseColor.rgb *= mix(1.0, 0.35, wxPuddle);
  roughnessFactor = mix(roughnessFactor, 0.12, wxPuddle);` : ''}
}`;

/** patch a lit material once; `puddles` only for the terrain (uses its splat weights) */
export function applyWeather(mat: Material, opts: { puddles?: boolean } = {}) {
  if (mat.userData.weather) return;
  mat.userData.weather = true;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    if (!shader.fragmentShader.includes('#include <lights_fragment_begin>')) return;   // unlit materials
    Object.assign(shader.uniforms, {
      uWxTime: weather.time, uWxCoverage: weather.coverage, uWxCloud: weather.cloudStrength, uWxWet: weather.wetness,
      uWxShelter: weather.shelterMap, uWxRect: weather.shelterRect,
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWxWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWxWorld = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}`)
      .replace('#include <lights_physical_fragment>', `${WET(!!opts.puddles)}\n#include <lights_physical_fragment>`)
      .replace('#include <lights_fragment_begin>', ShaderChunk.lights_fragment_begin.replace(DIR_LIGHT, `${DIR_LIGHT}\n\t\tdirectLight.color *= cloudLight();`));
  };
  mat.customProgramCacheKey = () => `${prevKey()}|weather_v1${opts.puddles ? 'p' : ''}`;
  mat.needsUpdate = true;
}

/** top-down height map of `root` (the static chapter geometry): rendered once; also returned for CPU lookups */
export function buildShelterMap(gl: WebGLRenderer, root: Object3D, centre: [number, number], size: number, res = 512) {
  const heightMat = new ShaderMaterial({
    vertexShader: 'varying float vY; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'varying float vY; void main() { gl_FragColor = vec4(vY, 0.0, 0.0, 1.0); }',
    side: 2,
  });
  const cam: Camera = new OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 1, 400);
  cam.position.set(centre[0], 200, centre[1]); cam.up.set(0, 0, -1); cam.lookAt(centre[0], 0, centre[1]); cam.updateMatrixWorld();
  const rt = new WebGLRenderTarget(res, res, { type: FloatType, format: RGBAFormat, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true });
  const swapped: [Mesh, Mesh['material']][] = [];
  root.traverse((o) => { const m = o as Mesh; if (m.isMesh && !(m as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh) { swapped.push([m, m.material]); m.material = heightMat; } });
  const prev = gl.getRenderTarget(), prevColor = gl.getClearColor(new Color()), prevAlpha = gl.getClearAlpha();
  const clearHeight = -1e4;   // open sky: never sheltered
  gl.setRenderTarget(rt); gl.setClearColor(0x000000, 0); gl.clear();   // alpha 0 marks texels with nothing above
  gl.render(root, cam);
  gl.setRenderTarget(prev); gl.setClearColor(prevColor, prevAlpha);
  swapped.forEach(([m, mat]) => { m.material = mat; });
  heightMat.dispose();
  const px = new Float32Array(res * res * 4);
  gl.readRenderTargetPixels(rt, 0, 0, res, res, px);
  rt.dispose();
  // empty texels (alpha 0) mean open sky
  for (let i = 0; i < res * res; i++) if (px[i * 4 + 3] < 0.5) px[i * 4] = clearHeight;
  const tex = new DataTexture(px, res, res, RGBAFormat, FloatType);
  tex.minFilter = tex.magFilter = NearestFilter; tex.needsUpdate = true;
  const minX = centre[0] - size / 2, maxZ = centre[1] + size / 2;
  weather.shelterMap.value = tex;
  weather.shelterRect.value.set(minX, maxZ, size);
  /** height of the highest static surface above (x, z), or -1e4 for open sky */
  const heightAt = (x: number, z: number) => {
    const u = (x - minX) / size, v = (maxZ - z) / size;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return clearHeight;
    return px[(Math.floor(v * res) * res + Math.floor(u * res)) * 4];
  };
  return { texture: tex, heightAt };
}

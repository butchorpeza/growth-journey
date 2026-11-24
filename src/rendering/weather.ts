/* Weather, patched into every lit material of a chapter (one patch, shared uniforms):
   - Cloud shadows: drifting noise cells dim the sun's direct light (sky light untouched). Sunny presets only.
   - Wetness: outdoor surfaces in the rain get darker and glossier, most on surfaces facing the sky; puddles form
     in the mud of the road (terrain only). Anything under a roof stays dry.
   - Shelter: a top-down height map of the chapter's static geometry (rendered once at load, see
     buildShelterMap). A point is sheltered when something stands above it. Rain streaks, wetness and the
     "rain on the roof" sound all read it, so no rain falls inside the houses. */
import {
  Camera, Color, DataTexture, FloatType, LinearFilter, Mesh, NearestFilter, OrthographicCamera, Raycaster, RGBAFormat, ShaderChunk, ShaderMaterial,
  UnsignedByteType, Vector3, WebGLRenderTarget, type Material, type Object3D, type WebGLRenderer,
} from 'three';

export const weather = {
  time: { value: 0 },
  coverage: { value: 0.42 },
  cloudStrength: { value: 0 },
  wetness: { value: 0 },
  shelterMap: { value: new DataTexture(new Float32Array([-1e4, 0, 0, 1]), 1, 1, RGBAFormat, FloatType) },
  shelterRect: { value: new Vector3(0, 0, 1) },   // min x, max z, size (m)
  /** how far the ground lies below its surroundings (R: 0…1 = 0…DEPTH_SCALE m), where puddles collect */
  puddleMap: { value: new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat, UnsignedByteType) },
  puddleRect: { value: new Vector3(0, 0, 1) },    // min x, max z, size (m)
};
weather.shelterMap.value.needsUpdate = true;
weather.puddleMap.value.needsUpdate = true;
const DEPTH_SCALE = 0.25;

const DIR_LIGHT = 'getDirectionalLightInfo( directionalLight, directLight );';

const COMMON = /* glsl */ `
uniform float uWxTime, uWxCoverage, uWxCloud, uWxWet;
uniform sampler2D uWxShelter, uWxPuddle;
uniform vec3 uWxRect, uWxPuddleRect;
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
float wxDepression(vec2 xz) {   // metres below the surrounding ground (0 outside the map)
  vec2 uv = vec2(xz.x - uWxPuddleRect.x, uWxPuddleRect.y - xz.y) / uWxPuddleRect.z;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture2D(uWxPuddle, uv).r * ${DEPTH_SCALE.toFixed(2)};
}
float wxShelterY(vec2 xz) {
  vec2 uv = vec2(xz.x - uWxRect.x, uWxRect.y - xz.y) / uWxRect.z;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return -1e4;
  return texture2D(uWxShelter, uv).r;
}`;

const WET = (puddles: boolean, matte = false) => /* glsl */ `
{
  vec3 wxN = normalize(transpose(mat3(viewMatrix)) * normal);
  float wxUp = smoothstep(0.2, 0.9, wxN.y);
  // 1 = a roof is above this point. The map's cells are ~33 cm: average several taps with a little noise, so the
  // drip line under an eave is a soft, irregular edge rather than a staircase of cells
  vec2 wxJ = vec2(wxNoise(vWxWorld.xz * 2.3), wxNoise(vWxWorld.xz * 2.3 + 5.1)) * 0.3 - 0.15;
  float wxDry = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(i == 0 ? 0.22 : i == 1 ? -0.22 : 0.0, i == 2 ? 0.22 : i == 3 ? -0.22 : 0.0);
    wxDry += step(vWxWorld.y + 0.3, wxShelterY(vWxWorld.xz + o + wxJ)) * 0.25;
  }
  float wxWet = uWxWet * (1.0 - wxDry) * mix(0.3, 1.0, wxUp);
  // wet surfaces darken and gain a soft sheen (not a mirror: soaked earth and wood stay fairly rough)
  diffuseColor.rgb *= mix(1.0, 0.58, wxWet);
  ${matte ? '// fibrous (thatch): darkens when soaked but never turns glossy' : 'roughnessFactor = mix(roughnessFactor, max(0.55, roughnessFactor * 0.65), wxWet * wxUp);'}
  ${puddles ? `
  // puddles: water stands where the ground lies below its surroundings (ruts, hollows, the low side of the yard),
  // with a broken, irregular shoreline. The water is still: its surface faces straight up and reflects the sky and
  // the surroundings, slightly rough so it isn't a mirror; a darker band of soaked earth rings it.
  float wxDep = wxDepression(vWxWorld.xz) + (wxNoise(vWxWorld.xz * 0.9) - 0.5) * 0.035 + (wxNoise(vWxWorld.xz * 3.7) - 0.5) * 0.012;
  float wxGround = clamp(splatW.x * 1.3 + splatW.y * 0.9 + splatW.z * 0.6 + (1.0 - splatW.x - splatW.y - splatW.z) * 0.3, 0.0, 1.0);
  float wxOpen = wxUp * uWxWet * (1.0 - wxDry) * wxGround;
  // compacted mud holds water in shallow ruts; grass and loose soil drain unless the hollow is deep
  float wxRoad = clamp(splatW.x * 1.4 + splatW.y * 0.5, 0.0, 1.0);
  float wxDeep = mix(0.09, 0.024, wxRoad);
  float wxPuddle = smoothstep(wxDeep, wxDeep * 1.5, wxDep) * wxOpen;
  float wxSoak = smoothstep(wxDeep * 0.35, wxDeep, wxDep) * wxOpen;
  diffuseColor.rgb *= mix(1.0, 0.72, wxSoak);
  roughnessFactor = mix(roughnessFactor, 0.4, wxSoak * 0.6);
  diffuseColor.rgb *= mix(1.0, 0.3, wxPuddle);
  roughnessFactor = mix(roughnessFactor, 0.07, wxPuddle);
  normal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), wxPuddle));` : ''}
}`;

/** patch a lit material once; `puddles` only for the terrain (uses its splat weights) */
export function applyWeather(mat: Material, opts: { puddles?: boolean; matte?: boolean } = {}) {
  if (mat.userData.weather) return;
  mat.userData.weather = true;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    if (!shader.fragmentShader.includes('#include <lights_fragment_begin>')) return;   // unlit materials
    Object.assign(shader.uniforms, {
      uWxTime: weather.time, uWxCoverage: weather.coverage, uWxCloud: weather.cloudStrength, uWxWet: weather.wetness,
      uWxShelter: weather.shelterMap, uWxRect: weather.shelterRect, uWxPuddle: weather.puddleMap, uWxPuddleRect: weather.puddleRect,
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWxWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWxWorld = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}`)
      .replace('#include <lights_physical_fragment>', `${WET(!!opts.puddles, !!opts.matte)}\n#include <lights_physical_fragment>`)
      .replace('#include <lights_fragment_begin>', ShaderChunk.lights_fragment_begin.replace(DIR_LIGHT, `${DIR_LIGHT}\n\t\tdirectLight.color *= cloudLight();`));
  };
  mat.customProgramCacheKey = () => `${prevKey()}|weather_v4${opts.puddles ? 'p' : ''}${opts.matte ? 'm' : ''}`;
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

/** where puddles can collect: samples the terrain height on a grid (a BVH ray straight down per texel), compares each
 *  point with the average of its surroundings (~1.2 m), and stores how far below that average it lies. Run once at
 *  load (about 65k rays on a 256² grid). */
export function buildPuddleMap(terrain: Mesh, centre: [number, number], size: number, res = 256) {
  terrain.updateMatrixWorld(true);
  const ray = new Raycaster(); (ray as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
  const o = new Vector3(), down = new Vector3(0, -1, 0);
  const minX = centre[0] - size / 2, maxZ = centre[1] + size / 2, step = size / res;
  const h = new Float32Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    ray.set(o.set(minX + (i + 0.5) * step, 200, maxZ - (j + 0.5) * step), down);
    h[j * res + i] = ray.intersectObject(terrain, false)[0]?.point.y ?? NaN;
  }
  // box blur (separable, two passes ≈ gaussian), radius ~1.2 m: ruts and hollows, not the broad curve of a valley
  const r = Math.max(1, Math.round(1.2 / step));
  const blur = (src: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(res * res);
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      let sum = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const x = horizontal ? i + k : i, y = horizontal ? j : j + k;
        if (x < 0 || y < 0 || x >= res || y >= res) continue;
        const v = src[y * res + x]; if (Number.isNaN(v)) continue; sum += v; n++;
      }
      out[j * res + i] = n ? sum / n : NaN;
    }
    return out;
  };
  let avg = blur(blur(h, true), false); avg = blur(blur(avg, true), false);
  const px = new Uint8Array(res * res * 4);
  let wet = 0;
  for (let k = 0; k < res * res; k++) {
    const d = Number.isNaN(h[k]) ? 0 : Math.max(0, avg[k] - h[k]);
    px[k * 4] = Math.min(255, Math.round((d / DEPTH_SCALE) * 255)); px[k * 4 + 3] = 255;
    if (d > 0.09) wet++;
  }
  const tex = new DataTexture(px, res, res, RGBAFormat, UnsignedByteType);
  tex.minFilter = tex.magFilter = LinearFilter; tex.needsUpdate = true;
  weather.puddleMap.value = tex;
  weather.puddleRect.value.set(minX, maxZ, size);
  return { coverage: wet / (res * res) };
}


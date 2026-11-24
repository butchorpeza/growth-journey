/* Wind for vegetation: a vertex-shader sway patched into a plant material (works with InstancedMesh).
   Bend grows with height above the plant's base (roots stay put, tips move most); every instance gets its own
   phase from its world position, and a slow gust envelope travels across the field, so plants don't move in
   lockstep. Two uniforms are shared by all plants: time and strength (0 with reduced motion).
   Shadows keep the rest pose (cheaper, and the difference is a few centimetres). */
import type { Material } from 'three';

export const wind = { time: { value: 0 }, strength: { value: 1 } };

export function applyWind(mat: Material) {
  if (mat.userData.wind) return;
  mat.userData.wind = true;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = wind.time;
    shader.uniforms.uWindStrength = wind.strength;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;\nuniform float uWindStrength;')
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 windBase = instanceMatrix[3].xyz;
#else
  vec3 windBase = vec3(0.0);
#endif
float windBend = max(position.y, 0.0) * 0.8 * uWindStrength;
float windPhase = uWindTime * 1.35 + windBase.x * 0.21 + windBase.z * 0.17;
float windGust = 0.5 + 0.5 * sin(uWindTime * 0.33 + windBase.x * 0.035 - windBase.z * 0.02);
vec2 windSway = vec2(sin(windPhase) + 0.35 * sin(windPhase * 2.7 + 1.3), 0.6 * cos(windPhase * 0.8)) * (0.03 + 0.06 * windGust);
transformed.xz += windSway * windBend;`);
  };
  mat.customProgramCacheKey = () => 'wind_v1';
  mat.needsUpdate = true;
}

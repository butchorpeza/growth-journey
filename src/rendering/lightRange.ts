/* Point lights only where they reach. three.js shades every point light at every lit pixel, including pixels far
   outside the light's range, where its attenuation is exactly zero: 15 point lights (streetlight pool, bulbs, house
   windows, the oil lamp, the portal) cost ~17 ms of a 40 ms frame at 1080p (measured), most of it multiplying by 0.
   This patch skips a light for a pixel that is beyond its cut-off distance, or when the light is off (colour 0,
   e.g. a pool light fading out). three's attenuation is pow2(saturate(1 - (d / cutoff)^4)), which is 0 for
   d >= cutoff, so the skipped lights added nothing: the image is identical. Installed once, before any material
   compiles (it patches the shared shader chunk). */
import { ShaderChunk } from 'three';

let installed = false;

export function installLightRange() {
  if (installed) return;
  installed = true;
  const src = ShaderChunk.lights_fragment_begin;
  const start = src.indexOf('#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )');
  const end = src.indexOf('#pragma unroll_loop_end', start);
  if (start < 0 || end < 0) { console.warn('lightRange: three.js light chunk changed; patch skipped'); return; }
  const block = src.slice(start, end);
  const info = 'getPointLightInfo( pointLight, geometryPosition, directLight );';
  const direct = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  if (!block.includes(info) || !block.includes(direct)) { console.warn('lightRange: three.js light chunk changed; patch skipped'); return; }
  const patched = block
    .replace(info, `if ( pointLight.color != vec3( 0.0 ) && ( pointLight.distance <= 0.0 || distance( pointLight.position, geometryPosition ) < pointLight.distance ) ) {\n\t\t${info}`)
    .replace(direct, `${direct}\n\t\t}`);
  const result = src.slice(0, start) + patched + src.slice(end);
  ShaderChunk.lights_fragment_begin = result;
  // `?debug`: window.__lightRange(false) restores three's original chunk for A/B tests (materials must recompile)
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
    (window as unknown as Record<string, unknown>).__lightRange = (on: boolean) => { ShaderChunk.lights_fragment_begin = on ? result : src; };
  }
}

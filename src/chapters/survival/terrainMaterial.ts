/* Four-layer terrain shader for Chapter 01: a MeshStandardMaterial (so it keeps PBR lighting, shadows, fog and the
   HDRI) whose colour, normal and roughness are blended from four ground layers by the splat weights that
   build_survival.py painted into the terrain's vertex colours:
     R = mud (the road and wet ruts) · G = laterite soil (trodden yards) · B = forest floor · remainder = grass
   Breaking up the look of a single repeated texture:
   - every layer is sampled twice (a second scale, rotated) and the two mixed by noise: no visible tiling
   - height blending: where layers meet, the one whose texture stands higher (lighter detail: grass tufts, stones)
     wins, so grass and mud interlock instead of fading through each other
   - the road: wet brown mud (Poly Haven brown_mud_02) in patches, two tyre ruts along its centreline (darker,
     wetter), and a stony verge of laterite at its shoulders
   - large damp / dry patches from low-frequency noise. */
import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Vector2, type Texture } from 'three';
import { SURVIVAL_PATH } from './path';

// the road's centreline: the scroll path from the sungka board to the end of the road (the yard part is not road)
const ROAD = SURVIVAL_PATH.slice(8).map((w) => new Vector2(w.at[0], w.at[1]));

const LAYERS = ['mud', 'soil', 'forest', 'grass'] as const;
const TILE = [0.42, 0.5, 0.45, 0.4];        // texture repeats per UV unit (terrain UV = world metres / 2)
const ROUGH = [0.58, 0.86, 0.9, 0.88];      // per-layer roughness (mud is wet and glossier)

export function terrainTextureUrls(base: string) {
  return [...LAYERS, 'wetmud'].flatMap((l) => [`${base}/${l}_diff.webp`, `${base}/${l}_nor.webp`]);
}

export function createTerrainMaterial(textures: Texture[]) {
  const diff = [...LAYERS, 'wetmud'].map((_, i) => textures[i * 2]);
  const nor = [...LAYERS, 'wetmud'].map((_, i) => textures[i * 2 + 1]);
  for (const t of [...diff, ...nor]) { t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true; }
  for (const t of diff) t.colorSpace = SRGBColorSpace;

  // map / normalMap are set so three.js declares the UV varyings and the tangent frame; the shader below
  // replaces how they are sampled
  const mat = new MeshStandardMaterial({ map: diff[0], normalMap: nor[0], vertexColors: true, roughness: 1, metalness: 0 });
  mat.name = 'terrain_splat';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tDiff1 = { value: diff[1] }; shader.uniforms.tDiff2 = { value: diff[2] }; shader.uniforms.tDiff3 = { value: diff[3] };
    shader.uniforms.tNor1 = { value: nor[1] }; shader.uniforms.tNor2 = { value: nor[2] }; shader.uniforms.tNor3 = { value: nor[3] };
    shader.uniforms.tWetD = { value: diff[4] }; shader.uniforms.tWetN = { value: nor[4] };
    shader.uniforms.uRoad = { value: ROAD };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tDiff1, tDiff2, tDiff3, tNor1, tNor2, tNor3, tWetD, tWetN;
uniform vec2 uRoad[${ROAD.length}];
varying vec3 vTerrainWorld;
vec4 splatW;
vec4 tW;                                     // splat weights after height blending (shading only)
float tAlt, tRut, tVerge, tWetMix;
vec2 tRot(vec2 p) { return mat2(0.4536, -0.8912, 0.8912, 0.4536) * p; }   // ~63°
// each layer twice: its scale and a second, rotated and larger, mixed by noise (no visible repeat)
vec3 tColor(sampler2D t, vec2 uv) { return mix(texture2D(t, uv).rgb, texture2D(t, tRot(uv) * 0.57 + 0.31).rgb, tAlt); }
vec3 tNormal(sampler2D t, vec2 uv) {
  vec3 a = texture2D(t, uv).xyz * 2.0 - 1.0, b = texture2D(t, tRot(uv) * 0.57 + 0.31).xyz * 2.0 - 1.0;
  b.xy = mat2(0.4536, 0.8912, -0.8912, 0.4536) * b.xy;    // turn the second sample's normal back with its UVs
  return mix(a, b, tAlt);
}
float roadDist(vec2 p) {
  float d = 1e4;
  for (int i = 0; i < ${ROAD.length - 1}; i++) {
    vec2 a = uRoad[i], ab = uRoad[i + 1] - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    d = min(d, length(p - a - ab * t));
  }
  return d;
}
float tNoise(vec2 p) {                       // value noise, cheap and smooth
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}`)
      // the splat weights read vColor, which three.js declares in color_pars_fragment (after common)
      .replace('#include <color_pars_fragment>', `#include <color_pars_fragment>
vec4 splatWeights() {
  vec3 c = clamp(vColor.rgb, 0.0, 1.0);
  // jitter the borders with two scales of noise, strongly: the weights are interpolated linearly across each terrain
  // triangle, so without this a crisp border would trace the triangle edges as a staircase
  float n = (tNoise(vTerrainWorld.xz * 0.35) - 0.5) * 0.6 + (tNoise(vTerrainWorld.xz * 1.45 + 7.7) - 0.5) * 0.4;
  c = clamp(c + n * 0.95 * (c * (1.0 - c)) * 4.0, 0.0, 1.0);
  vec4 w = vec4(c, max(0.0, 1.0 - c.r - c.g - c.b));
  return w / max(dot(w, vec4(1.0)), 1e-4);
}`)
      // colour: blend the four layers instead of multiplying by the vertex colour
      .replace('#include <map_fragment>', `
splatW = splatWeights();
vec2 tuv = vMapUv;
tAlt = smoothstep(0.3, 0.7, tNoise(vTerrainWorld.xz * 0.11 + 9.1));
vec3 g0 = tColor(map, tuv * ${TILE[0].toFixed(3)});
vec3 g1 = tColor(tDiff1, tuv * ${TILE[1].toFixed(3)});
vec3 g2 = tColor(tDiff2, tuv * ${TILE[2].toFixed(3)});
vec3 g3 = tColor(tDiff3, tuv * ${TILE[3].toFixed(3)});
// the road: wet brown mud in patches, tyre ruts along the centreline, stones at the shoulders
float rd = roadDist(vTerrainWorld.xz) + (tNoise(vTerrainWorld.xz * 0.7) - 0.5) * 0.25;
float onRoad = smoothstep(0.15, 0.5, splatW.x);
tRut = smoothstep(0.26, 0.08, abs(rd - 0.78)) * onRoad * (0.55 + 0.45 * tNoise(vTerrainWorld.xz * 1.9));
tVerge = smoothstep(1.5, 2.0, rd) * smoothstep(3.1, 2.3, rd) * smoothstep(0.42, 0.6, tNoise(vTerrainWorld.xz * 0.9 + 4.0));
tWetMix = clamp(smoothstep(0.45, 0.75, tNoise(vTerrainWorld.xz * 0.21 + 2.3)) * 0.8 + tRut, 0.0, 1.0) * onRoad;
vec3 gWet = tColor(tWetD, tuv * 0.5);
g0 = mix(g0, gWet * 0.85, tWetMix);
// the hills are 'forest floor' in the splat map: in this tropical setting most of it is overgrown, so the layer is
// mostly green grass with patches of leaf litter showing through
float overgrown = smoothstep(0.35, 0.65, tNoise(vTerrainWorld.xz * 0.08) * 0.7 + tNoise(vTerrainWorld.xz * 0.31) * 0.3);
// the grass scan is dry tan; grade it to living tropical green, keeping drier patches where the noise says so
float lush = smoothstep(0.25, 0.75, tNoise(vTerrainWorld.xz * 0.05 + 3.7));
vec3 green = g3 * mix(vec3(0.78, 0.92, 0.6), vec3(0.56, 0.96, 0.42), lush);
vec3 forestFloor = mix(g2, green, 0.6 + 0.35 * overgrown);
// height blend: each layer's own detail (lighter = higher: grass tufts, stones, ridges) decides who shows where they meet
vec4 sw = splatW; sw.y = max(sw.y, tVerge * 0.65);
vec4 hgt = vec4(dot(g0, vec3(0.33)), dot(g1, vec3(0.33)) + 0.08, dot(forestFloor, vec3(0.33)), dot(green, vec3(0.33)) + 0.05);
vec4 hb = sw * (0.35 + hgt);
float hm = max(max(hb.x, hb.y), max(hb.z, hb.w));
tW = max(hb - hm * 0.3, 0.0); tW /= max(dot(tW, vec4(1.0)), 1e-4);
vec3 ground = g0 * tW.x + g1 * tW.y + forestFloor * tW.z + green * tW.w;
float macro = tNoise(vTerrainWorld.xz * 0.045) * 0.6 + tNoise(vTerrainWorld.xz * 0.13) * 0.4;
ground *= mix(0.82, 1.08, macro);                                // large damp / dry patches
ground *= mix(1.0, 0.66, tRut);                                  // ruts: compacted, darker, wetter
diffuseColor.rgb *= ground;`)
      .replace('#include <color_fragment>', '')
      .replace('#include <roughnessmap_fragment>', `
float roughnessFactor = dot(tW, vec4(${ROUGH.map((r) => r.toFixed(2)).join(', ')}));
roughnessFactor = clamp(roughnessFactor - (1.0 - macro) * 0.08 * tW.x - tRut * 0.2 - tWetMix * 0.08, 0.3, 1.0);`)
      .replace('#include <normal_fragment_maps>', `
vec3 n0 = mix(tNormal(normalMap, vNormalMapUv * ${TILE[0].toFixed(3)}), tNormal(tWetN, vNormalMapUv * 0.5), tWetMix);
vec3 n1 = tNormal(tNor1, vNormalMapUv * ${TILE[1].toFixed(3)});
vec3 n2 = tNormal(tNor2, vNormalMapUv * ${TILE[2].toFixed(3)});
vec3 n3 = tNormal(tNor3, vNormalMapUv * ${TILE[3].toFixed(3)});
vec3 mapN = normalize(n0 * tW.x + n1 * tW.y + n2 * tW.z + n3 * tW.w);
mapN.xy *= normalScale;
normal = normalize(tbn * mapN);`);
  };
  mat.customProgramCacheKey = () => 'terrain_splat_v3';
  return mat;
}

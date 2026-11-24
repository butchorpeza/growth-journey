/* Four-layer terrain shader for Chapter 01: a MeshStandardMaterial (so it keeps PBR lighting, shadows, fog and the
   HDRI) whose colour, normal and roughness are blended from four ground layers by the splat weights that
   build_survival.py painted into the terrain's vertex colours:
     R = mud (the road and wet ruts) · G = laterite soil (trodden yards) · B = forest floor · remainder = grass
   A low-frequency world-space noise breaks up texture tiling and adds patches of damp / dry ground. */
import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

const LAYERS = ['mud', 'soil', 'forest', 'grass'] as const;
const TILE = [0.42, 0.5, 0.45, 0.4];        // texture repeats per UV unit (terrain UV = world metres / 2)
const ROUGH = [0.58, 0.86, 0.9, 0.88];      // per-layer roughness (mud is wet and glossier)

export function terrainTextureUrls(base: string) {
  return LAYERS.flatMap((l) => [`${base}/${l}_diff.webp`, `${base}/${l}_nor.webp`]);
}

export function createTerrainMaterial(textures: Texture[]) {
  const diff = LAYERS.map((_, i) => textures[i * 2]);
  const nor = LAYERS.map((_, i) => textures[i * 2 + 1]);
  for (const t of [...diff, ...nor]) { t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true; }
  for (const t of diff) t.colorSpace = SRGBColorSpace;

  // map / normalMap are set so three.js declares the UV varyings and the tangent frame; the shader below
  // replaces how they are sampled
  const mat = new MeshStandardMaterial({ map: diff[0], normalMap: nor[0], vertexColors: true, roughness: 1, metalness: 0 });
  mat.name = 'terrain_splat';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tDiff1 = { value: diff[1] }; shader.uniforms.tDiff2 = { value: diff[2] }; shader.uniforms.tDiff3 = { value: diff[3] };
    shader.uniforms.tNor1 = { value: nor[1] }; shader.uniforms.tNor2 = { value: nor[2] }; shader.uniforms.tNor3 = { value: nor[3] };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tDiff1, tDiff2, tDiff3, tNor1, tNor2, tNor3;
varying vec3 vTerrainWorld;
vec4 splatW;
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
  float n = tNoise(vTerrainWorld.xz * 0.35) - 0.5;               // jitter the borders so they aren't smooth gradients
  c = clamp(c + n * 0.35 * (c * (1.0 - c)) * 4.0, 0.0, 1.0);
  vec4 w = vec4(c, max(0.0, 1.0 - c.r - c.g - c.b));
  return w / max(dot(w, vec4(1.0)), 1e-4);
}`)
      // colour: blend the four layers instead of multiplying by the vertex colour
      .replace('#include <map_fragment>', `
splatW = splatWeights();
vec2 tuv = vMapUv;
vec3 g0 = texture2D(map, tuv * ${TILE[0].toFixed(3)}).rgb;
vec3 g1 = texture2D(tDiff1, tuv * ${TILE[1].toFixed(3)}).rgb;
vec3 g2 = texture2D(tDiff2, tuv * ${TILE[2].toFixed(3)}).rgb;
vec3 g3 = texture2D(tDiff3, tuv * ${TILE[3].toFixed(3)}).rgb;
vec3 ground = g0 * splatW.x + g1 * splatW.y + g2 * splatW.z + g3 * splatW.w;
float macro = tNoise(vTerrainWorld.xz * 0.045) * 0.6 + tNoise(vTerrainWorld.xz * 0.13) * 0.4;
ground *= mix(0.82, 1.08, macro);                                // large damp / dry patches hide the tiling
diffuseColor.rgb *= ground;`)
      .replace('#include <color_fragment>', '')
      .replace('#include <roughnessmap_fragment>', `
float roughnessFactor = dot(splatW, vec4(${ROUGH.map((r) => r.toFixed(2)).join(', ')}));
roughnessFactor = clamp(roughnessFactor - (1.0 - macro) * 0.08 * splatW.x, 0.3, 1.0);`)
      .replace('#include <normal_fragment_maps>', `
vec3 n0 = texture2D(normalMap, vNormalMapUv * ${TILE[0].toFixed(3)}).xyz * 2.0 - 1.0;
vec3 n1 = texture2D(tNor1, vNormalMapUv * ${TILE[1].toFixed(3)}).xyz * 2.0 - 1.0;
vec3 n2 = texture2D(tNor2, vNormalMapUv * ${TILE[2].toFixed(3)}).xyz * 2.0 - 1.0;
vec3 n3 = texture2D(tNor3, vNormalMapUv * ${TILE[3].toFixed(3)}).xyz * 2.0 - 1.0;
vec3 mapN = normalize(n0 * splatW.x + n1 * splatW.y + n2 * splatW.z + n3 * splatW.w);
mapN.xy *= normalScale;
normal = normalize(tbn * mapN);`);
  };
  mat.customProgramCacheKey = () => 'terrain_splat_v1';
  return mat;
}

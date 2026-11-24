/* Dissolve between level-of-detail versions of an instanced plant (the full model near the visitor, an impostor card
   beyond), so nothing pops when the visitor walks. Each instance carries a fade value `aFade` (1 = fully the near
   model). In the transition band both versions are drawn with complementary screen-door dithering: the near model
   keeps the pixels whose dither value is below the fade, the card keeps the rest, so together they always cover the
   plant once and the swap reads as a soft dissolve over a few metres instead of a jump. */
import { BufferGeometry, InstancedBufferAttribute, type Material } from 'three';

/** patch a material: 'in' for the near model (shown where dither < fade), 'out' for the card (shown where ≥) */
export function applyFade(mat: Material, mode: 'in' | 'out') {
  if (mat.userData.fade) return;
  mat.userData.fade = mode;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFade;\nvarying float vFade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  {
    // interleaved gradient noise: a fine, even dither that doesn't form visible patterns
    float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (${mode === 'in' ? 'ign >= vFade' : 'ign < vFade'}) discard;
  }`);
  };
  mat.customProgramCacheKey = () => `${prevKey()}|fade_${mode}`;
  mat.needsUpdate = true;
}

/** a geometry sharing `src`'s buffers, plus a per-instance fade attribute for `count` instances */
export function withFade(src: BufferGeometry, count: number) {
  const g = new BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) g.setAttribute(name, attr);
  g.setIndex(src.index);
  for (const grp of src.groups) g.addGroup(grp.start, grp.count, grp.materialIndex);
  const fade = new InstancedBufferAttribute(new Float32Array(count), 1);
  g.setAttribute('aFade', fade);
  return { geometry: g, fade };
}

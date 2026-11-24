/* The tropical forest mix of Chapter 01, placed by scatter.ts. Each species is one instanced Field (Bananas.tsx):
   the real model within a few metres of the visitor, impostor cards beyond, so thousands of plants cost little.
   - coconut palm "Coconut Palm" by evolveduk · mango "Mango Tree" by stealth86 · bamboo "Free Bamboo Set" by
     JonhGillessen · taro "Taro" by The_Structure_World · elephant ear "Elephant Ear Plant" by BAND_ANNA
     (Sketchfab, CC-BY 4.0) · fern fern_02 and the rain tree island_tree_02 (Poly Haven, CC0). Credited in CREDITS.md.
   Base scales bring each model to its real size (a coconut palm ~11 m, mango ~9 m, rain tree ~14 m tall and 17 m
   across); the heavy hero trees (mango 88k, rain tree 184k triangles) are 3D only close by. */
import { useGLTF } from '@react-three/drei';
import { Field } from './Bananas';
import { SURVIVAL_BASE } from './layout';
import type { FloraKind, Inst } from './scatter';

const SPECIES: Record<FloraKind, { near: number; baseScale: number }> = {
  coconut: { near: 30, baseScale: 1.8 },
  mango: { near: 18, baseScale: 1.35 },
  raintree: { near: 22, baseScale: 4.0 },
  bamboo: { near: 24, baseScale: 1.0 },
  taro: { near: 14, baseScale: 0.5 },
  elephant: { near: 14, baseScale: 0.85 },
  fern: { near: 14, baseScale: 1.6 },
};

// start loading every species as soon as the chapter's code loads (not during a render, which makes the loading
// tracker update another component mid-render)
for (const k of Object.keys(SPECIES)) useGLTF.preload(`${SURVIVAL_BASE}/flora/${k}.glb`, false, true);

export function Flora({ flora, quality }: { flora: Record<FloraKind, Inst[]>; quality: 'high' | 'medium' | 'low' }) {
  return (
    <>
      {(Object.keys(SPECIES) as FloraKind[]).map((k) => {
        const list = quality === 'low' && (k === 'taro' || k === 'elephant' || k === 'fern') ? flora[k].filter((_, i) => i % 2 === 0) : flora[k];
        return list.length ? <Field key={k} url={`${SURVIVAL_BASE}/flora/${k}.glb`} instances={list} near={SPECIES[k].near * (quality === 'low' ? 0.6 : 1)} baseScale={SPECIES[k].baseScale} /> : null;
      })}
    </>
  );
}

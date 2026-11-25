/* Chapter 02's shared surfaces and models.
   Textures: Poly Haven (CC0), 1K, converted to WebP (public/models/shadows/tex): decrepit wallpaper, dark wooden
   planks, damaged plaster, castle brick, grey roof tiles, mossy cobblestone. Each set is colour + OpenGL normal +
   roughness (or an ARM map: AO / roughness / metalness in R / G / B, of which three.js reads G and B).
   Models: Poly Haven (CC0) furniture and props, optimised to GLB (meshopt, WebP), in public/models/shadows/props.
   `boxUV` gives a box texture coordinates in metres, so a wall's wallpaper keeps its scale whatever its size. */
import { useGLTF } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { useMemo } from 'react';
import { BoxGeometry, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2, type Object3D, type Texture } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const SHADOWS_BASE = `${import.meta.env.BASE_URL}models/shadows`;
const SETS = ['decrepit_wallpaper', 'dark_wooden_planks', 'damaged_plaster', 'castle_brick_07', 'grey_roof_tiles_02', 'mossy_cobblestone'] as const;
const THIRD: Record<(typeof SETS)[number], 'arm' | 'rough'> = {
  decrepit_wallpaper: 'arm', dark_wooden_planks: 'arm', damaged_plaster: 'arm', castle_brick_07: 'rough', grey_roof_tiles_02: 'rough', mossy_cobblestone: 'arm',
};
export const texUrls = SETS.flatMap((s) => [`${SHADOWS_BASE}/tex/${s}_diff.webp`, `${SHADOWS_BASE}/tex/${s}_nor.webp`, `${SHADOWS_BASE}/tex/${s}_${THIRD[s]}.webp`]);

/** UVs in metres (one texture tile = `tile` m) on a BoxGeometry's six faces */
export function boxUV(w: number, h: number, d: number, tile = 1.5) {
  const g = new BoxGeometry(w, h, d), uv = g.attributes.uv;
  const faces: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  faces.forEach(([fu, fv], f) => { for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * fu / tile, uv.getY(k) * fv / tile); } });
  return g;
}

function prep(t: Texture, srgb: boolean) { const c = t.clone(); c.wrapS = c.wrapT = RepeatWrapping; c.anisotropy = 8; if (srgb) c.colorSpace = SRGBColorSpace; c.needsUpdate = true; return c; }

export function useShadowsMaterials() {
  const t = useLoader(TextureLoader, texUrls);
  return useMemo(() => {
    const set = (i: number, color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}, normal = 1) => {
      const [d, n, r] = [t[i * 3], t[i * 3 + 1], t[i * 3 + 2]];
      const arm = THIRD[SETS[i]] === 'arm';
      return new MeshStandardMaterial({
        map: prep(d, true), normalMap: prep(n, false), normalScale: new Vector2(normal, normal),
        roughnessMap: prep(r, false), ...(arm ? { metalnessMap: prep(r, false), metalness: 1 } : { metalness: 0 }),
        roughness: 1, color: new Color(color), ...extra,
      });
    };
    return {
      wallpaper: set(0, '#8d8a86'),
      planks: set(1, '#7a6f66'),
      plaster: set(2, '#8a8780'),
      brick: set(3, '#6d6a66', {}, 1.3),
      roofTiles: set(4, '#55595e', {}, 1.2),
      cobble: set(5, '#77796f', {}, 1.2),
      cloth: new MeshStandardMaterial({ color: new Color('#5f5b55'), roughness: 1 }),
      soot: new MeshStandardMaterial({ color: new Color('#060606'), roughness: 1 }),
      darkWood: new MeshStandardMaterial({ color: new Color('#2a221c'), roughness: 0.8 }),
    };
  }, [t]);
}
export type ShadowsMats = ReturnType<typeof useShadowsMaterials>;

export const PROPS = [
  'ArmChair_01', 'Chandelier_01', 'ClassicConsole_01', 'GothicBed_01', 'GothicCabinet_01', 'GothicCommode_01', 'Lantern_01',
  'Rockingchair_01', 'Sofa_01', 'Television_01', 'antique_ceramic_vase_01', 'fancy_picture_frame_01', 'gothic_statue', 'large_castle_door',
  'marble_bust_01', 'ornate_mirror_01', 'outdoor_table_chair_set_01', 'painted_wooden_bench', 'vintage_grandfather_clock_01',
  'vintage_suitcase', 'wooden_bookshelf_worn',
] as const;
export type PropName = (typeof PROPS)[number];
export const propUrl = (n: PropName) => `${SHADOWS_BASE}/props/${n}.glb`;
export const CREATURE_URL = `${SHADOWS_BASE}/creature/rake.glb`;

/** a fresh copy of a prop (shadows cast and received), darkened and desaturated a little so the furniture belongs
 *  to a house that has stood empty for years: `age` 0 (as modelled) … 1 (very dusty) */
export function useProp(n: PropName, age = 0.35): Object3D {
  const { scene } = useGLTF(propUrl(n));
  return useMemo(() => {
    const o = clone(scene);
    o.traverse((c) => {
      const m = c as unknown as { isMesh?: boolean; material?: MeshStandardMaterial; castShadow: boolean; receiveShadow: boolean };
      if (!m.isMesh || !m.material) return;
      m.castShadow = true; m.receiveShadow = true;
      const mat = m.material.clone();
      if (mat.color) mat.color.lerp(new Color('#6f6a63'), age * 0.5).multiplyScalar(1 - age * 0.35);
      mat.roughness = Math.min(1, (mat.roughness ?? 0.6) + age * 0.25);
      m.material = mat;
    });
    return o;
  }, [scene, age]);
}

export function preloadShadows() { for (const p of PROPS) useGLTF.preload(propUrl(p)); useGLTF.preload(CREATURE_URL); }

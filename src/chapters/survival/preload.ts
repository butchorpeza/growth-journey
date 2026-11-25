/* Asset streaming for Chapter 01: request every file the chapter needs at once, as soon as its code loads.
   Each component loads its assets with Suspense, and a component that suspends hides the ones after it: the
   village used to load as a chain of ~11 waits (layout → world → ground textures → house textures → shop → iron
   house → wooden house → motorcycle → portal → foliage → bananas → animals → photos), each step only starting
   once the one before had downloaded and parsed. Started together, the downloads share the connection and the
   parsing overlaps them; the components then find their files already in the loader caches (same loaders, same
   URLs and options, so the cache keys match). Nothing else changes: the same loading screen, the same scene. */
import { useGLTF } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { FileLoader, TextureLoader } from 'three';
import { wallPhotos } from '../../data/photos';
import { getGame } from '../../game/GameState';
import { houseTextureUrls } from './houseA';
import { SURVIVAL_BASE } from './layout';
import { terrainTextureUrls } from './terrainMaterial';

let started = false;
export function preloadSurvival() {
  if (started || getGame().chapter !== 'survival') return;
  started = true;
  // the world first: the largest file, and everything else is placed on its terrain
  useLoader.preload(FileLoader, `${SURVIVAL_BASE}/layout.json`);
  const glb = (f: string) => useGLTF.preload(`${SURVIVAL_BASE}/${f}`, false, true);
  glb('world.glb');
  useLoader.preload(TextureLoader, terrainTextureUrls(`${SURVIVAL_BASE}/ground`));
  useLoader.preload(TextureLoader, houseTextureUrls(SURVIVAL_BASE));
  for (const f of ['houses/shop.glb', 'houses/iron.glb', 'houses/wooden.glb', 'vehicles/motorbike.glb', 'vehicles/portal_frame.glb',
    'foliage.glb', 'banana.glb', 'banana_lod.glb', 'animals/dog.glb', 'animals/cat.glb']) glb(f);
  useLoader.preload(TextureLoader, wallPhotos().map((p) => p.src));
  useLoader.preload(TextureLoader, [`${SURVIVAL_BASE}/housea/timber_diff.webp`, `${SURVIVAL_BASE}/housea/timber_nor.webp`]);
}

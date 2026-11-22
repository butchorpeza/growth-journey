/* Mounts only the chapter worlds the visitor can see: the current one and its neighbour (for the flight).
   Each world is code-split (React.lazy) so its code and assets load when the visitor gets close, never all at once.
   Unmounted worlds are removed from the scene graph and R3F disposes their geometries and materials. */
import { useFrame } from '@react-three/fiber';
import { lazy, Suspense, useState, type ComponentType, type LazyExoticComponent } from 'react';
import { chapters, CHAPTER_COUNT, type Chapter } from '../data/chapters';
import { progress } from '../state/journey';

export interface SceneProps { chapter: Chapter; quality: 'high' | 'low' }

const SCENES: Record<Chapter['id'], LazyExoticComponent<ComponentType<SceneProps>>> = {
  beginning: lazy(() => import('../scenes/BeginningScene')),
  discovery: lazy(() => import('../scenes/DiscoveryScene')),
  system: lazy(() => import('../scenes/SystemScene')),
  results: lazy(() => import('../scenes/ResultsScene')),
  frontier: lazy(() => import('../scenes/FrontierScene')),
};

const visibleSet = (p: number) => {
  const i = Math.floor(p), t = p - i;
  const out = [i];
  if (t > 0.55 && i + 1 < CHAPTER_COUNT) out.push(i + 1);   // start loading the next world while reading this one
  if (t < 0.1 && i > 0) out.push(i - 1);                      // keep the previous one briefly when scrolling back
  return out.sort().join(',');
};

export function SceneManager({ quality }: { quality: 'high' | 'low' }) {
  const [key, setKey] = useState(() => visibleSet(progress.value));
  useFrame(() => { const k = visibleSet(progress.value); if (k !== key) setKey(k); });
  const active = key.split(',').map(Number);
  return (
    <>
      {active.map((i) => {
        const c = chapters[i], Scene = SCENES[c.id];
        return (
          <group key={c.id} position={c.anchor}>
            <Suspense fallback={null}>
              <Scene chapter={c} quality={quality} />
            </Suspense>
          </group>
        );
      })}
    </>
  );
}

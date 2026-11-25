/* Trees across the island, the same real models as Chapter 01's forest (instanced with impostor cards beyond a few
   metres, Bananas.tsx Field): great spreading rain trees and mango trees standing dark against the overcast, ferns
   under them, around the edges of the meadow, between the courtyard and the cliffs and behind the house, never on the
   avenue, the courtyard, the house or the gate line. With the bare dead trees by the gate they make the island a
   wood rather than a lawn. */
import { useMemo } from 'react';
import { Field } from '../survival/Bananas';
import { SURVIVAL_BASE } from '../survival/layout';
import type { Inst } from '../survival/scatter';
import { rng } from './Estate';
import { FOUNTAIN, GATE, TREES, avenueDistance, groundHeight, islandRn } from './layout';

function scatter(seed: number, n: number, minGap: number, ok: (x: number, z: number) => boolean, scale: [number, number], taken: [number, number, number][]) {
  const r = rng(seed), out: Inst[] = [];
  let tries = 0;
  while (out.length < n && tries++ < n * 60) {
    const x = (r() - 0.5) * 84, z = -82 + r() * 134;
    if (!ok(x, z)) continue;
    if (taken.some(([tx, tz, g]) => Math.hypot(tx - x, tz - z) < Math.max(g, minGap))) continue;
    const s = scale[0] + r() * (scale[1] - scale[0]);
    out.push([x, groundHeight(x, z) - 0.05, z, r() * Math.PI * 2, s]);
    taken.push([x, z, minGap]);
  }
  return out;
}

export function Grove({ half }: { half: boolean }) {
  const { rain, mango, fern } = useMemo(() => {
    const clear = (x: number, z: number, margin: number) => {
      if (islandRn(x, z) > 0.9) return false;                              // not at the cliff tops
      if (avenueDistance(x, z) < 4 + margin) return false;                 // the avenue
      if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < FOUNTAIN.paved + 2 + margin) return false;
      if (z < -46 && z > -80 && Math.abs(x) < 30 + margin) return false;    // the house and its terrace
      if (Math.abs(z - GATE.z) < 2.5 + margin && Math.abs(x) < 30) return false;   // the wall line
      if (z > 30 && Math.abs(x) < 8) return false;                         // the opening's view to the gate
      return true;
    };
    const taken: [number, number, number][] = TREES.map(([x, z]) => [x, z, 6]);
    const rain = scatter(41, half ? 14 : 22, 11, (x, z) => clear(x, z, 3), [0.55, 0.85], taken);
    const mango = scatter(53, half ? 14 : 24, 7, (x, z) => clear(x, z, 1.5), [0.8, 1.15], taken);
    const fern = scatter(67, half ? 120 : 240, 1.2, (x, z) => clear(x, z, 0), [0.6, 1.2], []);
    return { rain, mango, fern };
  }, [half]);
  return (
    <>
      <Field url={`${SURVIVAL_BASE}/flora/raintree.glb`} instances={rain} near={22} baseScale={4.0} />
      <Field url={`${SURVIVAL_BASE}/flora/mango.glb`} instances={mango} near={18} baseScale={1.35} />
      <Field url={`${SURVIVAL_BASE}/flora/fern.glb`} instances={fern} near={14} baseScale={1.6} />
    </>
  );
}

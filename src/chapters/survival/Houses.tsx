/* Detailed houses for Chapter 01 by yadrogames (Sketchfab, CC-BY 4.0, credited in CREDITS.md): a weathered timber
   shop house where the box-modelled house C stood, an iron shanty where house B stood, and a stacked wooden shanty
   by the road. Each is set on the terrain at its lowest corner (never floating), gets a box collider from its real
   bounds, and its footprint is passed to the scatter so bananas and grass keep clear of it. */
import { useGLTF } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useMemo } from 'react';
import { Box3, Euler, Group, Quaternion, Raycaster, Vector3, type Mesh, type Object3D } from 'three';
import { GROUPS } from '../../physics/CollisionLayers';
import { applyWeather } from '../../rendering/weather';
import { SURVIVAL_BASE, type SurvivalLayout } from './layout';

interface Placement { model: 'shop' | 'iron' | 'wooden'; at: [number, number]; yaw: number; scale: number; sink?: number }

export const HOUSE_PLACEMENTS: Placement[] = [
  // sizes chosen to read as real village houses (≈ 8 × 10 m, one to two storeys), clear of house A's yard, the
  // fences, the path and the rocks (checked against the layout colliders)
  { model: 'shop', at: [16.0, 13.0], yaw: Math.PI / 2, scale: 0.38 },     // replaces house C (sign side faces away from the path)
  { model: 'iron', at: [-14.6, 12.4], yaw: Math.PI / 2, scale: 0.5, sink: 0.32 },     // replaces house B (its steps and posts reach 0.24 m below the walls)
  { model: 'wooden', at: [9.0, 40.0], yaw: Math.PI / 2, scale: 0.4, sink: 0.28 },     // by the road, facing it (posts 0.19 m below the walls)
];

export interface PlacedHouse { object: Group; box: SurvivalLayout['colliders'][number] }

/** height of the terrain under (x, z), by a BVH ray straight down */
export function terrainHeight(terrain: Mesh | null) {
  const ray = new Raycaster(); (ray as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
  const origin = new Vector3(), down = new Vector3(0, -1, 0);
  return (x: number, z: number) => {
    if (!terrain) return 0;
    ray.set(origin.set(x, 200, z), down);
    return ray.intersectObject(terrain, false)[0]?.point.y ?? 0;
  };
}

/** clone a model, scale it (by `scale`, or to a real-world `length` along its longest side, which is turned to run
 *  along local z so `yaw` is its heading), centre it on its footprint, sit it on the terrain at the lowest of its
 *  four footprint corners (never floating) and measure a box collider from its real bounds */
export function placeModel(src: Object3D, pl: { at: [number, number]; yaw: number; scale?: number; length?: number; sink?: number }, groundAt: (x: number, z: number) => number, name: string, kind = 'prop'): PlacedHouse {
  const object = new Group();
  object.name = name;
  const turn = new Group();                     // turns the model so its length runs along z
  const inner = src.clone(true);
  turn.add(inner); object.add(turn);
  inner.traverse((o: Object3D) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => applyWeather(mm));
  });
  // precise bounds (every vertex): the fast box of quantized meshes is the transformed box of the quantized box,
  // which can sit a metre below the real geometry and leave a house floating
  let local = new Box3().setFromObject(inner, true);
  let raw = local.getSize(new Vector3());
  if (pl.length && raw.x > raw.z) { turn.rotation.y = Math.PI / 2; turn.updateMatrixWorld(true); local = new Box3().setFromObject(turn, true); raw = local.getSize(new Vector3()); }
  const scale = pl.scale ?? (pl.length ? pl.length / Math.max(raw.x, raw.z) : 1);
  const size = raw.clone().multiplyScalar(scale), centre = local.getCenter(new Vector3()).multiplyScalar(scale);
  turn.scale.setScalar(scale);
  turn.position.set(-centre.x, -local.min.y * scale, -centre.z);
  const q = new Quaternion().setFromEuler(new Euler(0, pl.yaw, 0));
  const corner = (sx: number, sz: number) => new Vector3(sx * size.x / 2, 0, sz * size.z / 2).applyQuaternion(q);
  const ys = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => { const c = corner(sx, sz); return groundAt(pl.at[0] + c.x, pl.at[1] + c.z); });
  const y = Math.min(...ys, groundAt(pl.at[0], pl.at[1])) - (pl.sink ?? 0.08);
  object.position.set(pl.at[0], y, pl.at[1]);
  object.quaternion.copy(q);
  object.updateMatrixWorld(true);
  return { object, box: { p: [pl.at[0], y + size.y / 2, pl.at[1]], q: [q.x, q.y, q.z, q.w], h: [size.x / 2 - 0.05, size.y / 2, size.z / 2 - 0.05], k: kind } as PlacedHouse['box'] };
}

/** load, place and measure the houses (sync: the GLBs suspend through useGLTF) */
export function usePlacedHouses(terrain: Mesh | null): PlacedHouse[] {
  const shop = useGLTF(`${SURVIVAL_BASE}/houses/shop.glb`, false, true).scene;
  const iron = useGLTF(`${SURVIVAL_BASE}/houses/iron.glb`, false, true).scene;
  const wooden = useGLTF(`${SURVIVAL_BASE}/houses/wooden.glb`, false, true).scene;
  return useMemo(() => {
    const models = { shop, iron, wooden };
    const groundAt = terrainHeight(terrain);
    return HOUSE_PLACEMENTS.map((pl) => placeModel(models[pl.model], pl, groundAt, `house:${pl.model}`, 'house'));
  }, [shop, iron, wooden, terrain]);
}

export function Houses({ houses }: { houses: PlacedHouse[] }) {
  return (
    <>
      {houses.map((h, i) => <primitive key={i} object={h.object} />)}
      <RigidBody type="fixed" colliders={false} collisionGroups={GROUPS.environment}>
        {houses.map((h, i) => <CuboidCollider key={i} args={h.box.h} position={h.box.p} quaternion={h.box.q} collisionGroups={GROUPS.environment} />)}
      </RigidBody>
    </>
  );
}


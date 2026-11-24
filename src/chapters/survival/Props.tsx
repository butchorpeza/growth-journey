/* Lived-in details for Chapter 01:
   - vehicles parked around the village, from Sketchfab (CC-BY 4.0, credited in CREDITS.md): a Filipino tricycle
     (kotris666), a rusty motorbike (cansuaydin) and a jeepney (maclinmacalindong). Full detail (they are seen up
     close), sat on the terrain, with box colliders; their footprints go to the scatter so plants keep clear.
   - a light in every house, so none of them reads as empty at night: a warm, flickering lamp inside (seen through
     the windows and the door, spilling onto the ground around the walls) and a bare bulb over the side that faces
     the path. On Low only the porch bulbs are lit (each point light costs every lit pixel). */
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import { Color, MeshBasicMaterial, Quaternion, Vector3, type Mesh, type PointLight } from 'three';
import type { Settings } from '../../game/GameState';

type QualityTier = Settings['quality'];
import { GROUPS } from '../../physics/CollisionLayers';
import { placeModel, terrainHeight, type PlacedHouse } from './Houses';
import { SURVIVAL_BASE } from './layout';
import { SURVIVAL_PATH } from './path';

type VehicleModel = 'tricycle' | 'motorbike' | 'jeepney';
interface VehiclePlacement { model: VehicleModel; at: [number, number]; yaw: number; length: number }

// parked off the walk, along the road and in front of the houses (yaw = heading of the vehicle's length)
export const VEHICLE_PLACEMENTS: VehiclePlacement[] = [
  { model: 'jeepney', at: [18.2, 26.6], yaw: 0.9, length: 6.6 },        // on the road's shoulder past the sungka
  { model: 'tricycle', at: [25.2, 36.9], yaw: 0.64 + Math.PI, length: 2.5 }, // waiting by the road, past the first pole
  { model: 'motorbike', at: [7.4, 28.6], yaw: 2.3, length: 2.05 },       // left by the sungka shelter
];

export function usePlacedVehicles(terrain: Mesh | null): PlacedHouse[] {
  const tricycle = useGLTF(`${SURVIVAL_BASE}/vehicles/tricycle.glb`, false, true).scene;
  const motorbike = useGLTF(`${SURVIVAL_BASE}/vehicles/motorbike.glb`, false, true).scene;
  const jeepney = useGLTF(`${SURVIVAL_BASE}/vehicles/jeepney.glb`, false, true).scene;
  return useMemo(() => {
    const models = { tricycle, motorbike, jeepney }, groundAt = terrainHeight(terrain);
    return VEHICLE_PLACEMENTS.map((pl) => placeModel(models[pl.model], { ...pl, sink: 0.03 }, groundAt, `vehicle:${pl.model}`, 'vehicle'));
  }, [tricycle, motorbike, jeepney, terrain]);
}

export function Vehicles({ vehicles }: { vehicles: PlacedHouse[] }) {
  return (
    <>
      {vehicles.map((v, i) => <primitive key={i} object={v.object} />)}
      <RigidBody type="fixed" colliders={false} collisionGroups={GROUPS.environment}>
        {vehicles.map((v, i) => <CuboidCollider key={i} args={v.box.h} position={v.box.p} quaternion={v.box.q} collisionGroups={GROUPS.environment} />)}
      </RigidBody>
    </>
  );
}

const BULB = new MeshBasicMaterial({ color: new Color('#ffb46a').multiplyScalar(30), toneMapped: false, fog: false });

/** where each house's lights go: the lamp at the middle of the floor, the bulb outside the wall facing the path */
function lightsFor(house: PlacedHouse) {
  const [x, y, z] = house.box.p, [hx, hy, hz] = house.box.h;
  const floor = y - hy;
  // the nearest point of the walk decides which wall is the front
  let best: [number, number] = [x, z], bd = Infinity;
  for (const w of SURVIVAL_PATH) { const d = Math.hypot(w.at[0] - x, w.at[1] - z); if (d < bd) { bd = d; best = w.at; } }
  const q = new Quaternion(...house.box.q), inv = q.clone().invert();
  const toPath = new Vector3(best[0] - x, 0, best[1] - z).applyQuaternion(inv);       // in the house's own frame
  const front = Math.abs(toPath.x) / hx > Math.abs(toPath.z) / hz
    ? new Vector3(Math.sign(toPath.x) * (hx + 0.35), 0, 0)
    : new Vector3(0, 0, Math.sign(toPath.z) * (hz + 0.35));
  front.applyQuaternion(q);
  const porchY = floor + Math.min(2.6, hy * 2 - 0.5);
  return {
    lamp: [x, floor + Math.min(1.7, hy), z] as [number, number, number],
    porch: [x + front.x, porchY, z + front.z] as [number, number, number],
    reach: Math.max(hx, hz) + 2.5,
  };
}

export function HouseLights({ houses, strength, quality }: { houses: PlacedHouse[]; strength: number; quality: QualityTier }) {
  const spots = useMemo(() => houses.map(lightsFor), [houses]);
  return (
    <>
      {spots.map((s, i) => (
        <group key={i}>
          {quality !== 'low' && <FlickerLamp p={s.lamp} intensity={9 * strength} distance={s.reach} />}
          <group position={s.porch}>
            <pointLight color="#ffb06a" intensity={11 * strength} distance={11} decay={2} />
            <mesh material={BULB} raycast={() => {}}><sphereGeometry args={[0.07, 12, 8]} /></mesh>
          </group>
        </group>
      ))}
    </>
  );
}

/** a kerosene lamp indoors: warm, with a slow, irregular flicker (each house a different phase) */
function FlickerLamp({ p, intensity, distance }: { p: [number, number, number]; intensity: number; distance: number }) {
  const ref = useRef<PointLight>(null);
  const phase = useMemo(() => p[0] * 1.7 + p[2] * 0.3, [p]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    if (ref.current) ref.current.intensity = intensity * (0.88 + 0.07 * Math.sin(t * 6.9) + 0.05 * Math.sin(t * 12.7 + 1.1) + 0.03 * Math.sin(t * 1.9));
  });
  return <pointLight ref={ref} position={p} color="#ff9e52" intensity={intensity} distance={distance} decay={2} />;
}

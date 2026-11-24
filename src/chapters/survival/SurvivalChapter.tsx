/* CHAPTER 01 · SURVIVAL — a rural settlement on an overcast day.
   Built in Blender from CC0 Poly Haven scans by scripts/blender/build_survival.py, optimised for the web by
   scripts/optimize-survival.mjs. This component turns the exported data into a playable space:
   - world.glb (houses, yards, props, poles, terrain), terrain re-shaded with the four-layer splat material
   - collision: the terrain as a triangle mesh + 161 simplified boxes from layout.json (render meshes are never used)
   - the front door of house A on its hinge (E opens / closes it; its collider swings with it)
   - interactable objects (oil lamp, old photograph, sungka board) through invisible hit volumes
   - the oil lamp's warm light and the road out of the village (chapter exit). Sky, sun, fog and the colour
     grade come from the chapter's Look (rendering/looks.ts). */
import { useGLTF } from '@react-three/drei';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { CuboidCollider, RigidBody, TrimeshCollider, type RapierRigidBody } from '@react-three/rapier';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BufferAttribute, FileLoader, Group, type PointLight, Matrix4, MeshBasicMaterial, Quaternion, TextureLoader, Vector3, type Mesh, type Object3D, type Texture } from 'three';
import { useGame } from '../../game/GameState';
import { Interactable } from '../../interactions/Interactable';
import { GROUPS } from '../../physics/CollisionLayers';
import { buildBoundsTrees } from '../../rendering/bvh';
import { lookFor } from '../../rendering/looks';
import { Rain } from '../../rendering/Rain';
import { applyWeather, buildPuddleMap, buildShelterMap, weather } from '../../rendering/weather';
import { playerState } from '../../player/playerState';
import { rail } from '../../player/rail';
import { audio } from '../../audio/AudioEngine';
import { Foliage } from './Foliage';
import { SURVIVAL_BASE, type SurvivalLayout } from './layout';
import { Bananas } from './Bananas';
import { Flora } from './Flora';
import { Animals } from './Animals';
import { Streetlights } from './Streetlights';
import { Trail } from './Trail';
import { Discoveries, LampGlow, lampBoost, lampFx, nowS, openDiscovery } from './Discoveries';
import { Houses, usePlacedHouses } from './Houses';
import { buildHouseA, buildHouseADoor, createHouseMaterials, houseTextureUrls } from './houseA';
import { Portal, usePortalFrame } from './Portal';
import { HouseLights, usePlacedVehicles, Vehicles } from './Props';
import { scatter } from './scatter';
import { createTerrainMaterial, terrainTextureUrls } from './terrainMaterial';

/** hit volume for the interaction raycast: never drawn, but still hit by rays */
const HIT = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });

interface Prepared { terrain: Mesh | null; door: Group | null; verts: Float32Array; index: Uint32Array }

/** one-time preparation of the cached GLTF scene (idempotent: the result is stored on the scene) */
function prepare(world: Object3D, layout: SurvivalLayout, terrainMat: Mesh['material'], houseTex: Texture[]): Prepared {
  if (world.userData.prepared) return world.userData.prepared as Prepared;
  world.updateMatrixWorld(true);
  let terrain: Mesh | null = null;
  const doorParts: Object3D[] = [];
  world.traverse((o) => {
    const m = o as Mesh;
    if (o.name.startsWith('A_door')) doorParts.push(o);
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
    if (o.name === 'terrain') terrain = m;
  });

  // terrain: splat material + collision triangles in world space
  let verts = new Float32Array(), index = new Uint32Array();
  const t = terrain as Mesh | null;
  if (t) {
    t.material = terrainMat; t.castShadow = false;
    const pos = t.geometry.getAttribute('position'), v = new Vector3();
    // terrain UVs are planar (1 unit = 2 m, as build_survival.py made them); rebuilt here because the web
    // optimiser drops UVs from a material without textures
    if (!t.geometry.getAttribute('uv')) {
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(t.matrixWorld); uv[i * 2] = v.x / 2; uv[i * 2 + 1] = -v.z / 2; }
      t.geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    }
    verts = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(t.matrixWorld); verts.set([v.x, v.y, v.z], i * 3); }
    const idx = t.geometry.getIndex();
    index = idx ? Uint32Array.from(idx.array as ArrayLike<number>) : Uint32Array.from({ length: pos.count }, (_, i) => i);
  }

  // door: move its parts (panel + battens) into a group whose origin is the hinge
  let door: Group | null = null;
  const d = layout.doors[0];
  if (d && doorParts.length) {
    door = new Group(); door.name = 'door_parts';
    const toHinge = new Matrix4().makeTranslation(-d.hinge[0], -d.hinge[1], -d.hinge[2]);
    for (const part of doorParts.filter((p) => !doorParts.includes(p.parent as Object3D))) {
      const local = new Matrix4().multiplyMatrices(toHinge, part.matrixWorld);
      part.removeFromParent(); local.decompose(part.position, part.quaternion, part.scale); door.add(part);
    }
  }
  // house A rebuilt (houseA.ts): a cottage with a thatched gable roof, timber frame, bamboo walls and a panelled door
  // on the original footprint, hinge and openings. The original box walls and single-slope roof are hidden (the
  // build keeps them as separate named meshes so their materials and the interior stay intact); the old door board
  // stays in the hinge group, hidden.
  const houseMats = createHouseMaterials(houseTex, world, door);
  if (houseMats) {
    world.traverse((o) => { if (/^A_(wall|gable|band|roof|patch|rafter|purlin|plate)/.test(o.name)) o.visible = false; });
    world.add(buildHouseA(houseMats));
    if (door && d) { door.children.forEach((c) => { c.visible = false; }); door.add(buildHouseADoor(houseMats, d.width, d.height)); }
    world.updateMatrixWorld(true);
  }
  // weather (cloud shadows, wetness, puddles on the terrain) on every lit surface, after the terrain material is set
  const lit = (o: Object3D) => { const m = o as Mesh; if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => applyWeather(mm, { puddles: o === t, matte: mm.name === 'houseA_thatch' })); };
  world.traverse(lit); door?.traverse(lit);
  buildBoundsTrees(world);                                 // fast look-at / autofocus raycasts
  if (door) buildBoundsTrees(door);
  const prepared = { terrain: t, door, verts, index };
  world.userData.prepared = prepared;
  return prepared;
}

export function SurvivalChapter() {
  const raw = useLoader(FileLoader, `${SURVIVAL_BASE}/layout.json`);
  const layout = useMemo(() => JSON.parse(String(raw)) as SurvivalLayout, [raw]);
  const { scene: world } = useGLTF(`${SURVIVAL_BASE}/world.glb`, false, true);
  const ground = useLoader(TextureLoader, terrainTextureUrls(`${SURVIVAL_BASE}/ground`));
  const terrainMat = useMemo(() => createTerrainMaterial(ground), [ground]);
  const houseTex = useLoader(TextureLoader, houseTextureUrls(SURVIVAL_BASE));
  const prepared = useMemo(() => prepare(world, layout, terrainMat, houseTex), [world, layout, terrainMat, houseTex]);
  const quality = useGame((s) => s.settings.quality);
  // weather for this chapter's Look; the shelter map (what is under a roof) is rendered once per visit
  const look = lookFor('survival');
  const gl = useThree((st) => st.gl);
  const shelter = useMemo(() => buildShelterMap(gl, world, [2, 8], 170), [gl, world]);
  // puddles in the hollows of the village and the road (needs the terrain's BVH from prepare())
  useMemo(() => prepared.terrain && buildPuddleMap(prepared.terrain, [14, 28], 150), [prepared]);
  useEffect(() => {
    weather.wetness.value = look.weather?.wetness ?? 0;
    weather.cloudStrength.value = look.weather?.cloudShadows ?? 0;
  }, [look]);
  useFrame((_, dt) => { weather.time.value += Math.min(Math.max(dt, 0), 0.1); });
  // detailed Sketchfab houses (replace houses B and C, plus one by the road); the scatter keeps clear of them
  const houses = usePlacedHouses(prepared.terrain);
  const vehicles = usePlacedVehicles(prepared.terrain);
  const portalFrame = usePortalFrame(prepared.terrain);
  const scatterLayout = useMemo(() => ({ ...layout, colliders: [...layout.colliders, ...houses.map((h) => h.box), ...vehicles.map((v) => v.box), portalFrame.box] }), [layout, houses, vehicles, portalFrame]);
  // banana groves + extra grass, placed on the terrain (needs the terrain's BVH from prepare())
  const extra = useMemo(() => (prepared.terrain ? scatter(prepared.terrain, scatterLayout) : { bananasNear: [], bananasFar: [], grass: {}, flora: { coconut: [], mango: [], raintree: [], bamboo: [], taro: [], elephant: [], fern: [] }, lamps: [] as [number, number, number, number][] }), [prepared, scatterLayout]);
  useEffect(() => { if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as Record<string, unknown>).__flora = extra.flora; }, [extra]);
  const planted = useMemo(() => {
    const foliage = { ...layout.foliage };
    for (const [v, list] of Object.entries(extra.grass)) foliage[v] = [...(foliage[v] ?? []), ...list];
    return { ...layout, foliage };
  }, [layout, extra]);

  return (
    <group>
      <primitive object={world} />

      {/* collision: terrain triangles + simplified boxes */}
      <RigidBody type="fixed" colliders={false} collisionGroups={GROUPS.environment}>
        {prepared.verts.length > 0 && <TrimeshCollider args={[prepared.verts, prepared.index]} collisionGroups={GROUPS.environment} />}
        {layout.colliders.map((c, i) => (
          <CuboidCollider key={i} args={c.h} position={c.p} quaternion={c.q} collisionGroups={GROUPS.environment} />
        ))}
      </RigidBody>

      {prepared.door && <Door layout={layout} parts={prepared.door} />}

      {/* the photo wall (Discoveries) replaces the cabinet photograph's interaction; the oil lamp swells when examined */}
      {layout.interactables.filter((it) => it.narrativeId && it.id !== 'survival-photograph').map((it) => (
        <Interactable key={it.id} id={it.id} label={it.label} verb={it.verb} narrativeId={it.narrativeId} position={it.p}
          onInteract={it.id === 'survival-lamp' ? () => { lampFx.at = nowS(); openDiscovery('survival-lamp'); } : undefined}>
          <mesh material={HIT}><boxGeometry args={it.id === 'survival-sungka' ? [0.8, 0.35, 0.45] : [0.45, 0.5, 0.45]} /></mesh>
        </Interactable>
      ))}

      {layout.lights.map((l, i) => <OilLamp key={i} p={l.p} color={l.color} intensity={l.intensity * (look.practicals ? 4 : 2.2)} distance={l.distance} />)}
      {layout.lights.map((l, i) => <LampGlow key={`g${i}`} p={l.p} />)}
      {(look.practicals ?? 0) > 0 && <Streetlights lamps={extra.lamps} strength={look.practicals!} />}

      <Houses houses={houses} />
      <HouseLights houses={houses} strength={look.practicals ?? 0.5} quality={quality} />
      <Vehicles vehicles={vehicles} />
      <Foliage layout={planted} quality={quality} />
      <Bananas near={extra.bananasNear} far={extra.bananasFar} quality={quality} />
      <Flora flora={extra.flora} quality={quality} />
      <Animals world={world} />
      <Portal frame={portalFrame} />
      <Discoveries vehicles={vehicles} portal={portalFrame} />
      <Trail world={world} />
      {(look.weather?.rain ?? 0) > 0 && <Rain intensity={look.weather!.rain} quality={quality} />}
      <RoofRain heightAt={shelter.heightAt} active={(look.weather?.rain ?? 0) > 0} />
    </group>
  );
}

/** the front door of house A: E toggles it, it swings with easing, and its collider swings with it */
function Door({ layout, parts }: { layout: SurvivalLayout; parts: Group }) {
  const d = layout.doors[0];
  const pivot = useRef<Group>(null);
  const body = useRef<RapierRigidBody>(null);
  const [open, setOpen] = useState(false);
  const yaw = useRef(d.closedYaw);
  const q = useMemo(() => new Quaternion(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useFrame((_, dt) => {
    // scroll mode: the door opens by itself as the path reaches it (E still works)
    if (rail.active && !open && Math.hypot(playerState.position.x - (d.hinge[0] + d.width / 2), playerState.position.z - d.hinge[2]) < 2.4) setOpen(true);
    const target = open ? d.openYaw : d.closedYaw;
    yaw.current += (target - yaw.current) * (1 - Math.exp(-4 * Math.min(Math.max(dt, 0), 1 / 30)));
    if (pivot.current) pivot.current.rotation.y = yaw.current;
    body.current?.setNextKinematicRotation(q.setFromAxisAngle(up, yaw.current));
  });

  const half: [number, number, number] = [d.width / 2, d.height / 2, Math.max(d.thickness, 0.06) / 2];
  const centre: [number, number, number] = [d.width / 2, d.height / 2 + 0.01, 0];
  return (
    <>
      <group ref={pivot} position={d.hinge}>
        <primitive object={parts} />
        <Interactable id={d.id} label="the door" verb={open ? 'close' : 'open'} onInteract={toggle} position={centre}>
          <mesh material={HIT}><boxGeometry args={[d.width, d.height, 0.16]} /></mesh>
        </Interactable>
      </group>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={d.hinge} collisionGroups={GROUPS.environment}>
        <CuboidCollider args={half} position={centre} collisionGroups={GROUPS.environment} />
      </RigidBody>
    </>
  );
}

/** the oil lamp: a warm point light with a slow, irregular flame flicker */
function OilLamp({ p, color, intensity, distance }: { p: [number, number, number]; color: string; intensity: number; distance: number }) {
  const ref = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // examined (E): the flame swells, the light rises by up to 80% and reaches a little further, then settles
    const k = lampBoost();
    if (ref.current) {
      ref.current.intensity = intensity * (1 + 0.8 * k) * (0.9 + 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 13.1 + 1.7) + 0.03 * Math.sin(t * 2.1));
      ref.current.distance = distance * (1 + 0.35 * k);
    }
  });
  return <pointLight ref={ref} position={p} color={color} intensity={intensity} distance={distance} decay={2} />;
}


/** tells the audio engine when the visitor stands under a roof in the rain (rain drums on the corrugated iron) */
function RoofRain({ heightAt, active }: { heightAt: (x: number, z: number) => number; active: boolean }) {
  useFrame(() => {
    const p = playerState.position;
    audio.setRoof(active && heightAt(p.x, p.z) > p.y + 2 ? 1 : 0);
  });
  return null;
}


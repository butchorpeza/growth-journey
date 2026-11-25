/* 02 · The Forgotten Grounds: the courtyard before the house. The avenue bends round a dry fountain at its centre on
   a circle of mossy cobbles breaking up into the grass. Round it, years of neglect: benches (one tipped over), a
   weathered statue facing the house, marble busts on pedestals, urns (one fallen and broken), old lanterns on
   stone posts (two still give a little light), raised flower beds of dead stalks, an abandoned table and chairs,
   a suitcase left by a bench, loose stones. E at the statue, facing the house: "Being Underestimated" (chapter02.ts). */
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import {
  Color, CylinderGeometry, Float32BufferAttribute, InstancedMesh, LatheGeometry, MeshStandardMaterial, Object3D,
  RingGeometry, Vector2, type PointLight,
} from 'three';
import { Interactable } from '../../interactions/Interactable';
import { GROUPS } from '../../physics/CollisionLayers';
import { openDiscovery } from '../survival/Discoveries';
import { rng, useEstateMaterials } from './Estate';
import { FOUNTAIN, groundHeight } from './layout';
import { useProp, useShadowsMaterials, type PropName } from './materials';

const v2 = (pts: [number, number][]) => pts.map(([r, y]) => new Vector2(r, y));
const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

function Prop({ name, p, yaw = 0, rot, scale = 1, age }: { name: PropName; p: [number, number, number]; yaw?: number; rot?: [number, number, number]; scale?: number; age?: number }) {
  const o = useProp(name, age);
  return <primitive object={o} position={p} rotation={rot ?? [0, yaw, 0]} scale={scale} />;
}
const onGround = (x: number, z: number, lift = 0): [number, number, number] => [x, groundHeight(x, z) + lift, z];

function Fountain() {
  const em = useEstateMaterials();
  const { basin, column, bowl, chunk } = useMemo(() => ({
    basin: new LatheGeometry(v2([[0, 0], [3.0, 0], [3.06, 0.06], [3.06, 0.52], [3.22, 0.58], [3.22, 0.72], [2.82, 0.72], [2.76, 0.62], [2.76, 0.24], [0, 0.24]]), 64),
    column: new LatheGeometry(v2([[0, 0.24], [0.58, 0.24], [0.44, 0.38], [0.31, 0.54], [0.26, 1.1], [0.36, 1.26], [0.5, 1.36], [0, 1.36]]), 40),
    bowl: new LatheGeometry(v2([[0, 1.36], [0.5, 1.36], [1.1, 1.58], [1.24, 1.74], [1.17, 1.78], [0.62, 1.61], [0.3, 1.63], [0.22, 1.9], [0.16, 2.3], [0.27, 2.45], [0.12, 2.62], [0, 2.66]]), 48, 0.9, Math.PI * 2 * 0.86),
    chunk: new LatheGeometry(v2([[0.55, 1.36], [1.1, 1.58], [1.24, 1.74], [1.17, 1.78], [0.62, 1.61]]), 6, 0, Math.PI * 2 * 0.12),
  }), []);
  const water = useMemo(() => new MeshStandardMaterial({ color: new Color('#050708'), roughness: 0.04, metalness: 0.2 }), []);
  const y = groundHeight(FOUNTAIN.x, FOUNTAIN.z);
  return (
    <group position={[FOUNTAIN.x, y - 0.02, FOUNTAIN.z]}>
      <mesh geometry={basin} material={em.stone} castShadow receiveShadow />
      <mesh geometry={column} material={em.stone} castShadow receiveShadow />
      <mesh geometry={bowl} material={em.stone} castShadow receiveShadow />
      {/* the broken piece of the bowl, fallen into the basin */}
      <mesh geometry={chunk} material={em.stone} position={[0.9, -1.12, 1.6]} rotation={[1.2, 0.4, 0.3]} castShadow />
      <mesh material={water} rotation-x={-Math.PI / 2} position={[0, 0.3, 0]}><circleGeometry args={[2.74, 48]} /></mesh>
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}><CylinderCollider args={[0.4, 3.2]} position={[0, 0.36, 0]} /></RigidBody>
    </group>
  );
}

/** the cobbled circle: conforms to the ground, its edge broken up (vertex alpha) where the grass has taken it back */
function Paving() {
  const sm = useShadowsMaterials();
  const geo = useMemo(() => {
    const g = new RingGeometry(0.05, FOUNTAIN.paved, 96, 14), p = g.attributes.position, uv = g.attributes.uv, col: number[] = [];
    const r = rng(5);
    const jag = Array.from({ length: 97 }, () => r());
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i), lz = p.getY(i), x = FOUNTAIN.x + lx, z = FOUNTAIN.z - lz;
      p.setXYZ(i, lx, groundHeight(x, z) + 0.035, -lz);
      uv.setXY(i, x / 2.2, z / 2.2);
      const d = Math.hypot(lx, lz) / FOUNTAIN.paved, a = Math.atan2(lz, lx), k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 96);
      const edge = 0.78 + 0.16 * jag[k] + 0.05 * Math.sin(a * 7);
      col.push(1, 1, 1, Math.max(0, Math.min(1, (edge - d) / 0.12)));
    }
    g.setAttribute('color', new Float32BufferAttribute(col, 4));
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => { const m = sm.cobble.clone(); m.vertexColors = true; m.transparent = true; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -3; return m; }, [sm]);
  return <mesh geometry={geo} material={mat} position={[FOUNTAIN.x, 0, FOUNTAIN.z]} receiveShadow renderOrder={2} />;
}

function Pedestal({ x, z, h, w, mats }: { x: number; z: number; h: number; w: number; mats: ReturnType<typeof useEstateMaterials> }) {
  const y = groundHeight(x, z);
  return (
    <group position={[x, y, z]}>
      <mesh material={mats.stone} position={[0, 0.08, 0]} castShadow receiveShadow><boxGeometry args={[w + 0.2, 0.16, w + 0.2]} /></mesh>
      <mesh material={mats.stone} position={[0, h / 2, 0]} castShadow receiveShadow><boxGeometry args={[w, h, w]} /></mesh>
      <mesh material={mats.stone} position={[0, h + 0.05, 0]} castShadow><boxGeometry args={[w + 0.14, 0.1, w + 0.14]} /></mesh>
    </group>
  );
}

const LANTERNS: [number, number, 'on' | 'flicker' | 'off'][] = [[-4.6, -20.4, 'on'], [6.9, -19.8, 'on'], [-4.9, -35.8, 'flicker'], [7.1, -36.4, 'on']];

function Lanterns({ mats }: { mats: ReturnType<typeof useEstateMaterials> }) {
  const lights = useRef<(PointLight | null)[]>([]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    LANTERNS.forEach(([, , s], i) => {
      const l = lights.current[i]; if (!l) return;
      let k = 0.85 + 0.1 * Math.sin(t * 8.3 + i) + 0.05 * Math.sin(t * 19 + i);
      if (s === 'flicker' && ((t + i) % 7) > 5.2) k *= Math.sin(t * 41) > 0 ? 0.15 : 1;
      l.intensity = 5 * k;
    });
  });
  return (
    <>
      {LANTERNS.map(([x, z, s], i) => {
        const y = groundHeight(x, z);
        return (
          <group key={i}>
            <Pedestal x={x} z={z} h={1.55} w={0.32} mats={mats} />
            <Prop name="Lantern_01" p={[x, y + 1.62, z]} yaw={i * 1.3} scale={2.4} age={0.5} />
            {s !== 'off' && <pointLight ref={(l) => { lights.current[i] = l; }} position={[x, y + 1.95, z]} color="#ffae63" intensity={5} distance={11} decay={2} />}
          </group>
        );
      })}
    </>
  );
}

/** a raised bed of dead stalks: a stone kerb, dark soil, dry stems leaning every way */
function FlowerBed({ x, z, len, yaw, mats }: { x: number; z: number; len: number; yaw: number; mats: ReturnType<typeof useEstateMaterials> }) {
  const y = groundHeight(x, z);
  const stalks = useMemo(() => {
    const m = new InstancedMesh(new CylinderGeometry(0.004, 0.007, 1, 4), new MeshStandardMaterial({ color: '#4a4335', roughness: 1 }), 220);
    const d = new Object3D(), r = rng(Math.round(x * 13 + z));
    for (let i = 0; i < 220; i++) {
      const h = 0.25 + r() * 0.55;
      d.position.set((r() - 0.5) * 1.1, 0.36 + h / 2 * Math.cos(0.3), (r() - 0.5) * (len - 0.3)); d.rotation.set((r() - 0.5) * 0.9, 0, (r() - 0.5) * 0.9); d.scale.set(1, h, 1);
      d.updateMatrix(); m.setMatrixAt(i, d.matrix);
    }
    m.castShadow = true; return m;
  }, [x, z, len]);
  const soil = useMemo(() => new MeshStandardMaterial({ color: '#16130f', roughness: 1 }), []);
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      {[-0.68, 0.68].map((o) => <mesh key={o} material={mats.stone} position={[o, 0.2, 0]} castShadow receiveShadow><boxGeometry args={[0.16, 0.4, len]} /></mesh>)}
      {[-1, 1].map((o) => <mesh key={o} material={mats.stone} position={[0, 0.2, o * (len / 2 - 0.08)]} castShadow receiveShadow><boxGeometry args={[1.2, 0.4, 0.16]} /></mesh>)}
      <mesh material={soil} position={[0, 0.3, 0]} receiveShadow><boxGeometry args={[1.22, 0.1, len - 0.2]} /></mesh>
      <primitive object={stalks} />
    </group>
  );
}

function Debris({ mats }: { mats: ReturnType<typeof useEstateMaterials> }) {
  const m = useMemo(() => {
    const r = rng(17), n = 60, im = new InstancedMesh(new CylinderGeometry(0.5, 0.6, 1, 6), mats.stone, n), d = new Object3D();
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, rad = 2 + r() * 9, x = FOUNTAIN.x + Math.cos(a) * rad, z = FOUNTAIN.z + Math.sin(a) * rad;
      const s = 0.05 + r() * 0.13;
      d.position.set(x, groundHeight(x, z) + s * 0.3, z); d.rotation.set(r() * 3, r() * 3, r() * 3); d.scale.set(s * (1 + r()), s, s * (0.6 + r()));
      d.updateMatrix(); im.setMatrixAt(i, d.matrix);
    }
    im.castShadow = true; im.receiveShadow = true; return im;
  }, [mats]);
  return <primitive object={m} />;
}

export function Courtyard() {
  const mats = useEstateMaterials();
  const F = FOUNTAIN;
  const benches: { x: number; z: number; tipped?: boolean }[] = [{ x: -6.6, z: -25 }, { x: -6.4, z: -31.6, tipped: true }, { x: 9.2, z: -27.6 }, { x: 2.6, z: -36.9 }];
  const statue = { x: -8.6, z: -36.4 };
  return (
    <group>
      <Paving />
      <Fountain />
      {benches.map((b, i) => {
        const yaw = yawTo(b.x, b.z, F.x, F.z);
        return b.tipped
          ? <Prop key={i} name="painted_wooden_bench" p={onGround(b.x, b.z, 0.25)} rot={[-Math.PI / 2 + 0.12, yaw, 0]} age={0.6} />
          : <Prop key={i} name="painted_wooden_bench" p={onGround(b.x, b.z)} yaw={yaw} age={0.55} />;
      })}
      {/* the suitcase, left lying by the first bench */}
      <Prop name="vintage_suitcase" p={onGround(-5.7, -23.4, 0.12)} rot={[-Math.PI / 2, 0, 0.6]} scale={0.62} age={0.55} />
      {/* the statue on its plinth, facing the house */}
      <Pedestal x={statue.x} z={statue.z} h={1.0} w={1.7} mats={mats} />
      <Prop name="gothic_statue" p={onGround(statue.x, statue.z + 0.3, 1.1)} yaw={Math.PI} scale={1.05} age={0.6} />
      <Interactable id="shadows-statue" label="the statue" verb="look at" reach={5} onInteract={() => openDiscovery('shadows-statue')} position={onGround(statue.x, statue.z, 2.0)}>
        <mesh visible={false}><boxGeometry args={[1.6, 2, 1.6]} /></mesh>
      </Interactable>
      {/* busts on pedestals */}
      {[[9.0, -21.6, -2.2], [9.2, -34.6, -1.0]].map(([x, z, yaw], i) => (
        <group key={i}>
          <Pedestal x={x} z={z} h={1.25} w={0.48} mats={mats} />
          <Prop name="marble_bust_01" p={onGround(x, z, 1.31)} yaw={yaw} scale={1.5} age={0.7} />
        </group>
      ))}
      {/* urns at the way in: one standing, one fallen and broken */}
      <Pedestal x={-2.7} z={-17.2} h={0.85} w={0.6} mats={mats} />
      <Prop name="antique_ceramic_vase_01" p={onGround(-2.7, -17.2, 0.91)} scale={2.1} age={0.6} />
      <Pedestal x={3.1} z={-16.6} h={0.85} w={0.6} mats={mats} />
      <Prop name="antique_ceramic_vase_01" p={onGround(3.6, -17.9, 0.26)} rot={[0, 0.8, Math.PI / 2 - 0.1]} scale={2.1} age={0.6} />
      <Lanterns mats={mats} />
      <FlowerBed x={-9.2} z={-29.4} len={4.2} yaw={0.08} mats={mats} />
      <FlowerBed x={11.4} z={-28.2} len={3.6} yaw={-0.12} mats={mats} />
      {/* an abandoned table and chairs */}
      <Prop name="outdoor_table_chair_set_01" p={onGround(-10.4, -41.6)} yaw={0.7} scale={1.2} age={0.6} />
      <Debris mats={mats} />
      <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
        {benches.map((b, i) => <CuboidCollider key={i} args={[0.62, 0.45, 0.3]} position={onGround(b.x, b.z, 0.45)} rotation={[0, yawTo(b.x, b.z, F.x, F.z), 0]} />)}
        <CuboidCollider args={[0.95, 1.0, 0.95]} position={onGround(statue.x, statue.z, 1.0)} />
        {[[9.0, -21.6], [9.2, -34.6], [-2.7, -17.2], [3.1, -16.6], ...LANTERNS.map(([x, z]) => [x, z])].map(([x, z], i) => <CuboidCollider key={`p${i}`} args={[0.35, 0.9, 0.35]} position={onGround(x, z, 0.9)} />)}
        <CuboidCollider args={[0.7, 0.3, 2.2]} position={onGround(-9.2, -29.4, 0.3)} rotation={[0, 0.08, 0]} />
        <CuboidCollider args={[0.7, 0.3, 1.9]} position={onGround(11.4, -28.2, 0.3)} rotation={[0, -0.12, 0]} />
        <CuboidCollider args={[0.6, 0.5, 1.1]} position={onGround(-10.4, -41.6, 0.5)} rotation={[0, 0.7, 0]} />
      </RigidBody>
    </group>
  );
}


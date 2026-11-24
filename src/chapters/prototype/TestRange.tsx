/* TEMPORARY TECHNICAL TEST RANGE (Phase 03) — not final art and never shown as such.
   Grey blockout for testing the first-person controller: slopes at 15°/30°/44°/58° (the last one must NOT be
   climbable), stairs, a corridor and a low tunnel, jump platforms, pushable crates and two interactables. Everything here is replaced by real environment assets from Phase 04 on. */
import { Grid } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { MathUtils } from 'three';
import { Interactable } from '../../interactions/Interactable';
import { GROUPS } from '../../physics/CollisionLayers';

const GREY = '#8d949c', DARK = '#5d646c', ACCENT = '#c9a26f';
const deg = MathUtils.degToRad;

function Block({ position, size, rotation = [0, 0, 0], color = GREY }: { position: [number, number, number]; size: [number, number, number]; rotation?: [number, number, number]; color?: string }) {
  return (
    <RigidBody type="fixed" colliders="cuboid" position={position} rotation={rotation} collisionGroups={GROUPS.environment}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </RigidBody>
  );
}

function Ramp({ x, angle, length = 8, width = 3 }: { x: number; angle: number; length?: number; width?: number }) {
  const a = deg(angle), h = Math.sin(a) * length / 2, d = Math.cos(a) * length / 2;
  return <Block position={[x, h - 0.1, -10 - d]} size={[width, 0.2, length]} rotation={[a, 0, 0]} color={angle > 46 ? '#8a5a52' : GREY} />;
}

function Stairs({ x, z, steps = 10, rise = 0.17, run = 0.3, width = 3 }: { x: number; z: number; steps?: number; rise?: number; run?: number; width?: number }) {
  return (
    <>
      {Array.from({ length: steps }, (_, i) => (
        <Block key={i} position={[x, (rise * (i + 1)) / 2, z - run * i]} size={[width, rise * (i + 1), run]} />
      ))}
      <Block position={[x, rise * steps - 0.1, z - run * steps - 1.5]} size={[width, 0.2, 3]} />
    </>
  );
}

function Crate({ position }: { position: [number, number, number] }) {
  return (
    <RigidBody type="dynamic" colliders="cuboid" position={position} mass={8} linearDamping={0.8} angularDamping={0.8} collisionGroups={GROUPS.dynamic}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial color={ACCENT} roughness={0.7} />
      </mesh>
    </RigidBody>
  );
}

export function TestRange() {
  return (
    <group>
      {/* ground */}
      <RigidBody type="fixed" colliders={false} collisionGroups={GROUPS.environment}>
        <CuboidCollider args={[80, 0.5, 80]} position={[0, -0.5, 0]} collisionGroups={GROUPS.environment} />
      </RigidBody>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#6f767d" roughness={0.95} />
      </mesh>
      <Grid position={[0, 0.005, 0]} args={[160, 160]} cellSize={1} cellThickness={0.6} cellColor="#5a6168" sectionSize={5} sectionThickness={1} sectionColor="#4a5057" fadeDistance={70} infiniteGrid={false} />

      {/* slopes: 15°, 30°, 44° walkable; 58° too steep (reddish) */}
      <Ramp x={-12} angle={15} />
      <Ramp x={-8} angle={30} />
      <Ramp x={-4} angle={44} />
      <Ramp x={0} angle={58} />

      {/* stairs (17 cm rise, 30 cm run) */}
      <Stairs x={6} z={-8} />

      {/* jump platforms with growing gaps */}
      <Block position={[14, 0.5, -6]} size={[2.5, 1, 2.5]} color={DARK} />
      <Block position={[14, 1.0, -9.5]} size={[2.5, 2, 2.5]} color={DARK} />
      <Block position={[14, 1.5, -13.5]} size={[2.5, 3, 2.5]} color={DARK} />

      {/* camera collision: long wall, a corridor and a low tunnel */}
      <Block position={[-14, 2, 8]} size={[0.4, 4, 16]} />
      <Block position={[-10, 1.6, 8]} size={[0.4, 3.2, 12]} />
      <Block position={[-12, 3.35, 8]} size={[4.4, 0.3, 6]} color={DARK} />
      <Block position={[4, 2.5, 14]} size={[12, 5, 0.4]} />
      {[0, 1, 2, 3].map((i) => <Block key={i} position={[8 + (i % 2) * 3, 2, 4 + Math.floor(i / 2) * 3]} size={[0.8, 4, 0.8]} color={DARK} />)}

      {/* pushable props */}
      <Crate position={[3, 0.4, 3]} />
      <Crate position={[3.9, 0.4, 3.2]} />
      <Crate position={[3.4, 1.2, 3.1]} />

      {/* interactions */}
      <Interactable id="test-photograph" label="old photograph" narrativeId="test-photograph" position={[-3, 0, 4]}>
        <Block position={[0, 0.5, 0]} size={[0.6, 1, 0.6]} color={DARK} />
        <mesh position={[0, 1.06, 0]} rotation-x={-0.5} castShadow>
          <boxGeometry args={[0.3, 0.02, 0.22]} />
          <meshStandardMaterial color="#e8e0cf" roughness={0.6} />
        </mesh>
      </Interactable>
      <Interactable id="test-signpost" label="signpost" narrativeId="test-signpost" verb="read" position={[0, 0, 20]}>
        <Block position={[0, 1.1, 0]} size={[0.12, 2.2, 0.12]} color="#6b5a46" />
        <mesh position={[0.4, 1.9, 0]} castShadow>
          <boxGeometry args={[0.9, 0.25, 0.04]} />
          <meshStandardMaterial color="#8a7458" roughness={0.8} />
        </mesh>
      </Interactable>
    </group>
  );
}

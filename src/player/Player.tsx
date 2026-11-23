/* Third-person player: a kinematic capsule moved by Rapier's character controller (collisions, slopes, steps,
   ground snapping), gravity + jumping with coyote time and jump buffering, camera-relative movement with
   acceleration/deceleration, smooth turning, and animation states driven by the real motion. */
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import { Group, MathUtils, Vector3, type Mesh } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getGame } from '../game/GameState';
import { GROUPS } from '../physics/CollisionLayers';
import { character, MOVE } from './characterConfig';
import { PlayerAnimations } from './PlayerAnimations';
import { retargetClips } from './retargetClips';
import { input } from './PlayerInput';
import { playerState } from './playerState';

const HALF = character.height / 2 - MOVE.capsuleRadius;   // capsule half-height (cylinder part)
const CENTER_Y = HALF + MOVE.capsuleRadius;               // capsule centre above the feet

type KCC = ReturnType<ReturnType<typeof useRapier>['world']['createCharacterController']>;

export function Player({ spawn = [0, 0, 0] as [number, number, number] }) {
  const { world } = useRapier();
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const visual = useRef<Group>(null);
  const kcc = useRef<KCC | null>(null);

  const gltf = useGLTF(character.url, false, true);
  const animSource = useGLTF(character.animationsUrl ?? character.url, false, true);
  const model = useMemo(() => {
    const m = cloneSkinned(gltf.scene) as Group;
    m.traverse((o) => {
      const mesh = o as Mesh & { isSkinnedMesh?: boolean };
      if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; }
    });
    return m;
  }, [gltf.scene]);
  const clips = useMemo(() => (character.animationsUrl ? retargetClips(animSource.animations, gltf.scene, animSource.scene) : gltf.animations),
    [animSource, gltf]);
  const { actions } = useAnimations(clips, visual);
  const anim = useRef<PlayerAnimations | null>(null);
  useEffect(() => { anim.current = new PlayerAnimations(actions, character); }, [actions]);

  // Rapier character controller: 1 cm skin, autostep for stairs, snap to ground on slopes, push dynamic props
  useEffect(() => {
    const c = world.createCharacterController(0.01);
    c.setUp({ x: 0, y: 1, z: 0 });
    c.setMaxSlopeClimbAngle(MathUtils.degToRad(MOVE.maxSlope));
    c.setMinSlopeSlideAngle(MathUtils.degToRad(MOVE.maxSlope + 4));
    c.enableAutostep(MOVE.stepHeight, 0.2, true);
    c.enableSnapToGround(0.35);
    c.setApplyImpulsesToDynamicBodies(true);
    c.setCharacterMass(75);
    kcc.current = c;
    return () => { world.removeCharacterController(c); kcc.current = null; };
  }, [world]);

  const tmp = useMemo(() => ({ wish: new Vector3(), move: new Vector3(), fwd: new Vector3(), right: new Vector3() }), []);
  const timers = useRef({ sinceGround: 0, sinceJump: 9, air: 0 });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const b = body.current, col = collider.current, c = kcc.current;
    if (!b || !col || !c) return;

    if (playerState.teleport) {
      b.setTranslation({ x: playerState.teleport.x, y: playerState.teleport.y + CENTER_Y, z: playerState.teleport.z }, true);
      playerState.velocity.set(0, 0, 0); playerState.teleport = null;
    }

    const active = getGame().mode === 'playing';
    const v = playerState.velocity;

    // camera-relative wish direction
    const yaw = playerState.camYaw;
    tmp.fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    tmp.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    tmp.wish.set(0, 0, 0);
    if (active) tmp.wish.addScaledVector(tmp.fwd, input.forward).addScaledVector(tmp.right, input.right);
    const moving = tmp.wish.lengthSq() > 0.001;
    if (moving) tmp.wish.normalize();
    const targetSpeed = moving ? (input.run ? MOVE.runSpeed : MOVE.walkSpeed) : 0;

    // acceleration / deceleration on the horizontal plane (reduced in the air)
    const control = playerState.grounded ? 1 : MOVE.airControl;
    const rate = (moving ? MOVE.accel : MOVE.decel) * control;
    const k = 1 - Math.exp(-rate * dt);
    v.x += (tmp.wish.x * targetSpeed - v.x) * k;
    v.z += (tmp.wish.z * targetSpeed - v.z) * k;

    // gravity, coyote time, jump buffer
    const t = timers.current;
    t.sinceGround = playerState.grounded ? 0 : t.sinceGround + dt;
    if (active && input.jumpPressed) { t.sinceJump = 0; input.jumpPressed = false; } else t.sinceJump += dt;
    if (t.sinceJump < MOVE.jumpBuffer && t.sinceGround < MOVE.coyoteTime && v.y <= 0.01) {
      v.y = MOVE.jumpVelocity; t.sinceJump = 9; t.sinceGround = 9; anim.current?.set('jump', 0.12);
    }
    v.y -= MOVE.gravity * dt;

    // let Rapier resolve the move against the world
    tmp.move.set(v.x * dt, v.y * dt, v.z * dt);
    c.computeColliderMovement(col, tmp.move, undefined, GROUPS.player);
    const m = c.computedMovement();
    const grounded = c.computedGrounded();
    if (v.y > 0 && m.y < tmp.move.y - 1e-4) v.y = 0;            // hit a ceiling
    if (grounded && v.y < 0) v.y = -0.5;                        // stay glued to the ground
    // note: the velocity is NOT cut when a move is blocked — Rapier's autostep needs the full step
    // (cutting it kept the character stuck at the first stair). Walls are handled by Rapier sliding.

    const p = b.translation();
    b.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });

    const wasGrounded = playerState.grounded;
    playerState.grounded = grounded;
    playerState.position.set(p.x + m.x, p.y + m.y - CENTER_Y, p.z + m.z);
    // animation + camera use the distance actually travelled, so pushing into a wall reads as standing
    playerState.speed = dt > 0 ? Math.hypot(m.x, m.z) / dt : 0;

    // face the direction of travel
    if (moving && Math.hypot(v.x, v.z) > 0.15) {
      const targetYaw = Math.atan2(v.x, v.z);
      let d = targetYaw - playerState.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      playerState.yaw += d * (1 - Math.exp(-MOVE.turnRate * dt));
    }
    if (visual.current) {
      visual.current.position.copy(playerState.position);
      visual.current.rotation.y = playerState.yaw + character.yawOffset;
    }

    // animation state from the actual motion
    const a = anim.current;
    if (a) {
      t.air = grounded ? 0 : t.air + dt;
      if (!grounded && t.air > 0.18) a.set(v.y > 0.5 ? 'jump' : 'fall', 0.2);
      else if (grounded && !wasGrounded && t.air > 0.35) a.set('land', 0.1);
      else if (grounded) a.set(playerState.speed < 0.15 ? 'idle' : playerState.speed < (MOVE.walkSpeed + MOVE.runSpeed) / 2 ? 'walk' : 'run', 0.28);
      a.sync(playerState.speed);
    }
  });

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0], spawn[1] + CENTER_Y, spawn[2]]} enabledRotations={[false, false, false]}>
        <CapsuleCollider ref={collider} args={[HALF, MOVE.capsuleRadius]} collisionGroups={GROUPS.player} />
      </RigidBody>
      <group ref={visual}>
        <primitive object={model} scale={character.scale} />
      </group>
    </>
  );
}

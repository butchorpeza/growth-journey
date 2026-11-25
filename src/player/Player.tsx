/* First-person body: an invisible kinematic capsule moved by Rapier's character controller (collisions, slopes,
   steps, ground snapping), with gravity, jumping (coyote time + jump buffer) and view-relative movement with
   acceleration/deceleration. Nothing is rendered: the visitor is the camera (PlayerCamera.tsx). */
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import { MathUtils, Vector3 } from 'three';
import { getGame } from '../game/GameState';
import { director } from '../game/director';
import { GROUPS } from '../physics/CollisionLayers';
import { MOVE } from './movement';
import { input } from './PlayerInput';
import { playerState } from './playerState';
import { rail } from './rail';

const HALF = MOVE.height / 2 - MOVE.capsuleRadius;   // capsule half-height (cylinder part)
const CENTER_Y = HALF + MOVE.capsuleRadius;          // capsule centre above the feet

type KCC = ReturnType<ReturnType<typeof useRapier>['world']['createCharacterController']>;

export function Player({ spawn = [0, 0, 0] as [number, number, number], spawnYaw = 0 }) {
  const { world } = useRapier();
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const kcc = useRef<KCC | null>(null);

  useEffect(() => {
    playerState.position.set(...spawn); playerState.velocity.set(0, 0, 0);
    playerState.camYaw = spawnYaw; playerState.camPitch = 0;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const timers = useRef({ sinceGround: 0, sinceJump: 9 });

  useFrame((_, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 0), 1 / 30);
    const b = body.current, col = collider.current, c = kcc.current;
    if (!b || !col || !c) return;

    if (playerState.teleport) {
      b.setTranslation({ x: playerState.teleport.x, y: playerState.teleport.y + CENTER_Y, z: playerState.teleport.z }, true);
      playerState.velocity.set(0, 0, 0); playerState.teleport = null;
    }

    if (rail.active) return;                                     // scroll mode: the path moves the visitor
    // a scripted look (game/director.ts) holds the walk for a few seconds; a hesitation slows it
    const active = getGame().mode === 'playing' && !director.move.lock;
    const v = playerState.velocity;

    // view-relative wish direction (yaw only: looking up or down never slows walking)
    const yaw = playerState.camYaw;
    tmp.fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    tmp.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    tmp.wish.set(0, 0, 0);
    if (active) tmp.wish.addScaledVector(tmp.fwd, input.forward).addScaledVector(tmp.right, input.right);
    const moving = tmp.wish.lengthSq() > 0.001;
    if (moving) tmp.wish.normalize();
    // the portal's pull: every step is heavy, and walking away from it hardly gets anywhere
    const pull = director.pull;
    const away = moving ? Math.max(0, -(tmp.wish.x * pull.dir.x + tmp.wish.z * pull.dir.z)) : 0;
    const targetSpeed = moving ? (input.run ? MOVE.runSpeed : MOVE.walkSpeed) * director.move.speed * (1 - 0.55 * pull.resist) * (1 - 0.8 * pull.k * away) : 0;

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
      v.y = MOVE.jumpVelocity; t.sinceJump = 9; t.sinceGround = 9;
    }
    v.y -= MOVE.gravity * dt;
    const fallSpeed = -v.y;

    // let Rapier resolve the move against the world
    // …and it drags the body towards it, in lurches (not stored in the velocity: it stops the moment the pull does)
    const drag = active ? pull.drag : 0;
    tmp.move.set((v.x + pull.dir.x * drag) * dt, v.y * dt, (v.z + pull.dir.z * drag) * dt);
    c.computeColliderMovement(col, tmp.move, undefined, GROUPS.player);
    const m = c.computedMovement();
    const grounded = c.computedGrounded();
    if (v.y > 0 && m.y < tmp.move.y - 1e-4) v.y = 0;            // hit a ceiling
    if (grounded && v.y < 0) v.y = -0.5;                        // stay glued to the ground
    // note: the velocity is NOT cut when a move is blocked — Rapier's autostep needs the full step
    // (cutting it kept the player stuck at the first stair). Walls are handled by Rapier sliding.

    const p = b.translation();
    b.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });

    if (grounded && !playerState.grounded && fallSpeed > 5) playerState.landImpact = Math.min(1, (fallSpeed - 5) / 10);
    playerState.grounded = grounded;
    playerState.position.set(p.x + m.x, p.y + m.y - CENTER_Y, p.z + m.z);
    // the camera uses the distance actually travelled, so pushing into a wall reads as standing still
    playerState.speed = dt > 0 ? Math.hypot(m.x, m.z) / dt : 0;
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn[0], spawn[1] + CENTER_Y, spawn[2]]} enabledRotations={[false, false, false]}>
      <CapsuleCollider ref={collider} args={[HALF, MOVE.capsuleRadius]} collisionGroups={GROUPS.player} />
    </RigidBody>
  );
}

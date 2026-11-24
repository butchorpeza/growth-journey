/* First-person camera: the visitor's eyes, at eye height inside the invisible capsule.
   - Mouse look with adjustable sensitivity, optional inverted Y and a ±85° pitch limit: pointer lock where the
     browser allows it, otherwise hover look (the view follows the mouse; holding it near an edge keeps turning).
   - A 55° cinematic lens; restrained head bob tied to the distance actually walked, a small dip on hard landings,
     a slightly wider FOV at full sprint and a faint handheld drift. All of the motion is off with reduced motion.
   - The eye eases up and down stairs instead of snapping with each Rapier autostep.
   - The camera sits inside the capsule, which is wider than the near plane, so it can't see through walls.
   - A cinematic mode (camera rails driven by GSAP) can take over through `cameraOverride`. */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { MathUtils, PerspectiveCamera } from 'three';
import { getGame } from '../game/GameState';
import { cameraOverride } from './cameraOverride';
import { MOVE, VIEW } from './movement';
import { input, pointer } from './PlayerInput';
import { RAIL, rail } from './rail';
import { playerState } from './playerState';

const PITCH = MathUtils.degToRad(VIEW.pitchLimit);
const MAX_EYE_LAG = 0.3;   // m: the eased eye never trails the body by more than this

export function PlayerCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const s = useRef({ eyeY: NaN, phase: 0, amp: 0, dip: 0, dipTarget: 0, t: 0 });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const g = getGame();
    const still = g.settings.reducedMotion;
    const st = s.current;

    if (cameraOverride.active) {
      camera.position.copy(cameraOverride.position);
      camera.lookAt(cameraOverride.target);
      camera.fov = MathUtils.lerp(camera.fov, cameraOverride.fov, 1 - Math.exp(-4 * dt)); camera.updateProjectionMatrix();
      return;
    }

    // look input (consumed every frame). Scroll mode: the mouse glances around the path's composed angle.
    if (rail.active) {
      if (g.mode === 'playing') {
        const k = VIEW.lookSpeed * g.settings.sensitivity, inv = g.settings.invertY ? -1 : 1;
        rail.offsetYaw = MathUtils.clamp(rail.offsetYaw - input.lookX * k, -RAIL.glanceYaw, RAIL.glanceYaw);
        rail.offsetPitch = MathUtils.clamp(rail.offsetPitch - input.lookY * k * inv, -RAIL.glancePitch, RAIL.glancePitch);
      }
      playerState.camYaw = rail.baseYaw + rail.offsetYaw;
      playerState.camPitch = rail.basePitch + rail.offsetPitch;
    } else if (g.mode === 'playing') {
      const k = VIEW.lookSpeed * g.settings.sensitivity;
      const inv = g.settings.invertY ? -1 : 1;
      playerState.camYaw -= input.lookX * k;
      playerState.camPitch -= input.lookY * k * inv;
      // hover look: a cursor resting near an edge keeps turning that way (eased in across the edge zone)
      if (!document.pointerLockElement && pointer.over) {
        const z = VIEW.edgeTurn.zone, push = (v: number) => Math.sign(v) * MathUtils.smoothstep(Math.abs(v), 1 - z, 1);
        playerState.camYaw -= push(pointer.x) * VIEW.edgeTurn.yawSpeed * g.settings.sensitivity * dt;
        playerState.camPitch -= push(pointer.y) * VIEW.edgeTurn.pitchSpeed * g.settings.sensitivity * inv * dt;
      }
      playerState.camPitch = MathUtils.clamp(playerState.camPitch, -PITCH, PITCH);
    }
    input.lookX = 0; input.lookY = 0;

    // eye height, eased on steps
    const p = playerState.position;
    const targetY = p.y + VIEW.eyeHeight;
    if (Number.isNaN(st.eyeY) || !playerState.grounded) st.eyeY = targetY;
    else st.eyeY = MathUtils.clamp(MathUtils.lerp(st.eyeY, targetY, 1 - Math.exp(-VIEW.stepSmoothing * dt)), targetY - MAX_EYE_LAG, targetY + MAX_EYE_LAG);

    // head bob: one cycle per stride (two footsteps), amplitude follows the real ground speed
    const speed = playerState.grounded ? playerState.speed : 0;
    const runT = MathUtils.clamp((speed - MOVE.walkSpeed) / (MOVE.runSpeed - MOVE.walkSpeed), 0, 1);
    const stride = MathUtils.lerp(VIEW.bob.strideWalk, VIEW.bob.strideRun, runT);
    const wantAmp = still ? 0 : MathUtils.lerp(VIEW.bob.heightWalk, VIEW.bob.heightRun, runT) * MathUtils.clamp(speed / MOVE.walkSpeed, 0, 1);
    st.amp = MathUtils.lerp(st.amp, wantAmp, 1 - Math.exp(-6 * dt));
    st.phase = (st.phase + (speed * dt / stride) * Math.PI * 2) % (Math.PI * 2);
    const bobY = Math.sin(st.phase * 2) * st.amp;
    const bobX = Math.sin(st.phase) * st.amp * VIEW.bob.sway;

    // landing dip
    if (playerState.landImpact > 0) { if (!still) st.dipTarget = playerState.landImpact * VIEW.bob.landDip; playerState.landImpact = 0; }
    st.dipTarget *= Math.exp(-6 * dt);
    st.dip = MathUtils.lerp(st.dip, st.dipTarget, 1 - Math.exp(-20 * dt));

    const yaw = playerState.camYaw;
    // handheld: slow, layered drift of a fraction of a degree, like an operator holding the shot
    st.t += dt;
    const hh = still ? 0 : VIEW.handheld, t = st.t;
    const hp = (Math.sin(t * 0.63) * 0.7 + Math.sin(t * 1.71 + 1.3) * 0.3) * hh;
    const hy = (Math.sin(t * 0.47 + 0.7) * 0.75 + Math.sin(t * 1.33) * 0.25) * hh;
    camera.rotation.set(playerState.camPitch + hp, yaw + hy, Math.sin(t * 0.37) * hh * 0.6, 'YXZ');
    camera.position.set(p.x + Math.cos(yaw) * bobX, st.eyeY + bobY - st.dip, p.z - Math.sin(yaw) * bobX);

    // a touch wider at full sprint
    const fov = VIEW.fov + (still ? 0 : runT * VIEW.sprintFov);
    camera.fov = MathUtils.lerp(camera.fov, fov, 1 - Math.exp(-3 * dt));
    camera.updateProjectionMatrix();
  });
  return null;
}

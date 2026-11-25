/* First-person camera: the visitor's eyes, at eye height inside the invisible capsule.
   - Mouse look with adjustable sensitivity, optional inverted Y and a ±85° pitch limit: pointer lock where the
     browser allows it, otherwise hover look (the view follows the mouse; holding it near an edge keeps turning).
   - A 55° cinematic lens; restrained head bob tied to the distance actually walked, a small dip on hard landings,
     a slightly wider FOV at full sprint and a faint handheld drift while moving (a locked-off shot when standing
     still). All of the motion is off with reduced motion.
   - The eye eases up and down stairs instead of snapping with each Rapier autostep.
   - The camera sits inside the capsule, which is wider than the near plane, so it can't see through walls.
   - A cinematic mode (camera rails driven by GSAP) can take over through `cameraOverride`.
   - Framing (viewFocus.ts): while a discovery's panel is open the view turns to the object and zooms in, placing it
     left of the panel; in scroll mode the view eases towards each featured object as the visitor passes it (and
     zooms in a little), then hands back to the path's composed angle. */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { MathUtils, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { featuredObjects } from '../interactions/Interactable';
import { getGame } from '../game/GameState';
import { cameraOverride } from './cameraOverride';
import { MOVE, VIEW } from './movement';
import { input, pointer } from './PlayerInput';
import { RAIL, rail } from './rail';
import { playerState } from './playerState';
import { bestShot, clearShot, frameOf, viewFocus, type Frame } from './viewFocus';
import { director } from '../game/director';

const PITCH = MathUtils.degToRad(VIEW.pitchLimit);
const MAX_EYE_LAG = 0.3;   // m: the eased eye never trails the body by more than this
/** scroll mode: easing towards featured objects being passed */
// side / behind: full look while the object is within ~54° of the path's direction, none past ~83° (once it is beside
// the visitor it is let go and marked passed: no looking back). rate: turning in; release: letting go (faster)
const PASS = { near: 2.8, far: 8, weight: 1, side: 0.95, behind: 1.45, fill: 0.42, minZoom: 0.5, rate: 3.5, release: 7 };
/** E: framing the object while its panel is open (fill = share of the view height; panelPx as in the CSS) */
const INSPECT = { fill: 0.26, minFov: 34, panelPx: 460 };   // a gentle push-in: the object fills about a quarter of the view

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const tmpQ = new Quaternion(), ovQ = new Quaternion(), lookM = new Matrix4();
const ease = (t: number) => t * t * (3 - 2 * t);
function aim(ex: number, ey: number, ez: number, c: Vector3) {
  const dx = c.x - ex, dy = c.y - ey, dz = c.z - ez, flat = Math.hypot(dx, dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, flat), dist: Math.max(0.3, Math.hypot(flat, dy)), flat };
}
/** the vertical field of view (degrees) at which a sphere of `radius` at `dist` fills `fill` of the view height */
const fitFov = (radius: number, dist: number, fill: number) => MathUtils.radToDeg(2 * Math.atan(radius / (fill * dist)));

export function PlayerCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const width = useThree((s) => s.size.width), scene = useThree((s) => s.scene);
  const shots = useRef(new Map<object, { offset: Vector3; vis: number; at: number }>());   // clear views for passing glances
  const passed = useRef(new Map<object, number>());          // objects already passed → rail position when passed
  const approached = useRef(new Map<object, number>());      // objects the camera has started to look at → closest distance so far
  const group = useRef({ centre: new Vector3(), radius: 0 });
  const lastS = useRef(0);
  const eye = useRef(new Vector3());
  const s = useRef({ eyeY: NaN, phase: 0, amp: 0, dip: 0, dipTarget: 0, t: 0, passW: 0, passOn: false, passAt: new Vector3(), passR: 0.5, passShot: new Vector3(), inspW: 0, hhK: 0, lastYaw: 0, lastPitch: 0, stutterN: 0 });

  useFrame((_, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 0), 1 / 30);
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
    // the head drops at each footfall (|sin|: a sharp low point, a rounded high one), sways over the planted foot,
    // tilts with the step and nods a little; a run leans forward
    const stepWave = Math.abs(Math.sin(st.phase));
    const bobY = (stepWave - 0.64) * 2 * st.amp;
    const bobX = Math.sin(st.phase) * st.amp * VIEW.bob.sway;
    const ampK = st.amp / Math.max(1e-4, VIEW.bob.heightWalk);
    const bobRoll = Math.sin(st.phase) * VIEW.bob.roll * ampK * (1 + runT);
    const bobNod = (1 - stepWave) * VIEW.bob.nod * ampK + (still ? 0 : VIEW.bob.lean * runT * Math.min(1, speed / MOVE.runSpeed));

    // landing dip
    if (playerState.landImpact > 0) { if (!still) st.dipTarget = playerState.landImpact * VIEW.bob.landDip; playerState.landImpact = 0; }
    st.dipTarget *= Math.exp(-6 * dt);
    st.dip = MathUtils.lerp(st.dip, st.dipTarget, 1 - Math.exp(-20 * dt));

    let yaw = playerState.camYaw, pitch = playerState.camPitch;
    let fov = VIEW.fov + (still ? 0 : runT * VIEW.sprintFov);           // a touch wider at full sprint
    const ex = p.x, ey = st.eyeY, ez = p.z;

    // scroll mode: ease towards the featured object being passed (beside or ahead, never behind), zoom in a little
    let want = 0, best: Frame | null = null, bestShotOff: Vector3 | null = null;
    const cands: { fr: Frame; w: number }[] = [];
    if (rail.active && g.mode === 'playing' && !director.active) {
      const now = performance.now(), back = rail.s < lastS.current - 1e-4;   // scrolling backwards
      lastS.current = rail.s;
      for (const f of featuredObjects()) {
        const fr = frameOf(f.obj), a = aim(ex, ey, ez, fr.centre);
        if (a.flat > PASS.far) { approached.current.delete(f.obj); continue; }
        const off = Math.abs(wrap(a.yaw - rail.baseYaw));
        if (back && off > PASS.behind) approached.current.delete(f.obj);   // retreating from it: start afresh
        const closest = approached.current.get(f.obj);
        if (closest !== undefined && a.flat < closest) approached.current.set(f.obj, a.flat);
        // passed once it goes by the visitor's side; looked at again only after scrolling back past it
        const was = passed.current.get(f.obj);
        if (was !== undefined) { if (rail.s < was - 0.5 || a.flat > PASS.far + 2) passed.current.delete(f.obj); else continue; }
        if (off > PASS.behind) {
          // only an object that was actually looked at counts as passed (not one that was behind from the start)
          // (only when walking on past it: scrolling back past an object doesn't count as having passed it)
          // and only once it is falling behind: walked on, and further away than at the closest approach
          if (closest !== undefined && !back && a.flat > closest + 0.6) { passed.current.set(f.obj, rail.s); approached.current.delete(f.obj); }
          continue;
        }
        let w = (1 - MathUtils.smoothstep(a.flat, PASS.near, PASS.far)) * (1 - MathUtils.smoothstep(off, PASS.side, PASS.behind));
        if (w <= want) continue;
        // a clear view of it: the camera slides aside / up past a post or a bench back, as the E camera does
        // (a few BVH rays, re-checked every 0.4 s); only an object that can't be seen from anywhere near is skipped
        let shot = shots.current.get(f.obj);
        if (!shot || now - shot.at > 400) { shot = { ...bestShot(scene, eye.current.set(ex, ey, ez), fr, f.obj), at: now }; shots.current.set(f.obj, shot); }
        w *= MathUtils.smoothstep(shot.vis, 0.15, 0.5);
        if (w > 0.25 && !approached.current.has(f.obj)) approached.current.set(f.obj, a.flat);
        if (w > 0.15) cands.push({ fr, w });
        if (w > want) { want = w; best = fr; bestShotOff = shot.offset; }
      }
    }
    // neighbours (the cat on the sungka's bench) are framed together with the main one, so neither is left out
    if (best) {
      const gc = group.current; gc.centre.copy(best.centre); gc.radius = best.radius;
      for (const c of cands) {
        if (c.fr === best) continue;
        const d = c.fr.centre.distanceTo(gc.centre);
        if (d > 2.2 || d + c.fr.radius <= gc.radius) continue;
        const r = (d + gc.radius + c.fr.radius) / 2;                       // the sphere holding both
        gc.centre.lerp(c.fr.centre, (r - gc.radius) / Math.max(d, 1e-3)); gc.radius = r;
      }
      best = gc;
    }
    if (best) {
      if (!st.passOn || st.passW < 0.02) st.passAt.copy(best.centre); else st.passAt.lerp(best.centre, 1 - Math.exp(-PASS.rate * dt));
      st.passShot.lerp(bestShotOff!, 1 - Math.exp(-PASS.rate * dt));
      st.passR = best.radius; st.passOn = true;
    } else st.passShot.multiplyScalar(Math.exp(-PASS.release * dt));
    const target = want * PASS.weight;
    st.passW += (target - st.passW) * (1 - Math.exp(-(target < st.passW ? PASS.release : PASS.rate) * dt));
    viewFocus.passing = st.passOn ? st.passW : 0;              // the rail slows while the visitor passes it (RailController)
    let shotX = 0, shotY = 0, shotZ = 0;
    if (st.passOn && st.passW > 0.002) {
      const kk = ease(Math.min(1, st.passW / PASS.weight));
      shotX = st.passShot.x * kk; shotY = st.passShot.y * kk; shotZ = st.passShot.z * kk;
      const a = aim(ex + shotX, ey + shotY, ez + shotZ, st.passAt), k = kk * PASS.weight;
      yaw = rail.baseYaw + wrap(a.yaw - rail.baseYaw) * k + rail.offsetYaw;
      pitch = rail.basePitch + (a.pitch - rail.basePitch) * k + rail.offsetPitch;
      const zoomTo = MathUtils.clamp(fitFov(st.passR, a.dist, PASS.fill), fov * PASS.minZoom, fov);
      fov = MathUtils.lerp(fov, zoomTo, k / PASS.weight);
    } else if (!best) st.passOn = false;

    // a scripted moment (game/director.ts): the view drawn to a point, a zoom, and a brief stutter
    const sh = director.shot;
    if (sh.weight > 0.001) {
      const a = aim(ex + shotX, ey + shotY, ez + shotZ, sh.target), k = Math.min(1, sh.weight);
      yaw += wrap(a.yaw - yaw) * k;
      pitch += (a.pitch - pitch) * k;
    }
    fov *= sh.zoom;
    if (sh.stutter > 0) {
      // a hesitation: a fraction of a degree of jitter, and every few frames the view holds for a frame or two
      st.stutterN = (st.stutterN + 1) % 5;
      if (st.stutterN < 2) { yaw = st.lastYaw; pitch = st.lastPitch; }
      yaw += (Math.sin(st.t * 61) + Math.sin(st.t * 97)) * 0.0035 * sh.stutter;
      pitch += Math.sin(st.t * 83) * 0.0025 * sh.stutter;
    }

    // the portal's pull: each lurch jerks the head forward and down a little, and tips the horizon
    let yankRoll = 0;
    if (director.pull.yank > 0.001 && g.settings.cameraFx && !still) {
      const yk = director.pull.yank;
      pitch -= yk * 0.085; yankRoll = yk * 0.035 * Math.sin(st.t * 3.1 + 0.4);
      fov *= 1 - 0.05 * yk;
    }

    // E: frame the object while its panel is open, left of the panel on the right
    const inspecting = g.mode === 'reading' && !!viewFocus.inspect;
    st.inspW += ((inspecting ? 1 : 0) - st.inspW) * (1 - Math.exp(-3 * dt));
    if (viewFocus.inspect && st.inspW > 0.002) {
      const fr = viewFocus.inspect, k = ease(st.inspW);
      // a clear view: slide the camera aside / forward / up if something stands in front of the object
      if (!fr.shot) fr.shot = clearShot(scene, eye.current.set(ex, ey, ez), fr, fr.obj);
      shotX += (fr.shot.x - shotX) * k; shotY += (fr.shot.y - shotY) * k; shotZ += (fr.shot.z - shotZ) * k;
      const a = aim(ex + shotX, ey + shotY, ez + shotZ, fr.centre);
      const zoom = MathUtils.clamp(fitFov(fr.radius, a.dist, INSPECT.fill), INSPECT.minFov, VIEW.fov);
      const panel = camera.aspect > 1 ? Math.min(0.5, Math.min(INSPECT.panelPx, width) / width) : 0;   // share of the width
      const shift = Math.atan(panel * Math.tan(MathUtils.degToRad(zoom) / 2) * camera.aspect);           // object at NDC x = -panel
      yaw += wrap(a.yaw - shift - yaw) * k;
      pitch += (a.pitch - pitch) * k;
      fov = MathUtils.lerp(fov, zoom, k);
    } else if (!inspecting) viewFocus.inspect = null;

    // handheld: slow, layered drift of a fraction of a degree, like an operator holding the shot, but only while the
    // visitor moves or looks around: standing still, it settles over ~1 s into a locked-off shot, so nothing shimmers
    const turning = Math.abs(wrap(yaw - st.lastYaw)) + Math.abs(pitch - st.lastPitch) > 2e-4;
    st.lastYaw = yaw; st.lastPitch = pitch;
    const moving = playerState.speed > 0.05 || turning;
    st.hhK += ((moving ? 1 : 0) - st.hhK) * (1 - Math.exp(-(moving ? 2.5 : 1.8) * dt));
    st.t += dt;
    const hh = still ? 0 : VIEW.handheld * st.hhK, t = st.t;
    const hp = (Math.sin(t * 0.63) * 0.7 + Math.sin(t * 1.71 + 1.3) * 0.3) * hh;
    const hy = (Math.sin(t * 0.47 + 0.7) * 0.75 + Math.sin(t * 1.33) * 0.25) * hh;
    // camera shake (the portal's pull): layered noise in pitch, yaw and roll, plus a vertical jolt
    const sk = g.settings.cameraFx ? director.shake * (still ? 0.25 : 1) : 0;
    const shP = sk * (Math.sin(t * 23.1) * 0.6 + Math.sin(t * 37.7 + 1.1) * 0.4) * 0.012;
    const shY = sk * (Math.sin(t * 19.3 + 2.3) * 0.6 + Math.sin(t * 41.9) * 0.4) * 0.012;
    const shR = sk * Math.sin(t * 13.7 + 0.7) * 0.02;
    camera.rotation.set(pitch + hp - bobNod + shP, yaw + hy + shY, Math.sin(t * 0.37) * hh * 0.6 + bobRoll + shR + yankRoll, 'YXZ');
    camera.position.set(p.x + Math.cos(yaw) * bobX + shotX, st.eyeY + bobY - st.dip + shotY + sk * Math.sin(t * 29.3) * 0.01, p.z - Math.sin(yaw) * bobX + shotZ);

    // a full takeover (the wake-up, the fall into the portal), blended over the player's own view
    const ov = director.override;
    if (ov.weight > 0.001) {
      const k = Math.min(1, ov.weight);
      tmpQ.copy(camera.quaternion);
      camera.position.lerp(ov.pos, k);
      lookM.lookAt(ov.pos, ov.look, ov.up); ovQ.setFromRotationMatrix(lookM);
      camera.quaternion.copy(tmpQ).slerp(ovQ, k);
      if (sk > 0) { camera.rotateZ(shR); camera.rotateX(shP); }
      fov = MathUtils.lerp(fov, ov.fov, k);
    }

    camera.fov = MathUtils.lerp(camera.fov, fov, 1 - Math.exp(-3 * dt));
    camera.updateProjectionMatrix();
  });
  return null;
}

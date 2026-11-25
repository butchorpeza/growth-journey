/* The creature, from its first appearance to the escape (scripted, not combat AI: it follows one route and keeps a
   fair distance; the point is to get away, not to fight it).
   1. First sighting: the first time the visitor steps into the corridor, the lights at its far (east) end start to
      fail, and in the flicker something very tall stands down there, quite still. The lights go out; when they come
      back it is gone. Nothing else happens yet.
   2. The pursuit begins abruptly once the visitor is well along the corridor towards the stairs: two or three
      footsteps behind, then every light dies at once; when they snap back it is already there, close, rearing up and
      roaring (its enraged animation, a loud sting), the view snapping round to it. It runs; RUN (hold Shift / keep
      scrolling). Following horror chase design (Outlast 2's designers: no warning, the player outmatched, the
      pattern broken once): it stays close behind, and at the top of the stairs the view jerks back once to it.
   3. The chase, in one straight line: along the corridor, straight down the stairs, along the tunnel to the gate. It keeps about 5-6 m
      behind a visitor who runs, closes in on one who doesn't, and surges on the stairs. It never passes through a
      wall or gets in front. Caught: a jump scare (it lunges into the face with a scream), black, and the chase restarts
   from where it began.
   4. Through the gate, onto the ledge outside: it slams shut, and it hits the bars from the other side, stands there
      a moment, and is gone into the dark.
   About 10-15 s, short and clear (this is a website first). Skip (button / Enter) goes straight through the gate. Esc pauses it. Camera effects off:
   no shake and no turn back; reduced motion: no shake. */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { MathUtils, PointLight, Vector3 } from 'three';
import { audio } from '../../audio/AudioEngine';
import { caption } from '../../audio/narrator';
import { director, resetShot } from '../../game/director';
import { getGame, setGame, updateSave } from '../../game/GameState';
import { playerState } from '../../player/playerState';
import { rail } from '../../player/rail';
import { creature } from './Creature';
import { escapeDoor } from './Descent';
import { sconces, SCONCES } from './House';
import { CHASE_ROUTE, ESCAPE, FY, HOUSE } from './layout';

/** the route as segments, with lengths and cumulative distance */
function makeRoute() {
  const pts = CHASE_ROUTE.map((p) => new Vector3(...p));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = cum[cum.length - 1];
  const at = (s: number, out: Vector3, dir?: Vector3) => {
    s = MathUtils.clamp(s, 0, total);
    let i = 1; while (i < pts.length - 1 && cum[i] < s) i++;
    const k = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
    out.copy(pts[i - 1]).lerp(pts[i], k);
    if (dir) dir.copy(pts[i]).sub(pts[i - 1]).normalize();
    return out;
  };
  const tmp = new Vector3(), seg = new Vector3();
  /** nearest point on the route: distance along it, and how far off it (horizontal + a penalty for height) */
  const project = (p: Vector3) => {
    let best = { s: 0, d: Infinity };
    for (let i = 1; i < pts.length; i++) {
      seg.copy(pts[i]).sub(pts[i - 1]); const l2 = seg.lengthSq();
      const k = MathUtils.clamp(tmp.copy(p).sub(pts[i - 1]).dot(seg) / l2, 0, 1);
      tmp.copy(pts[i - 1]).addScaledVector(seg, k);
      const d = Math.hypot(p.x - tmp.x, p.z - tmp.z) + Math.abs(p.y - tmp.y) * 0.5;
      if (d < best.d) best = { s: cum[i - 1] + k * Math.sqrt(l2), d };
    }
    return best;
  };
  /** where the stairs are along the route (it surges there) */
  return { at, project, total, stairs: [cum[1], cum[2]] as [number, number] };
}

type Phase = 'wait' | 'sighting' | 'armed' | 'stalk' | 'chase' | 'caught' | 'escaped' | 'done';
const SIGHT_AT = 14.2 - CHASE_ROUTE[0][0];   // route distance where it stands the first time (x 14.2)
const STALK_FROM = 19.5;                      // the visitor's route distance that starts the pursuit (x ≈ 4.7)

export function Pursuit() {
  const route = useMemo(makeRoute, []);
  const camera = useThree((st) => st.camera);
  const scareLight = useMemo(() => new PointLight('#dfe8ff', 0, 4, 2), []);
  const st = useRef({ phase: 'wait' as Phase, t: 0, sc: 0, sp: 0, stepT: 0, bursts: 0, railAt: 0, retry: false, growlT: 1, glanced: false, glanceT: 9 });
  const tmp = useMemo(() => ({ p: new Vector3(), d: new Vector3() }), []);

  useEffect(() => () => {
    creature.visible = false; audio.heartbeat(0); director.chase.on = false; rail.cap = Infinity;
    if (director.active === 'pursuit') { resetShot(); director.active = null; director.skip = null; }
    setGame({ hint: null });
  }, []);

  const place = (s: number, faceDir = 1) => {
    const r = route; r.at(s, creature.pos, tmp.d);
    creature.yaw = Math.atan2(tmp.d.x * faceDir, tmp.d.z * faceDir);
  };
  const panOf = (x: number, z: number) => {
    const p = playerState.position, yaw = playerState.camYaw;
    const dx = x - p.x, dz = z - p.z, rx = Math.cos(yaw) * dx - Math.sin(yaw) * dz;      // to the right of the view
    return MathUtils.clamp(rx / Math.max(1, Math.hypot(dx, dz)), -1, 1);
  };
  const escape = () => {
    const s = st.current;
    s.phase = 'escaped'; s.t = 0;
    escapeDoor.shut = true; audio.slam(); director.chase.on = false;
    setGame({ hint: null });
    director.skip = null;
  };
  const skip = () => {
    if (rail.active) { rail.s = rail.target = rail.length; }
    else playerState.teleport = new Vector3(ESCAPE.x + 1.2, CHASE_ROUTE[CHASE_ROUTE.length - 1][1] + 0.05, ESCAPE.z);
    st.current.sc = route.total - 0.5; place(st.current.sc);
    escape();
  };

  useFrame((_, rawDt) => {
    const g = getGame(), s = st.current;
    if (g.mode !== 'playing') return;
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    const p = playerState.position, proj = route.project(p);
    if (proj.d < 3) s.sp = proj.s;
    const camFx = g.settings.cameraFx, calm = g.settings.reducedMotion;
    s.t += dt;
    const inCorridor = p.y > FY - 0.5 && p.z < HOUSE.corridor.z0 && p.z > HOUSE.corridor.z1;

    switch (s.phase) {
      case 'wait':
        if (inCorridor && Math.abs(p.x) < 3.5) { s.phase = 'sighting'; s.t = 0; void caption('shadows-descent'); place(SIGHT_AT, -1); creature.anim = 'idle'; creature.speed = 0; creature.visible = true; audio.whisper(0.3, 0.05); audio.creatureSound('howl', { rate: 0.55, gain: 0.35, dark: 0.55, pan: 0.2 }); }
        break;
      case 'sighting': {
        // the far lights fail, it stands there in the flicker, the dark takes it
        // (a scroller moves fast: hold them a little way into the corridor until it comes; a walker gets a few seconds)
        if (rail.active && s.sp > STALK_FROM && rail.cap === Infinity) rail.cap = rail.s + 0.3;
        const east = SCONCES.map(([x]) => x > 6);
        sconces.dim = SCONCES.map((_, i) => {
          if (!east[i]) return 1;
          if (s.t < 2.2) return Math.sin(s.t * 31 + i * 5) * Math.sin(s.t * 13) > -0.1 ? 1 : 0.08;
          if (s.t < 3.2) return 0;
          return 1;
        });
        if (s.t > 2.35) creature.visible = false;
        if (s.t > 3.3) { s.phase = 'armed'; s.t = 0; sconces.dim = SCONCES.map(() => 1); }
        break;
      }
      case 'armed':
        if (rail.active && s.sp > STALK_FROM && rail.cap === Infinity) rail.cap = rail.s + 0.3;
        if ((s.t > 5 || rail.active) && inCorridor && s.sp > STALK_FROM && s.sp < route.stairs[0]) {
          s.phase = 'stalk'; s.t = 0; s.railAt = rail.s; s.retry = false; rail.cap = Infinity;
          director.active = 'pursuit'; director.skip = skip; setGame({ cinematic: 'pursuit', prompt: null });
        }
        break;
      case 'stalk': {
        // abrupt, not announced (Outlast-style): two or three footsteps behind, then every light in the corridor dies
        // at once; when they snap back on it is already there, close, rearing up and roaring, and then it comes
        const dark0 = s.retry ? -1 : 1.1, dark1 = s.retry ? -1 : 1.75, appear = s.retry ? 0 : 1.75, go = s.retry ? 1.2 : 3.1;
        const behind = s.retry ? 10 : 8.5;
        const cx = CHASE_ROUTE[0][0] + Math.max(0, s.sp - behind);
        if (!s.retry && s.t < dark0) { s.stepT -= dt; if (s.stepT <= 0) { s.stepT = 0.5; audio.creatureStep(panOf(cx, -67.3), 0.35 + s.t * 0.35); } }
        const blackout = s.t > dark0 && s.t < dark1;
        if (!s.retry && s.t > dark0 && s.t - dt <= dark0) { audio.thud(0.6); audio.creatureSound('breath', { rate: 0.55, gain: 0.9, pan: panOf(cx, -67.3) }); }
        sconces.dim = SCONCES.map(() => (blackout ? 0 : s.t > dark1 && s.t < go ? (Math.random() < 0.85 ? 1 : 0.2) : 1));
        if (s.t >= appear && !creature.visible) {
          s.sc = Math.max(0, s.sp - behind); place(s.sc); creature.speed = 0; creature.visible = true;
          creature.anim = s.retry ? 'idle' : 'enrage';
          // the sting: a deep roar and a shriek, loud, the instant the lights come back
          audio.creatureSound('roar_01', { rate: 0.6, gain: 1.3, pan: panOf(creature.pos.x, creature.pos.z) });
          audio.creatureSound('scream_02', { rate: 0.72, gain: 0.7, pan: panOf(creature.pos.x, creature.pos.z), delay: 0.08 });
          audio.thud(0.9);
        }
        // the view snaps round to it (a fast turn, held), the walk held while it rears up
        const w = camFx && !s.retry ? 0.95 * MathUtils.smoothstep(s.t, appear, appear + 0.25) * (1 - MathUtils.smoothstep(s.t, go - 0.15, go + 0.5)) : 0;
        director.shot.target.copy(creature.head); director.shot.weight = w; director.shot.zoom = 1 - 0.2 * w;
        director.shake = camFx && !calm && s.t > appear && s.t < appear + 0.4 ? 0.22 : 0;
        director.move.lock = s.t > appear && s.t < go - 0.1;
        if (s.t >= go) {
          s.phase = 'chase'; s.t = 0; s.bursts = 0; s.stepT = 0; s.glanced = false;
          creature.anim = 'run'; audio.screech(panOf(creature.pos.x, creature.pos.z), 0.6);
          director.chase.on = rail.active; director.chase.momentum = 1.6;          // scroll mode: tap Space to run
          setGame({ hint: 'run' });
        }
        break;
      }
      case 'chase': {
        // the bulbs burst one after another, west to east, as it comes; the last two stay (dimly)
        while (s.bursts < SCONCES.length - 2 && s.t > s.bursts * 0.22) { sconces.burst[s.bursts] = true; audio.burst(panOf(SCONCES[s.bursts][0], SCONCES[s.bursts][1])); s.bursts++; }
        sconces.dim = SCONCES.map(() => 0.55);
        // the view hands back to the visitor as it starts to run, and the walk is theirs again
        director.shot.weight *= Math.exp(-5 * dt); director.shot.zoom = 1 - (1 - director.shot.zoom) * Math.exp(-5 * dt);
        // the pattern breaks once: at the top of the stairs the view jerks back for a moment and it is right there
        if (!s.glanced && s.sp > route.stairs[0] - 0.6) { s.glanced = true; s.glanceT = 0; audio.growl(panOf(creature.pos.x, creature.pos.z), 1.0); }
        if (s.glanced && s.glanceT < 0.75) { s.glanceT += dt; if (camFx) { director.shot.target.copy(creature.head); director.shot.weight = 0.85 * Math.sin(Math.min(1, s.glanceT / 0.75) * Math.PI); } }
        director.move.lock = false;
        const gap = s.sp - s.sc;
        // close behind (outmatched, never out of earshot): it settles about 4-5 m behind a visitor who runs
        let v = MathUtils.clamp(4.0 + (gap - 4.5) * 0.9, 2.6, 7.4);
        if (s.sc > route.stairs[0] - 1 && s.sc < route.stairs[1]) v += 0.9;       // it comes down the stairs fast
        s.sc = Math.min(s.sc + v * dt, route.total - 0.3);
        // (run or sprint with some slack between them: switching back and forth every frame restarted the clip and
        // made it stutter)
        place(s.sc); creature.speed = v;
        if (creature.anim !== 'sprint' && v > 5.8) creature.anim = 'sprint'; else if (creature.anim === 'sprint' && v < 4.6) creature.anim = 'run'; else if (creature.anim !== 'sprint' && creature.anim !== 'run') creature.anim = 'run';
        // its steps, in time with its stride
        s.stepT -= dt; if (s.stepT <= 0) { s.stepT = 0.36; audio.creatureStep(panOf(creature.pos.x, creature.pos.z), MathUtils.clamp(1.1 - gap / 14, 0.25, 1), creature.pos.y < FY - 1 ? 'concrete' : 'wood'); }
        s.growlT -= dt; if (s.growlT <= 0) { s.growlT = 1.6 + Math.random() * 2.2; audio.growl(panOf(creature.pos.x, creature.pos.z), MathUtils.clamp(1.0 - gap / 16, 0.25, 0.9), creature.pos.y < FY - 1 ? 0.15 : 0); }
        director.shake = camFx && !calm ? 0.03 + 0.1 * (1 - MathUtils.smoothstep(gap, 2.5, 8)) : 0;   // a little, never much
        director.fx.vignette = 0.2 + 0.3 * (1 - MathUtils.smoothstep(gap, 2, 9));
        audio.heartbeat(gap < 5 ? 150 : 115);
        if (gap < 1.1) {
          s.phase = 'caught'; s.t = 0; audio.scream(); audio.heartbeat(0); setGame({ hint: null }); director.chase.on = false;
        } else if (p.y < FY - 1 && p.x > ESCAPE.x && Math.abs(p.z - ESCAPE.z) < 3) escape();
        break;
      }
      case 'caught': {
        // the jump scare: it is suddenly right in front of the face, lunging, the view locked on its face (the eyes,
        // the jaw dropping open), a scream; then black,
        // and back to where it began, and it comes again (reduced motion: no lunge, straight to black)
        director.move.speed = 1; director.move.lock = true;
        const lunge = !calm && s.t < 0.62;
        if (lunge) {
          camera.getWorldDirection(tmp.d); tmp.d.y = 0; tmp.d.normalize();
          const dist = MathUtils.lerp(1.9, 0.78, MathUtils.smoothstep(s.t, 0.0, 0.45));
          creature.pos.copy(camera.position).addScaledVector(tmp.d, dist); creature.pos.y = camera.position.y - creature.headHeight + 0.1;
          creature.yaw = Math.atan2(-tmp.d.x, -tmp.d.z); creature.anim = 'jumpscare'; creature.speed = 0; creature.visible = true;
          // the view is pulled onto its face and held there; the jaw gapes
          creature.mouth = MathUtils.smoothstep(s.t, 0.02, 0.2);
          director.shot.target.copy(creature.head).y -= 0.05; director.shot.weight = 1; director.shot.zoom = 0.9;
          director.shake = camFx ? 0.15 : 0.05; director.flash = 0.35 * (1 - MathUtils.smoothstep(s.t, 0, 0.3)); director.scare = 1;
          director.blackout = 0;
          // a faint, cold, stuttering light on it: the eyes and the teeth show, the rest stays black
          scareLight.position.copy(camera.position).addScaledVector(tmp.d, 0.3).setY(camera.position.y - 0.85);   // from below: a face lit from under the chin
          scareLight.intensity = Math.random() < 0.75 ? 2.6 : 0.5;   // just enough to catch the teeth and the shape: it stays a black thing
        } else {
          scareLight.intensity = 0; creature.mouth = 0; director.shot.weight = 0; director.shot.zoom = 1;
          creature.visible = false; director.shake = 0; director.flash = 0; director.scare = Math.max(0, director.scare - dt * 3);
          director.blackout = s.t > 1.9 ? 0 : 1;
        }
        if (s.t > 1.9) {
          if (rail.active) { rail.s = rail.target = s.railAt; }
          else { route.at(STALK_FROM, tmp.p); playerState.teleport = tmp.p.clone().setY(tmp.p.y + 0.05); playerState.camYaw = -Math.PI / 2; playerState.camPitch = 0; }
          s.sp = STALK_FROM; sconces.burst = SCONCES.map(() => false);
          s.phase = 'stalk'; s.t = 0; s.retry = true; creature.visible = false; director.scare = 0; director.move.lock = false;
        }
        break;
      }
      case 'escaped': {
        // it reaches the gate and stops; it hits the bars; then the dark has it
        director.shake = 0; director.move.speed = 1; director.shot.weight = 0;
        director.fx.vignette = 0.2 * (1 - MathUtils.smoothstep(s.t, 1, 4));
        // it throws itself at the bars, stands there breathing, then sinks into the dark: it fades to black and
        // dissolves (never popping out of sight)
        if (s.sc < route.total - 0.3) { s.sc = Math.min(route.total - 0.3, s.sc + 6 * dt); place(s.sc); creature.speed = 6; }
        else { creature.anim = 'idle'; creature.speed = 0; }
        creature.fade = MathUtils.smoothstep(s.t, 2.0, 3.4);
        if (s.t > 1.1 && s.t - dt <= 1.1) audio.thud(1.0);
        if (s.t > 1.9 && s.t - dt <= 1.9) { audio.thud(0.6); audio.creatureSound('breath', { rate: 0.5, gain: 0.6, dark: 0.3 }); }
        if (s.t > 3.5) { creature.visible = false; creature.fade = 0; }
        audio.heartbeat(s.t < 4 ? 90 : 0);
        if (s.t > 4.5) {
          s.phase = 'done';
          resetShot(); director.active = null; director.fx.vignette = 0;
          sconces.dim = SCONCES.map(() => 1);
          setGame({ cinematic: null });
          updateSave({ seen: [...new Set([...getGame().save.seen, 'shadows-pursuit'])] });
        }
        break;
      }
      default:
    }
  });
  return <primitive object={scareLight} />;
}

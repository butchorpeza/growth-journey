/* Chapter 01's scripted moments: the opening (waking up in bed) and the first sight of the portal from the gate (the
   pull towards it and the fall in are PortalPull.tsx). Each one has an id, where it triggers (a window along the walk, from the visitor's real position on the
   path), what must have happened first, its voice line (data/narration.ts), a camera script (game/director.ts) and
   a completion state. Rules:
   - one at a time; a moment whose window the visitor has left is dropped (nobody is ever forced to stop);
   - it works the same in scroll mode and walking freely (WASD): the trigger is the visitor's progress along the route,
     from the scroll path, or else their real position projected onto the same route (off it by more than ~4 m,
     nothing starts);
   - each plays once per visit (the opening is offered again on the next visit, with a skip button);
   - nothing of the portal plays before the gate beat, which needs the opening;
   - E panels can't open during one (InteractionManager checks `director.active`);
   - the camera is only borrowed for a few seconds and eased back; with camera effects off (pause menu) only the
     voice plays, and with reduced motion there is no stutter and the zooms are halved;
   - pausing (Esc) pauses the moment and its voice; Skip (button or Enter) ends it at once. */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import { audio } from '../../audio/AudioEngine';
import { narrate, stop as stopNarration } from '../../audio/narrator';  // (the voice is switched off: NARRATION_ENABLED)
import { director, resetShot } from '../../game/director';
import { getGame, setGame, updateSave } from '../../game/GameState';
import { playerState } from '../../player/playerState';
import { rail } from '../../player/rail';
import { PORTAL, SURVIVAL_PATH } from './path';

type Fx = typeof director.fx;
interface Cam { pos: Vector3; look: Vector3; up?: Vector3; fov?: number; weight: number }
interface Frame { look?: Vector3; weight?: number; zoom?: number; stutter?: number; speed?: number; lock?: boolean; fx?: Partial<Fx>; cam?: Cam; eyes?: { open: number; blur: number } }
interface Moment {
  id: string;
  narration?: string;
  /** seconds into the moment when the voice starts */
  voiceAt?: number;
  /** the trigger: true while the visitor is where it may start */
  window: (s: number) => boolean;
  requires?: (done: Set<string>) => boolean;
  /** shortest length (s); it also lasts until its voice has finished */
  length: number;
  skippable?: boolean;
  /** the camera and effects at time t (s) into the moment */
  script?: (t: number) => Frame;
  /** effects left in place afterwards (the portal grows stronger beat by beat) */
  after?: Partial<Fx>;
}

const ease = (a: number, b: number, t: number) => MathUtils.smootherstep(t, a, b);
const PORTAL_AT = new Vector3(PORTAL.at[0], 2.7, PORTAL.at[1]);
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** a camera path through look points [time, point], with a weight that rises at the start and falls at the end */
function pan(points: [number, Vector3][], t: number, out = new Vector3()) {
  let i = 0; while (i + 1 < points.length && t >= points[i + 1][0]) i++;
  const [t0, a] = points[i], [t1, b] = points[Math.min(i + 1, points.length - 1)];
  return out.copy(a).lerp(b, t1 > t0 ? MathUtils.smootherstep(t, t0, t1) : 0);
}
/** a value through keys [time, value], eased between them */
function keys(points: [number, number][], t: number) {
  let i = 0; while (i + 1 < points.length && t >= points[i + 1][0]) i++;
  const [t0, a] = points[i], [t1, b] = points[Math.min(i + 1, points.length - 1)];
  return a + (b - a) * (t1 > t0 ? MathUtils.smootherstep(t, t0, t1) : 0);
}

/* the wake-up, on the bed in house A (the mattress and pillow from world.glb): lying on the back with the head on the
   pillow, looking up at the roof (the top of the view is towards the head); the eyes open heavily and close again,
   open, blink, and stay open while the blur clears; the head turns to the room; sitting up, looking at the oil lamp;
   standing beside the bed; a couple of steps hand over to the visitor's own eyes at the start of the path. */
// (the floral curtain hangs from x −1.58 to −0.78 along the bed's foot, so sitting up and standing face the open
// side of the bed, +z, and the lamp is seen past the curtain's end)
const BED = {
  lie: v(-2.6, 0.45, -1.45), sit: v(-2.15, 0.98, -1.08), stand: v(-2.1, 1.68, 0.0),
  roof: v(-1.35, 2.7, -1.55), room: v(-1.75, 0.95, 1.6), lamp: v(-0.75, 0.95, -0.42),
  upLie: v(-1, 0, 0), upSide: v(-0.42, 0.91, 0).normalize(), upright: v(0, 1, 0),
};
const wake = { pos: new Vector3(), look: new Vector3(), up: new Vector3() };
/** the start screen takes ~2 s to fade away after the click: the eyes stay shut behind it until then */
const WAKE_DELAY = 1.8;
function wakeUp(time: number): Frame {
  const w = wake, t = Math.max(0, time - WAKE_DELAY);
  pan([[0, BED.lie], [5.3, BED.lie], [7.1, BED.sit], [7.6, BED.sit], [9.0, BED.stand]], t, w.pos);
  w.pos.y += Math.sin(t * 1.5) * 0.006 * (1 - ease(5, 6, t));                         // breathing, lying down
  if (t > 9) w.pos.y -= Math.abs(Math.sin((t - 9) * 5.2)) * 0.022;                     // the first steps
  pan([[0, BED.roof], [3.9, BED.roof], [5.0, BED.room], [8.0, BED.room], [9.4, BED.lamp]], t, w.look);
  w.up.copy(BED.upLie).lerp(BED.upSide, ease(3.9, 5.0, t)).lerp(BED.upright, ease(5.3, 6.9, t)).normalize();
  return {
    lock: t < 10.2,
    // (the times above are after the delay)
    cam: { pos: w.pos, look: w.look, up: w.up, fov: 58, weight: 1 - ease(9.0, 10.6, t) },
    // two heavy openings and a quick blink before the eyes stay open
    eyes: {
      open: keys([[0, 0], [0.9, 0], [1.6, 0.38], [1.95, 0.32], [2.3, 0], [2.6, 0], [3.1, 0.72], [3.25, 0.7], [3.42, 0.12], [3.55, 0.15], [4.2, 1]], t),
      blur: keys([[0, 16], [1.6, 13], [2.6, 9], [3.4, 6], [5.2, 0]], t),
    },
  };
}

const MOMENTS: Moment[] = [
  {
    // the opening: waking up in bed (above); Skip goes straight to the start of the path
    id: 'opening', length: 10.8 + WAKE_DELAY, skippable: true,
    window: (s) => s < 1.5,
    script: wakeUp,
  },
  {
    // through the gate onto the path: the view turns to the far portal, zooms in, holds, and gives control back
    id: 'portal-notice', length: 6, skippable: true,
    window: (s) => s > 11.5 && s < 17,
    requires: (done) => done.has('opening'),
    script: (t) => ({
      lock: t < 5.2,
      look: PORTAL_AT,
      weight: ease(0.2, 2.4, t) * (1 - ease(4.4, 6, t)),
      zoom: 1 - 0.45 * ease(0.6, 2.8, t) * (1 - ease(4.2, 5.8, t)),
      fx: { portal: 0.15 * ease(1, 3, t) },
    }),
    after: { portal: 0.15 },
  },
  // walking on down the road, the portal pulls (PortalPull.tsx), once every discovery has been found
];

export function Cinematics() {
  const done = useRef(new Set<string>());
  const run = useRef<{ m: Moment; t: number; voiced: boolean; voiceDone: boolean } | null>(null);
  const base = useRef<Fx>(director.base);
  // the route as a line of points every 25 cm, for walking freely: progress = the nearest point's distance along it
  const route = useMemo(() => {
    const c = new CatmullRomCurve3(SURVIVAL_PATH.map((w) => new Vector3(w.at[0], 0, w.at[1])), false, 'centripetal');
    const len = c.getLength(), n = Math.ceil(len / 0.25);
    return { pts: c.getSpacedPoints(n), step: len / n };
  }, []);
  const progress = () => {
    if (rail.active) return rail.s;
    const p = playerState.position; let best = -1, bd = 16;            // within 4 m of the route
    route.pts.forEach((q, i) => { const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; best = i; } });
    return best < 0 ? -1 : best * route.step;
  };

  const finish = (skipped: boolean) => {
    const r = run.current; if (!r) return;
    run.current = null;
    if (skipped) stopNarration();
    done.current.add(r.m.id);
    Object.assign(base.current, r.m.after ?? {});
    resetShot(); Object.assign(director.fx, base.current);
    director.active = null; director.skip = null;
    if (r.m.id === 'opening') { setGame({ storyStarted: true }); updateSave({ seen: [...new Set([...getGame().save.seen, 'opening'])] }); }
    setGame({ cinematic: null });
  };

  useEffect(() => {
    // behind the start screen the eyes are already shut and the camera is on the pillow, so the first frame of the
    // visit is the dark of closed eyes, not the room
    const f = wakeUp(0), o = director.override;
    o.pos.copy(f.cam!.pos); o.look.copy(f.cam!.look); o.up.copy(f.cam!.up!); o.fov = f.cam!.fov!; o.weight = 1;
    director.eyes.open = 0; director.eyes.blur = 16;
  }, []);
  useEffect(() => () => { resetShot(); director.active = null; director.skip = null; Object.assign(director.fx, { vignette: 0, aberration: 0, portal: 0, unease: 0 }); Object.assign(director.base, { vignette: 0, aberration: 0, portal: 0, unease: 0 }); audio.setUnease(0); }, []);

  useFrame((_, rawDt) => {
    const g = getGame();
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    if (!run.current) {
      if (g.mode !== 'playing' || g.reading || director.active) return;   // (the fall into the portal: PortalPull)
      const s = progress();
      if (s < 0) return;                                                 // off the route: nothing starts
      for (const m of MOMENTS) {
        if (done.current.has(m.id)) continue;
        if (!m.window(s)) {
          // already past the start (walked on before it could play): the opening counts as played
          if (m.id === 'opening' && s >= 1.5) { done.current.add('opening'); setGame({ storyStarted: true }); resetShot(); }
          continue;
        }
        if (m.requires && !m.requires(done.current)) continue;
        run.current = { m, t: 0, voiced: !m.narration, voiceDone: !m.narration };
        director.active = m.id;
        director.skip = m.skippable ? () => finish(true) : null;
        setGame({ cinematic: m.id, prompt: null });
        break;
      }
      if (!run.current) return;
    }
    const r = run.current;
    if (g.mode === 'paused') return;                                    // the narrator pauses with the game (GameHUD)
    r.t += dt;
    if (!r.voiced && r.t >= (r.m.voiceAt ?? 0)) {
      r.voiced = true;
      void narrate(r.m.narration!).then(() => { if (run.current === r) r.voiceDone = true; });
    }
    // the camera script: only with camera effects on; reduced motion keeps it gentler (no stutter, half the zoom)
    const f = r.m.script?.(r.t) ?? {};
    const camera = g.settings.cameraFx, calm = g.settings.reducedMotion;
    director.shot.weight = camera ? f.weight ?? 0 : 0;
    if (f.look) director.shot.target.copy(f.look);
    director.shot.zoom = camera ? 1 - (1 - (f.zoom ?? 1)) * (calm ? 0.5 : 1) : 1;
    director.shot.stutter = camera && !calm ? f.stutter ?? 0 : 0;
    director.move.lock = camera ? !!f.lock : false;
    director.move.speed = f.speed ?? 1;
    // a full camera takeover (the wake-up) is the scene itself, so it plays with camera effects off too
    if (f.cam) {
      const o = director.override;
      o.pos.copy(f.cam.pos); o.look.copy(f.cam.look); o.up.copy(f.cam.up ?? BED.upright); o.fov = f.cam.fov ?? 55; o.weight = f.cam.weight;
      director.move.lock = !!f.lock;
    }
    if (f.eyes) { director.eyes.open = f.eyes.open; director.eyes.blur = calm ? Math.min(f.eyes.blur, 4) : f.eyes.blur; }
    const fx = { ...base.current, ...(f.fx ?? {}) };
    director.fx.portal = Math.max(base.current.portal, fx.portal);
    director.fx.vignette = camera ? fx.vignette : 0;
    director.fx.aberration = camera && !calm ? fx.aberration : 0;
    director.fx.unease = fx.unease;
    audio.setUnease(director.fx.unease);
    if (r.t >= r.m.length && r.voiceDone) finish(false);
  });
  return null;
}

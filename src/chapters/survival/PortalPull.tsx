/* The portal's pull, and the fall into it: the end of Chapter 01.
   - It wakes only once every discovery has been found (the six E panels) and the story has begun; until then the
     portal just burns at the end of the road.
   - Walking down the road towards it, the pull grows (from ~30 m): every step gets heavier, walking away barely
     gets anywhere and scrolling back is refused, and in between it drags the visitor on in lurches (a yank every
     1–3 s, closer together as it gets stronger), each one jerking the head forward with a low rumble. The camera
     shakes, the view is drawn to the portal, the edges darken and fringe, the sound goes far away.
   - Close to it (~6 m) the visitor is taken: a cutscene. The camera is dragged in with two last struggles against it,
     the shake and the field of view grow, the horizon tips, a red flash, black, and straight on into Chapter 02
     (no panel, no text: its opening fades in from the black).
   - Before everything has been found there is no pull, but walking right up to the portal (the end of the scroll
     path) still takes the visitor through.
   - Camera effects off (pause menu): no shake, no lurching view, no fringe (the pull on the walk stays; the fall plays
     as a plain camera move). Reduced motion: the shake is a quarter as strong. Esc pauses it; Skip / Enter cuts to
     the end of the fall. */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, Vector3 } from 'three';
import { audio } from '../../audio/AudioEngine';
import { director } from '../../game/director';
import { discover, getGame, setGame, updateSave } from '../../game/GameState';
import { playerState } from '../../player/playerState';
import { PORTAL } from './path';
import { preloadShadows } from '../shadows/materials';

/** the discoveries that have to be found before the portal pulls */
export const PULL_NEEDS = ['survival-lamp', 'survival-photograph', 'survival-k9', 'survival-cat', 'survival-games', 'survival-motorbike', 'survival-computer'];
/** takeAt: the pull takes the visitor from this close; enter: anyone walking this close goes through (the end of the
 *  scroll path is 4.3 m from it) */
const PULL = { from: 30, full: 7, takeAt: 6.2, enter: 4.7 };
const CENTRE = new Vector3(PORTAL.at[0], 2.5, PORTAL.at[1]);
const ease = (a: number, b: number, t: number) => MathUtils.smootherstep(t, a, b);
function keys(points: [number, number][], t: number) {
  let i = 0; while (i + 1 < points.length && t >= points[i + 1][0]) i++;
  const [t0, a] = points[i], [t1, b] = points[Math.min(i + 1, points.length - 1)];
  return a + (b - a) * (t1 > t0 ? MathUtils.smootherstep(t, t0, t1) : 0);
}
const FALL_END = 4.6;

export function PortalPull() {
  const camera = useThree((s) => s.camera);
  const st = useRef({ next: 1.5, yt: 9, amp: 0, spent: false, fall: -1, from: new Vector3(), fromLook: new Vector3(), dir: new Vector3() });

  useEffect(() => () => {
    const p = director.pull; p.k = 0; p.yank = 0; p.drag = 0; p.resist = 0;
    director.shake = 0; director.flash = 0;
    // (the black stays when the chapter is changing: Chapter 02's opening fades in from it)
    if (getGame().chapter === 'survival') director.blackout = 0;
  }, []);

  // Chapter 02's models start downloading once the visitor is on their way (the story has begun)
  const preloaded = useRef(false);
  useFrame((_, rawDt) => {
    const g = getGame(), s = st.current, pl = director.pull;
    if (!preloaded.current && g.storyStarted) { preloaded.current = true; preloadShadows(); }
    if (g.mode === 'paused' || g.mode === 'loading' || g.mode === 'intro') return;
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    const cam = g.settings.cameraFx, calm = g.settings.reducedMotion;

    // the fall
    if (s.fall >= 0) { fall(dt, cam); return; }

    const p = playerState.position;
    const dx = PORTAL.at[0] - p.x, dz = PORTAL.at[1] - p.z, d = Math.hypot(dx, dz);
    const ready = !s.spent && g.storyStarted && PULL_NEEDS.every((id) => g.save.discovered.includes(id));
    const free = g.mode === 'playing' && !director.active;
    const want = ready && free ? 1 - MathUtils.smoothstep(d, PULL.full, PULL.from) : 0;
    pl.k += (want - pl.k) * (1 - Math.exp(-(want > pl.k ? 1.2 : 3) * dt));
    if (pl.k < 1e-3 && want === 0) pl.k = 0;
    pl.dir.set(dx, 0, dz).divideScalar(Math.max(d, 1e-3));

    // the lurches: a sharp rise, a slower release
    s.next -= dt; s.yt += dt;
    if (pl.k > 0.12 && s.next <= 0 && free) {
      s.yt = 0; s.amp = 0.55 + 0.45 * Math.random();
      s.next = MathUtils.lerp(3, 1.1, pl.k) * (0.7 + 0.6 * Math.random());
      audio.thunder(0, 0.08 + 0.22 * pl.k * s.amp);                       // a low rumble with each one
    }
    pl.yank = (s.yt < 0.09 ? s.yt / 0.09 : Math.exp(-(s.yt - 0.09) * 4.5)) * s.amp * pl.k;
    pl.drag = free ? pl.k * (0.3 + 2.6 * pl.yank) : 0;
    pl.resist = pl.k;

    if (!director.active) {
      director.shake = pl.k * 0.28 + pl.yank * 0.75;
      director.shot.target.copy(CENTRE);
      director.shot.weight = cam ? 0.45 * MathUtils.smoothstep(pl.k, 0.05, 1) : 0;
      director.shot.zoom = cam ? 1 - 0.12 * pl.k : 1;
      const b = director.base, fx = director.fx;
      fx.portal = b.portal + (1 - b.portal) * pl.k;
      fx.vignette = cam ? b.vignette + 0.36 * pl.k + 0.12 * pl.yank : 0;
      fx.aberration = cam && !calm ? 0.0025 * pl.k + 0.006 * pl.yank : 0;
      fx.unease = b.unease + (0.85 - b.unease) * pl.k;
      audio.setUnease(fx.unease);
    }

    // close enough: it takes the visitor (pulled in from further once everything has been found; otherwise when
    // they walk right up to it)
    if (free && !s.spent && (ready ? d < PULL.takeAt : d < PULL.enter)) {
      s.fall = 0;
      s.from.copy(camera.position);
      camera.getWorldDirection(s.dir); s.fromLook.copy(camera.position).addScaledVector(s.dir, 6);
      s.dir.subVectors(CENTRE, s.from);
      director.active = 'portal-fall';
      director.skip = () => { if (s.fall >= 0 && s.fall < FALL_END - 0.5) s.fall = FALL_END - 0.5; };
      setGame({ cinematic: 'portal-fall', prompt: null });
    }
  });

  function fall(dt: number, cam: boolean) {
    const s = st.current, pl = director.pull, o = director.override, t = (s.fall += dt);
    // dragged in: two last struggles (slipping back a little), then the rush
    // (it stops a hand's breadth short of the vortex, which then fills the view: never through to the far side)
    const u = keys([[0, 0], [0.9, 0.06], [1.25, 0.2], [1.55, 0.15], [2.05, 0.38], [2.35, 0.31], [3.05, 0.62], [3.75, 0.9], [4.6, 0.94]], t);
    o.pos.copy(s.from).addScaledVector(s.dir, u);
    o.pos.y += Math.sin(t * 2.3) * 0.04 * (1 - ease(2.8, 3.6, t));
    o.look.copy(s.fromLook).lerp(CENTRE, ease(0, 1.1, t));
    const roll = 0.55 * ease(2.9, 4.4, t) * (cam ? 1 : 0.3);
    o.up.set(Math.sin(roll) * s.dir.z, Math.cos(roll), -Math.sin(roll) * s.dir.x).normalize();
    o.fov = keys([[0, 55], [1, 52], [3, 66], [3.8, 104]], t);
    o.weight = ease(0, 0.9, t);
    director.move.lock = true;
    pl.drag = 0;
    // the jolts land with the lurches in the path
    const jolt = Math.max(0, Math.exp(-Math.abs(t - 1.2) * 9), Math.exp(-Math.abs(t - 2.0) * 9), Math.exp(-Math.abs(t - 2.95) * 7));
    pl.yank = jolt;
    director.shake = 0.55 + 0.45 * ease(0, 1.2, t) + 0.6 * jolt;
    if (Math.abs(t - 1.2) < dt || Math.abs(t - 2.0) < dt || Math.abs(t - 2.95) < dt) audio.thunder(0, 0.35);
    director.flash = keys([[3.3, 0], [3.6, 0.9], [4.2, 0]], t);
    director.blackout = ease(3.55, 4.2, t);
    const fx = director.fx;
    fx.portal = 1; fx.vignette = cam ? 0.4 + 0.3 * ease(2, 3.7, t) : 0; fx.aberration = cam ? 0.004 + 0.01 * ease(2.5, 3.8, t) : 0; fx.unease = 1;
    audio.setUnease(1);
    if (t < FALL_END) return;

    // through: straight on to Chapter 02, in the black (its opening fades in from it: chapters/shadows)
    s.fall = -1; s.spent = true;
    o.weight = 0; o.up.set(0, 1, 0);
    pl.k = 0; pl.yank = 0; pl.drag = 0; pl.resist = 0;
    director.shake = 0; director.flash = 0; director.blackout = 1;
    director.active = 'chapter-transition'; director.skip = null;
    Object.assign(fx, { vignette: 0, aberration: 0, portal: 0, unease: 0 }); audio.setUnease(0);
    const save = getGame().save;
    discover('survival-exit');
    updateSave({ chapter: 'shadows', completed: [...new Set([...save.completed, 'survival' as const])] });
    setGame({ chapter: 'shadows', cinematic: 'chapter-transition', prompt: null, reading: null });
  }

  return null;
}

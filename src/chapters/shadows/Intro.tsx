/* The opening of Chapter 02. The visitor arrives out of the black they fell into through the portal:
   1. black; the wind and the sea come in first;
   2. eyes opening, lying in the dead grass of the shore meadow, the night sky overhead; a heavy blink, then they stay
      open while the blur clears;
   3. the head turns to the gate; getting up onto one knee, then standing, facing the iron gate and the avenue;
   4. the view lifts slowly over the gate to the estate on its rise; lightning: the mansion stands out against the lit
      cloud, and for the length of the flash something tall stands beside the avenue beyond the gate (Estate.tsx
      Figure), gone when the light goes;
   5. the chapter title: THE SHADOWS, "The things that shaped me, even when I didn't understand them." (GameHUD ChapterCard);
   6. the view eases back to the gate and the visitor has it (about 11 s in all; Skip / Enter at any time).
   Pausing (Esc) holds it. With reduced motion there is no lightning flash and the blur is lighter. */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, Vector3 } from 'three';
import { director, resetShot } from '../../game/director';
import { getGame, setGame, updateSave } from '../../game/GameState';
import { lightningState } from '../../rendering/Lightning';
import { GATE, MANSION, SHADOWS_SPAWN, groundHeight } from './layout';

const ease = (a: number, b: number, t: number) => MathUtils.smootherstep(t, a, b);
function keys(points: [number, number][], t: number) {
  let i = 0; while (i + 1 < points.length && t >= points[i + 1][0]) i++;
  const [t0, a] = points[i], [t1, b] = points[Math.min(i + 1, points.length - 1)];
  return a + (b - a) * (t1 > t0 ? MathUtils.smootherstep(t, t0, t1) : 0);
}
function path(points: [number, Vector3][], t: number, out: Vector3) {
  let i = 0; while (i + 1 < points.length && t >= points[i + 1][0]) i++;
  const [t0, a] = points[i], [t1, b] = points[Math.min(i + 1, points.length - 1)];
  return out.copy(a).lerp(b, t1 > t0 ? MathUtils.smootherstep(t, t0, t1) : 0);
}

const [sx, , sz] = SHADOWS_SPAWN.p, h = (x: number, z: number) => groundHeight(x, z);
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
const POS: [number, Vector3][] = [
  [0, v(1.0, h(1, 37.2) + 0.3, 37.2)], [3.9, v(1.0, h(1, 37.2) + 0.3, 37.2)],
  [5.3, v(0.6, h(0.6, 35.8) + 0.95, 35.8)], [6.8, v(sx, h(sx, sz) + 1.62, sz + 0.4)], [10.8, v(sx, h(sx, sz) + 1.62, sz - 0.6)],
];
const LOOK: [number, Vector3][] = [
  [0, v(2.5, 9, 31)], [2.9, v(2.5, 9, 31)], [4.4, v(0.2, 1.3, GATE.z)], [6.8, v(0, 2.0, GATE.z)],
  [8.2, v(0, 10, MANSION.z)], [9.6, v(0, 9.5, MANSION.z)], [11.0, v(0, 1.95, GATE.z)],
];
const LENGTH = 11.6, CARD_AT = 7.9, CARD_FOR = 8.5;

export function ShadowsIntro({ figure }: { figure: { current: boolean } }) {
  const st = useRef({ t: -1, done: false, card: -1, struck: false });
  const tmp = useRef({ pos: new Vector3(), look: new Vector3() });

  const showCard = () => { const s = st.current; if (s.card < 0) { s.card = 0; setGame({ titleCard: 'shadows' }); } };
  const finish = () => {
    const s = st.current; if (s.done) return;
    s.done = true; figure.current = false;
    resetShot();
    director.blackout = 0; director.active = null; director.skip = null;
    Object.assign(director.fx, { vignette: 0, aberration: 0, portal: 0, unease: 0 });
    showCard();
    setGame({ cinematic: null, storyStarted: true });
    updateSave({ seen: [...new Set([...getGame().save.seen, 'shadows-intro'])] });
  };

  // from the first frame: black, eyes shut, the camera already lying in the grass
  useEffect(() => {
    director.blackout = 1; director.eyes.open = 0; director.eyes.blur = 12;
    const o = director.override; o.pos.copy(POS[0][1]); o.look.copy(LOOK[0][1]); o.up.set(0.55, 0.83, 0).normalize(); o.fov = 60; o.weight = 1;
    director.move.lock = true;
    return () => { if (!st.current.done) { resetShot(); director.blackout = 0; director.active = null; director.skip = null; } setGame({ titleCard: null }); };
  }, []);

  useFrame((_, rawDt) => {
    const g = getGame(), s = st.current;
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    // the title card's own clock (it outlives the opening when the visitor skips)
    if (s.card >= 0 && g.mode !== 'paused') { s.card += dt; if (s.card > CARD_FOR) { s.card = -2; setGame({ titleCard: null }); } }
    if (s.done) return;
    if (g.mode !== 'playing') return;                          // the start screen (a direct visit), or paused
    if (s.t < 0) {
      s.t = 0;
      director.active = 'shadows-intro'; director.skip = finish;
      setGame({ cinematic: 'shadows-intro', prompt: null });
    }
    const t = (s.t += dt), calm = g.settings.reducedMotion;
    director.blackout = 1 - ease(0.4, 3.0, t);
    director.eyes.open = keys([[0, 0], [1.1, 0], [1.7, 0.5], [2.0, 0.44], [2.3, 0.04], [2.7, 0.04], [3.4, 1]], t);
    director.eyes.blur = keys([[0, 12], [2.0, 9], [3.4, 5], [5.2, 0]], t) * (calm ? 0.35 : 1);
    const o = director.override, w = tmp.current;
    path(POS, t, w.pos); path(LOOK, t, w.look);
    if (t < 4) w.pos.y += Math.sin(t * 1.4) * 0.012;              // breathing, still on the ground
    if (t > 3.9 && t < 6.8) w.pos.y += Math.sin((t - 3.9) * 5.5) * 0.02 * (1 - ease(6, 6.8, t));   // the effort of getting up
    o.pos.copy(w.pos); o.look.copy(w.look);
    o.up.set(0.55, 0.83, 0).lerp(new Vector3(0, 1, 0), ease(2.9, 5.0, t)).normalize();
    o.fov = keys([[0, 60], [6.8, 55], [8.7, 33], [9.6, 33], [10.9, 55]], t);
    o.weight = 1 - ease(10.0, 11.5, t);
    director.move.lock = t < 10.6;
    director.fx.vignette = 0.18 * (1 - ease(9.5, 11.5, t));
    // the reveal: lightning, and the figure by the tree for as long as the light lasts
    if (!s.struck && t > 7.4) { s.struck = true; if (!calm) lightningState.strike(); }
    figure.current = t > 7.0 && t < 9.8;
    if (t >= CARD_AT) showCard();
    if (t >= LENGTH) finish();
  });
  return null;
}

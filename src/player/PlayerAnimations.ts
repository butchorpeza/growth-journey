/* Small animation state machine on top of THREE.AnimationMixer: cross-fades between states instead of switching,
   and scales walk/run playback to the real ground speed so the feet don't slide. Missing clips fall back to idle. */
import { AnimationAction, LoopOnce, LoopRepeat } from 'three';
import type { CharacterConfig } from './characterConfig';

export type MoveState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'interact';

export class PlayerAnimations {
  private current: AnimationAction | null = null;
  state: MoveState = 'idle';
  constructor(private actions: Record<string, AnimationAction | null>, private cfg: CharacterConfig) {
    Object.values(actions).forEach((a) => a && (a.loop = LoopRepeat));
    const once = (k: keyof CharacterConfig['clips']) => { const n = cfg.clips[k]; const a = n ? actions[n] : null; if (a) { a.loop = LoopOnce; a.clampWhenFinished = true; } };
    once('jump'); once('land'); once('interact');
    this.set('idle', 0);
  }

  private action(s: MoveState): AnimationAction | null {
    const name = this.cfg.clips[s] ?? (s === 'fall' || s === 'jump' || s === 'land' || s === 'interact' ? this.cfg.clips.idle : undefined);
    return (name && this.actions[name]) || null;
  }

  set(s: MoveState, fade = 0.25) {
    if (s === this.state && this.current) return;
    const next = this.action(s);
    this.state = s;
    if (!next || next === this.current) return;
    next.enabled = true;
    next.reset().setEffectiveWeight(1).play();
    if (this.current) next.crossFadeFrom(this.current, fade, true); else next.fadeIn(fade);
    this.current = next;
  }

  /** keep stride matched to ground speed */
  sync(speed: number) {
    if (!this.current) return;
    if (this.state === 'walk') this.current.timeScale = Math.max(0.6, speed / this.cfg.walkClipSpeed);
    else if (this.state === 'run') this.current.timeScale = Math.max(0.7, speed / this.cfg.runClipSpeed);
    else this.current.timeScale = 1;
  }
}

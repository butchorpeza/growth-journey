/* Small animation state machine on top of THREE.AnimationMixer. It cross-fades between states instead of switching,
   and scales walk/run playback to the real ground speed so the feet don't slide.
   Looping states: idle, walk, run, fall. One-shots: jump (holds its last frame while rising), land, interact,
   lookAround (an idle variation). A one-shot keeps playing until it ends; moving cuts land/interact/lookAround short.
   Missing clips fall back to idle. */
import { AnimationAction, LoopOnce, LoopRepeat } from 'three';
import type { CharacterConfig } from './characterConfig';

export type MoveState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'interact' | 'lookAround';
const ONE_SHOT: MoveState[] = ['jump', 'land', 'interact', 'lookAround'];
const LOCOMOTION: MoveState[] = ['walk', 'run'];
const IDLE_VARIATION_AFTER = 9; // s of standing still before the character looks around

export class PlayerAnimations {
  private current: AnimationAction | null = null;
  private lockLeft = 0;   // s the current one-shot still owns the body
  private idleTime = 0;
  state: MoveState = 'idle';

  constructor(private actions: Record<string, AnimationAction | null>, private cfg: CharacterConfig) {
    Object.values(actions).forEach((a) => a && (a.loop = LoopRepeat));
    for (const s of ONE_SHOT) {
      const a = this.action(s, false);
      if (a) { a.loop = LoopOnce; a.clampWhenFinished = true; }
    }
    this.set('idle', 0);
  }

  private action(s: MoveState, fallback = true): AnimationAction | null {
    const name = this.cfg.clips[s] ?? (fallback && s !== 'walk' && s !== 'run' ? this.cfg.clips.idle : undefined);
    return (name && this.actions[name]) || null;
  }

  private start(next: AnimationAction, fade: number, timeScale = 1) {
    next.enabled = true;
    next.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).play();
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, fade, true); else next.fadeIn(fade);
    this.current = next;
  }

  /** request a state; ignored while a one-shot owns the body (unless the request is allowed to interrupt it) */
  set(s: MoveState, fade = 0.25, force = false) {
    if (s === this.state && this.current && !force) return;
    if (this.lockLeft > 0) {
      const interruptible = this.state === 'land' || this.state === 'interact' || this.state === 'lookAround';
      const airborne = s === 'jump' || s === 'fall';
      if (!(airborne || (interruptible && LOCOMOTION.includes(s)))) return;
    }
    const next = this.action(s);
    this.state = s;
    this.lockLeft = 0;
    if (!next) return;
    const timeScale = s === 'interact' ? 1.35 : 1;
    if (ONE_SHOT.includes(s) && s !== 'jump') this.lockLeft = Math.max(0.2, next.getClip().duration / timeScale - fade);
    if (next === this.current) { next.reset().play(); return; }
    this.start(next, fade, timeScale);
  }

  /** play a one-shot from the start even if it is the current state (e.g. a second interaction) */
  play(s: MoveState, fade = 0.2) {
    this.lockLeft = 0;
    this.set(s, fade, true);
  }

  /** per frame: stride matched to ground speed, one-shot timers, idle variation */
  update(dt: number, speed: number) {
    if (this.lockLeft > 0) {
      this.lockLeft -= dt;
      if (this.lockLeft <= 0) { this.lockLeft = 0; this.set('idle', 0.35, true); }   // one-shot done: back to idle
    }
    this.idleTime = this.state === 'idle' ? this.idleTime + dt : 0;
    if (this.idleTime > IDLE_VARIATION_AFTER && this.cfg.clips.lookAround) { this.idleTime = 0; this.set('lookAround', 0.5); }
    if (!this.current) return;
    if (this.state === 'walk') this.current.timeScale = Math.max(0.6, speed / this.cfg.walkClipSpeed);
    else if (this.state === 'run') this.current.timeScale = Math.max(0.7, speed / this.cfg.runClipSpeed);
  }
}

/* The cinematic director's shared state, written by the sequence runner (chapters/survival/Cinematics.tsx) and read
   by the systems it steers. Plain values, updated every frame:
   - shot: where the camera is drawn to (PlayerCamera blends towards it by `weight`), a zoom factor on the field of
     view, and a brief stutter (a camera hesitation: tiny jitter and a dropped frame or two);
   - move: 1 = normal; lower slows the walk (a hesitation), `lock` holds it for a short scripted look;
   - fx: extra vignette and colour fringe (PostFX), the portal's glow (Portal) and the muffled, far-away sound
     (AudioEngine.setUnease).
   A sequence never holds the visitor for more than a few seconds; everything eases back when it ends. */
import { Vector3 } from 'three';

export const director = {
  /** the sequence playing, if any (also in GameState.cinematic for the HUD) */
  active: null as string | null,
  shot: { target: new Vector3(), weight: 0, zoom: 1, stutter: 0 },
  move: { speed: 1, lock: false },
  fx: { vignette: 0, aberration: 0, portal: 0, unease: 0 },
  /** set by the runner while a sequence can be skipped */
  skip: null as null | (() => void),
  /** the photo being looked at on the photo wall (the camera moves up to it), -1 = none */
  photo: -1,
  /** the effects each finished beat leaves behind (the portal grows stronger beat by beat) */
  base: { vignette: 0, aberration: 0, portal: 0, unease: 0 },
  /** a full camera takeover blended over the player's view by `weight` (the wake-up, the fall into the portal);
   *  `up` tilts the horizon (lying on the bed, the top of the view is towards the head) */
  override: { pos: new Vector3(), look: new Vector3(), up: new Vector3(0, 1, 0), fov: 55, weight: 0 },
  /** the eyes (Eyes.tsx): open 0 = shut … 1 = open; blur in px */
  eyes: { open: 1, blur: 0 },
  /** the portal's pull (PortalPull.tsx): k 0…1 how hard; yank 0…1 a lurch forward (decays); drag m/s towards the
   *  portal (RailController, Player); dir the horizontal direction to it; resist 0…1 how much the walk is slowed */
  pull: { k: 0, yank: 0, drag: 0, dir: new Vector3(), resist: 0 },
  /** the chase in scroll mode (Pursuit.tsx, RailController): the path carries the visitor on by itself, and each tap
   *  of Space adds momentum (m/s) that fades; scrolling is not needed */
  chase: { on: false, momentum: 0 },
  /** camera shake 0…1 (PlayerCamera) */
  shake: 0,
  /** full-screen fades (Eyes.tsx): black 0…1, a red flash 0…1 */
  blackout: 0,
  flash: 0,
  /** 0…1: the screen going to a warm white (the end of Chapter 02) */
  whiteout: 0,
  /** 0…1: the jump scare when the creature catches the visitor (Eyes.tsx shows its face) */
  scare: 0,
};

export function resetShot() {
  director.shot.weight = 0; director.shot.zoom = 1; director.shot.stutter = 0;
  director.override.weight = 0; director.override.up.set(0, 1, 0); director.eyes.open = 1; director.eyes.blur = 0; director.shake = 0;
  director.move.speed = 1; director.move.lock = false;
}

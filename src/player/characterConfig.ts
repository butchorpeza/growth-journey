/* Which character model the player uses and how its clips map to movement states.
   TEMPORARY: the three.js "Soldier" sample (Mixamo rig, Idle/Walk/Run only) until the final realistic character
   is produced (see docs/CHARACTER_PLAN.md). Swapping characters = changing this file. */

export interface CharacterConfig {
  url: string;
  scale: number;
  yawOffset: number;        // radians: rotate the model so it faces +Z (the controller's "forward")
  height: number;           // metres, for the capsule
  clips: Partial<Record<'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'interact' | 'walkBack' | 'turnLeft' | 'turnRight' | 'lookAround', string>>;
  walkClipSpeed: number;    // m/s the walk clip was authored at (keeps feet from sliding)
  runClipSpeed: number;
  temporary: boolean;
}

export const character: CharacterConfig = {
  url: `${import.meta.env.BASE_URL}models/characters/temp-soldier.glb`,
  scale: 1,
  yawOffset: Math.PI,
  height: 1.8,
  clips: { idle: 'Idle', walk: 'Walk', run: 'Run' },
  walkClipSpeed: 1.45,
  runClipSpeed: 4.6,
  temporary: true,
};

export const MOVE = {
  walkSpeed: 1.7,      // m/s
  runSpeed: 4.6,
  accel: 10,           // how fast we reach the target speed (1/s)
  decel: 12,
  airControl: 0.35,
  gravity: 22,         // m/s² (stronger than 9.81 feels better for a game character)
  jumpVelocity: 6.2,
  coyoteTime: 0.12,    // s after leaving a ledge when a jump still counts
  jumpBuffer: 0.12,    // s a jump press is remembered before landing
  turnRate: 12,        // facing smoothing (1/s)
  maxSlope: 46,        // degrees the character can walk up
  stepHeight: 0.38,    // metres the character steps over (stairs)
  capsuleRadius: 0.32,
};

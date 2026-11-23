/* Which character model the player uses and how its clips map to movement states.
   Swapping characters = changing this file. */

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
  // MPFB2 (MakeHuman) character, CC0, built by scripts/blender/build_character.py (outfit: Chapter 01 "survival")
  url: `${import.meta.env.BASE_URL}models/characters/player-survival.glb`,
  // Clips: Mixamo motion capture (Y Bot skeleton), baked onto this character in Blender by
  // scripts/blender/bake_mixamo_clips.py and embedded in the GLB. Clip speeds measured from the baked foot plants.
  scale: 1,
  yawOffset: 0,
  height: 1.75,
  clips: {
    idle: 'Idle', walk: 'Walk', run: 'Run', jump: 'JumpStart', fall: 'Fall', land: 'Land', interact: 'Interact',
    lookAround: 'LookAround', walkBack: 'WalkBack', turnLeft: 'TurnLeft', turnRight: 'TurnRight',
  },
  walkClipSpeed: 1.1,
  runClipSpeed: 4.1,
  temporary: false,
};

export const MOVE = {
  walkSpeed: 1.45,     // m/s (an unhurried walk)
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

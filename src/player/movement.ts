/* Tuning for the first-person controller and camera. There is no player model: the visitor is the camera, carried
   by an invisible physics capsule. */

export const MOVE = {
  height: 1.75,        // m, capsule height (feet to top of head)
  capsuleRadius: 0.32,
  walkSpeed: 1.6,      // m/s (an unhurried walk)
  runSpeed: 4.4,
  accel: 10,           // how fast we reach the target speed (1/s)
  decel: 12,
  airControl: 0.35,
  gravity: 22,         // m/s² (stronger than 9.81 feels better in games)
  jumpVelocity: 6.2,
  coyoteTime: 0.12,    // s after leaving a ledge when a jump still counts
  jumpBuffer: 0.12,    // s a jump press is remembered before landing
  maxSlope: 46,        // degrees the visitor can walk up
  stepHeight: 0.38,    // metres stepped over automatically (stairs)
};

export const VIEW = {
  eyeHeight: 1.62,     // m above the feet
  fov: 55,             // vertical degrees: a cinematic lens (~32 mm full-frame), narrower than a game's 70°
  sprintFov: 3,        // extra degrees at full sprint (subtle)
  handheld: 0.0018,    // radians: faint operator drift (off with reduced motion)
  pitchLimit: 85,      // degrees up / down
  lookSpeed: 0.0022,   // radians per mouse pixel at sensitivity 1
  edgeTurn: {          // hover look (mouse not locked): holding the cursor near an edge keeps turning
    zone: 0.15,        // outer fraction of the screen on each side
    yawSpeed: 1.9,     // rad/s at the very edge (scaled by sensitivity)
    pitchSpeed: 0.8,
  },
  bob: {               // head motion of a real walk, off with reduced motion
    strideWalk: 1.45,  // m travelled per full bob cycle (two steps)
    strideRun: 2.4,
    heightWalk: 0.034, // m vertical amplitude (the head drops at each footfall)
    heightRun: 0.055,
    sway: 0.5,         // lateral amplitude as a fraction of the vertical one
    roll: 0.012,       // radians of side-to-side tilt per step at a walk (doubled at a run)
    nod: 0.006,        // radians the head nods down at each footfall
    lean: 0.035,       // radians the view leans forward at full run
    landDip: 0.06,     // m the view dips on a hard landing
  },
  stepSmoothing: 14,   // 1/s: eases the eye up stairs instead of snapping with each autostep
  interactReach: 2.6,  // m from the eye to an interactable surface
};

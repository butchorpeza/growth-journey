/* Per-frame player data shared by the controller, the camera and the interaction system (mutable, no React). */
import { Vector3 } from 'three';

export const playerState = {
  position: new Vector3(0, 1, 0),   // feet position (world)
  velocity: new Vector3(),
  grounded: true,
  speed: 0,                          // horizontal speed actually travelled, m/s
  landImpact: 0,                     // 0…1, set on landing (fall speed), consumed by the camera's landing dip
  camYaw: 0, camPitch: 0,            // view angles (radians); yaw 0 looks down -Z
  teleport: null as null | Vector3,  // set to move the player instantly (checkpoints)
};

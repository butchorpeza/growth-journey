/* Per-frame player data shared by the controller, the camera and the interaction manager (mutable, no React). */
import { Vector3 } from 'three';

export const playerState = {
  position: new Vector3(0, 1, 0),   // feet position (world)
  velocity: new Vector3(),
  grounded: true,
  speed: 0,                          // horizontal speed, m/s
  yaw: 0,                            // character facing
  camYaw: 0.6, camPitch: 0.28,       // camera orbit angles (radians)
  camDistance: 3.6,
  teleport: null as null | Vector3,  // set to move the player instantly (checkpoints)
  action: null as null | 'interact', // one-shot body animation requested by gameplay (consumed by the Player)
  faceTarget: null as null | Vector3, // turn to face this point (e.g. the object being inspected)
};

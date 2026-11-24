/* Scroll-mode state, shared by RailController (moves along the path) and PlayerCamera (aims the view).
   The path is a smooth curve through authored waypoints; each waypoint also has a look-at point, so the camera
   carries composed, cinematic angles as you scroll. The visitor can glance around with the mouse: `offsetYaw` /
   `offsetPitch` are added to the path's aim, clamped, and drift back to the composed angle while moving. */

export interface RailWaypoint {
  /** position on the ground (x, z); the height is found by raycasting the scene at load */
  at: [number, number];
  /** what the camera looks at from here (world x, y, z) */
  look: [number, number, number];
}

export const rail = {
  active: false,
  s: 0, target: 0, length: 1,     // metres along the path
  baseYaw: 0, basePitch: 0,       // the composed angle from the path
  offsetYaw: 0, offsetPitch: 0,   // the visitor's glance
};

export const RAIL = {
  metresPerPixel: 0.0055,         // scroll distance → path distance (a 100 px wheel notch ≈ 0.55 m)
  keySpeed: 1.8,                  // m/s with W / S / arrow keys in scroll mode
  maxSpeed: 3.2,                  // m/s: scrolling hard still moves at a walking-to-jogging pace
  follow: 3.2,                    // 1/s: how quickly the camera catches up with the scroll target
  glanceYaw: 0.75, glancePitch: 0.38,   // radians: how far the mouse can turn the view from the path's aim
  recentre: 0.6,                  // 1/s: glance drifts back to the composed angle while moving
};

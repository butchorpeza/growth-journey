/* Chapter 01 scroll-mode path: from waking up inside house A, past the oil lamp and the old photograph, out
   through the front door (it opens as you reach it) and the yard gate, past the sungka board, then along the mud
   road (traced from the terrain's mud layer) to where it leaves the village. Each waypoint aims the camera. */
import type { RailWaypoint } from '../../player/rail';

export const SURVIVAL_PATH: RailWaypoint[] = [
  { at: [-1.7, 0.75], look: [-0.75, 1.0, -0.42] },     // wake up: the table and the oil lamp
  { at: [-0.4, 0.3], look: [2.35, 1.1, -1.75] },       // the cabinet with the photograph
  { at: [1.2, 0.1], look: [2.35, 1.2, -1.75] },        // close to the photograph
  { at: [1.05, 1.3], look: [1.0, 1.4, 8] },            // turn to the door
  { at: [1.0, 3.4], look: [0.9, 1.5, 12] },            // out through the door
  { at: [0.8, 7.4], look: [3.0, 1.5, 18] },            // through the yard gate
  { at: [1.4, 12.5], look: [3.5, 1.2, 24] },
  { at: [3.0, 19.5], look: [3.6, 1.0, 27] },           // the sungka shelter ahead
  { at: [4.9, 23.8], look: [3.6, 0.9, 27] },           // at the sungka board
  { at: [8.6, 25.2], look: [17.5, 1.6, 33] },          // back onto the road
  { at: [12.2, 28.2], look: [20.5, 1.6, 37] },
  { at: [17.2, 32.2], look: [23.5, 1.6, 41] },
  { at: [20.3, 36.6], look: [25.8, 1.6, 45] },
  { at: [23.0, 40.2], look: [27.2, 1.6, 49] },
  { at: [25.3, 44.2], look: [28.8, 1.7, 53] },
  { at: [26.6, 48.2], look: [30.8, 1.7, 57] },
  { at: [28.5, 52.2], look: [32.2, 1.8, 61] },
  { at: [30.5, 56.2], look: [34.5, 1.9, 64] },
  { at: [33.2, 60.6], look: [36.0, 2.0, 67] },        // the road leaves the village (chapter exit)
];

/** the demonic portal at the end of the road (Portal.tsx): where it stands and the point it faces */
export const PORTAL = { at: [35.2, 64.4] as [number, number], facing: [33.2, 60.6] as [number, number] };

/** the electric poles that already carry a light (x, z): the gate pole and the three road poles */
export const POLE_LIGHTS: [number, number][] = [[3.1, 4.2], [22.2, 36.0], [27.9, 47.5], [32.3, 58.5]];

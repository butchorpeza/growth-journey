/* Hook for GSAP cinematic sequences: while `active`, the camera follows `position`/`target`/`fov` instead of the
   visitor's eyes, then hands control back. */
import { Vector3 } from 'three';

export const cameraOverride = { active: false, position: new Vector3(), target: new Vector3(), fov: 70 };

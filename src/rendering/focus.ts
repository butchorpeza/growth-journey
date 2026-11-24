/* Camera autofocus for the depth-of-field effect: like a cinema camera's focus puller, it measures the distance
   to whatever is at the centre of the frame (a BVH raycast, a few times per second) and racks focus to it
   smoothly. Racking to something nearer is quicker than racking out, as an operator would. */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { MathUtils, Raycaster, Vector2 } from 'three';

export const focus = { distance: 8 };

const SKY = 80;   // m: focus distance when nothing is hit (the horizon)

export function Autofocus() {
  const camera = useThree((s) => s.camera), scene = useThree((s) => s.scene);
  const ray = useMemo(() => { const r = new Raycaster(); r.far = SKY; (r as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true; return r; }, []);
  const centre = useMemo(() => new Vector2(), []);
  const target = useRef(focus.distance), frame = useRef(0);
  useFrame((_, dt) => {
    if (frame.current++ % 4 === 0) {
      ray.setFromCamera(centre, camera);
      const hit = ray.intersectObject(scene, true).find((h) => h.object.visible);
      target.current = hit ? Math.max(0.4, hit.distance) : SKY;
    }
    const rate = target.current < focus.distance ? 7 : 3.5;
    focus.distance = MathUtils.lerp(focus.distance, target.current, 1 - Math.exp(-rate * Math.min(dt, 0.1)));
  });
  return null;
}

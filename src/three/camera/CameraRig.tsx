/* Drives the camera from scroll progress (no React re-renders: reads the mutable `progress` every frame).
   Adds a very small pointer parallax on desktop. Reduced motion: no parallax, no easing lag. */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { pointer, progress } from '../../state/journey';
import { cameraAt } from '../animations/journeyMath';

export function CameraRig({ reduced }: { reduced: boolean }) {
  const camera = useThree((s) => s.camera);
  const pos = useRef(new Vector3()), target = useRef(new Vector3());
  const look = useRef(new Vector3()), par = useRef({ x: 0, y: 0 }), first = useRef(true);

  useFrame((_, dt) => {
    cameraAt(progress.value, pos.current, target.current);
    const k = reduced || first.current ? 1 : 1 - Math.exp(-dt * 6);
    if (!reduced) {
      par.current.x += (pointer.x - par.current.x) * Math.min(1, dt * 2);
      par.current.y += (pointer.y - par.current.y) * Math.min(1, dt * 2);
      pos.current.x += par.current.x * 1.6;
      pos.current.y += par.current.y * 0.9;
    }
    camera.position.lerp(pos.current, k);
    look.current.lerp(target.current, k);
    camera.lookAt(look.current);
    first.current = false;
  });
  return null;
}

/* Persistent progress indicator: reads the mutable scroll progress every frame and writes a CSS transform
   directly (no React re-render per frame). */
import { useEffect, useRef } from 'react';
import { SECTION_COUNT } from '../../data/sections';
import { progress } from '../../state/journey';

export function ProgressBar() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, (progress.value + 0.0001) / (SECTION_COUNT - 0.0001))})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div className="progress" aria-hidden="true"><div ref={bar} className="progress__bar" /></div>;
}

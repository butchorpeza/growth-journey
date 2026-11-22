/* Loaded with a dynamic import() after the HTML story is interactive, so three.js never blocks the first paint. */
import { createRoot } from 'react-dom/client';
import { pointer } from '../state/journey';
import Experience from './Experience';

export function mountScene(el: HTMLElement, quality: 'high' | 'low', reduced: boolean) {
  const root = createRoot(el);
  root.render(<Experience quality={quality} reduced={reduced} />);
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  return () => { window.removeEventListener('pointermove', onMove); root.unmount(); };
}

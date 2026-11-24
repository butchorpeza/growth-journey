/* White diamond markers over every interactive object (HTML overlay, positioned each animation frame from the
   InteractionManager's marker state, no React re-renders). Outline + gentle pulse when visible; filled and glowing
   when the object is in reach and E would use it. */
import { useEffect, useRef } from 'react';
import { markers } from '../interactions/Interactable';

export function InteractionMarkers() {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = new Map<string, HTMLSpanElement>();
    let raf = 0;
    const tick = () => {
      const root = layer.current;
      if (root) {
        markers.forEach((m, id) => {
          let el = els.get(id);
          if (!el) { el = document.createElement('span'); el.className = 'marker'; el.setAttribute('aria-hidden', 'true'); root.appendChild(el); els.set(id, el); }
          el.style.transform = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px) translate(-50%, -50%) rotate(45deg)`;
          el.classList.toggle('is-visible', m.visible);
          el.classList.toggle('is-active', m.active);
        });
        els.forEach((el, id) => { if (!markers.has(id)) { el.remove(); els.delete(id); } });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); els.forEach((el) => el.remove()); };
  }, []);
  return <div ref={layer} className="markers" />;
}

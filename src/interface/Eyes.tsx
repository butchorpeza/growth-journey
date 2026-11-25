/* The visitor's eyes, over the scene: eyelids that open and close (the wake-up: two heavy blinks before they stay
   open), the blur of eyes not yet focused, and the full-screen fades (black, and a red flash, into the portal).
   Driven by game/director.ts every animation frame, straight into CSS variables (no React re-render); everything is
   hidden while fully open and clear, so nothing costs anything the rest of the time. */
import { useEffect, useRef } from 'react';
import { director } from '../game/director';

export function Eyes() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0, last = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = root.current; if (!el) return;
      const { open, blur } = director.eyes, black = director.blackout, flash = director.flash, white = director.whiteout, scare = director.scare;
      const lids = open < 0.999, blurred = blur > 0.15;
      const key = `${open.toFixed(3)}|${blur.toFixed(1)}|${black.toFixed(3)}|${flash.toFixed(3)}|${white.toFixed(3)}|${scare.toFixed(2)}`;
      if (key === last) return;
      last = key;
      el.style.display = lids || blurred || black > 0.001 || flash > 0.001 || white > 0.001 || scare > 0.01 ? '' : 'none';
      el.style.setProperty('--white', white.toFixed(4));
      el.style.setProperty('--scare', scare.toFixed(3));
      el.style.setProperty('--open', open.toFixed(4));
      el.style.setProperty('--blur', `${blur.toFixed(1)}px`);
      el.style.setProperty('--black', black.toFixed(4));
      el.style.setProperty('--flash', flash.toFixed(4));
      el.classList.toggle('is-blurred', blurred);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={root} className="eyes" aria-hidden="true" style={{ display: 'none' }}>
      <div className="eyes__blur" />
      <div className="eyes__lid eyes__lid--top" />
      <div className="eyes__lid eyes__lid--bottom" />
      <div className="eyes__flash" />
      <div className="eyes__scare" />
      <div className="eyes__white" />
      <div className="eyes__black" />
    </div>
  );
}

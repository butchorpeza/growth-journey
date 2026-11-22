/* Text and card reveals for the HTML story. Content is visible by default (prerendered, no-JS and reduced-motion
   safe); GSAP only animates it *from* hidden when it scrolls into view. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initReveals(reduced: boolean): () => void {
  if (reduced) return () => {};
  const ctx = gsap.context(() => {
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      onEnter: (els) => gsap.from(els, { y: 36, autoAlpha: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
    });
  });
  return () => ctx.revert();
}

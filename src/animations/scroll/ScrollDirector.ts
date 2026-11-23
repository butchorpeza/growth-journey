/* The single scroll system: Lenis (smooth scroll) driven by GSAP's ticker, feeding ScrollTrigger.
   It turns the scroll position into `progress.value` (0 … 4.999, one unit per chapter, read by the 3D camera)
   and the current chapter index (React state, read by the interface).
   Reduced motion: Lenis is skipped entirely and native scrolling is used. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { chapters, CHAPTER_COUNT } from '../../data/chapters';
import { progress, setJourney } from '../../state/journey';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;
let sections: HTMLElement[] = [];
let spans: { top: number; height: number }[] = [];
let tick: ((time: number) => void) | null = null;
let lastY = 0;
const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function measure() {
  sections = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]'));
  spans = sections.map((s) => {
    const r = s.getBoundingClientRect();
    return { top: r.top + window.scrollY, height: r.height };
  });
}

/* the line half-way down the viewport decides where we are: chapter i while it is inside section i */
function update() {
  if (!spans.length) return;
  // the reading line starts at the top of the viewport and settles half-way down after one screen,
  // so the very top of the page is exactly the start of chapter 01
  const y = window.scrollY + window.innerHeight * 0.5 * clamp(window.scrollY / window.innerHeight, 0, 1);
  let p = 0;
  for (let i = 0; i < spans.length; i++) {
    const { top, height } = spans[i];
    if (y >= top) p = i + clamp((y - top) / Math.max(1, height), 0, 0.9999);
  }
  progress.velocity = window.scrollY - lastY;
  lastY = window.scrollY;
  progress.value = clamp(p, 0, CHAPTER_COUNT - 0.0001);
  setJourney({ chapter: Math.floor(progress.value) });
}

export function initScroll({ reduced }: { reduced: boolean }): () => void {
  if (!reduced) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
    tick = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
  }
  if (DEBUG) (window as unknown as Record<string, unknown>).__journey = { lenis, progress, scrollToChapter, chapters };
  const onScroll = () => update();
  window.addEventListener('scroll', onScroll, { passive: true });
  const onRefresh = () => { measure(); update(); };
  ScrollTrigger.addEventListener('refresh', onRefresh);
  // content height changes (fonts, images) move the sections: re-measure, debounced
  let t = 0;
  const ro = new ResizeObserver(() => { clearTimeout(t); t = window.setTimeout(() => ScrollTrigger.refresh(), 150); });
  ro.observe(document.body);
  measure(); update();

  // deep link: /about/#the-system opens on that chapter
  const hash = window.location.hash.slice(1);
  if (hash) requestAnimationFrame(() => scrollToId(hash, true));

  return () => {
    window.removeEventListener('scroll', onScroll);
    ScrollTrigger.removeEventListener('refresh', onRefresh);
    ro.disconnect();
    if (tick) gsap.ticker.remove(tick);
    lenis?.destroy(); lenis = null;
  };
}

export function scrollToId(id: string, immediate = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: immediate ? 0 : 1.8, immediate, easing: (x: number) => 1 - Math.pow(1 - x, 4) });
  else el.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth', block: 'start' });
}

export function scrollToChapter(index: number) {
  const el = document.querySelectorAll<HTMLElement>('[data-chapter]')[index];
  if (el?.id) scrollToId(el.id);
  if (el) {
    // move keyboard / screen-reader focus to the chapter heading
    const h = el.querySelector<HTMLElement>('h1, h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
}

export function stopScroll(stop: boolean) {
  if (!lenis) return;
  if (stop) lenis.stop(); else lenis.start();
}

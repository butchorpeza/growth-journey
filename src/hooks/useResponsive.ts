import { useSyncExternalStore } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const bp = (): Breakpoint => {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  return w < 700 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop';
};
const coarse = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/** Breakpoint + touch flag. Re-renders only when the breakpoint changes, not on every resize event. */
export function useResponsive() {
  const breakpoint = useSyncExternalStore(
    (cb) => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb); },
    bp,
    () => 'desktop' as Breakpoint,
  );
  return { breakpoint, isMobile: breakpoint === 'mobile', isTouch: coarse() };
}

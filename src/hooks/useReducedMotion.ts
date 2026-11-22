import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';
const mql = () => (typeof window === 'undefined' ? null : window.matchMedia(query));

export function prefersReducedMotion(): boolean { return !!mql()?.matches; }

/** true when the visitor asked the OS for less motion: no smooth scroll, no camera flights, no idle drift. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = mql(); m?.addEventListener('change', cb); return () => m?.removeEventListener('change', cb); },
    () => prefersReducedMotion(),
    () => false,
  );
}

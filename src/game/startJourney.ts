/* Tiny entry the website imports: the game code (three.js, Rapier, models) loads only when this is called. */
export function startJourney() {
  void import('./launch').then((m) => m.openGame());
}

export function canPlay(): { ok: boolean; reason?: string } {
  if (typeof window === 'undefined') return { ok: true };
  const touchOnly = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
  if (touchOnly) return { ok: false, reason: 'The playable journey needs a keyboard and mouse for now. Touch controls are planned; the full website is right here.' };
  return { ok: true };
}

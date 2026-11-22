/* Client entry.
   1) Hydrate the prerendered HTML story (or render it, in dev).
   2) Decide the 3D quality for this device; with no WebGL the page stays a complete HTML page.
   3) Load three.js + the scene in a separate chunk once the browser is idle, so it never blocks the first paint. */
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './components/App';
import { prefersReducedMotion } from './hooks/useReducedMotion';
import { setJourney } from './state/journey';
import { detectQuality } from './utils/webgl';

const rootEl = document.getElementById('root')!;
const app = <StrictMode><App /></StrictMode>;
if (rootEl.firstElementChild) hydrateRoot(rootEl, app); else createRoot(rootEl).render(app);

const quality = detectQuality();
document.documentElement.classList.add(quality === 'off' ? 'no-webgl' : 'has-webgl');
// let hydration finish with the server snapshot, then switch to the live value
queueMicrotask(() => setJourney({ quality }));

if (quality !== 'off') {
  const start = () => import('./three/mountScene').then(({ mountScene }) => {
    mountScene(document.getElementById('scene')!, quality, prefersReducedMotion());
  });
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(start, { timeout: 1200 });
  else setTimeout(start, 200);
}

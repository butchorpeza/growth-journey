/* Client entry: hydrate the prerendered HTML website, and note whether this device can run the 3D journey.
   The game itself (three.js, Rapier, models) is loaded only when the visitor presses "Start the Journey". */
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './components/App';
import { setJourney } from './state/journey';
import { detectQuality } from './utils/webgl';

const rootEl = document.getElementById('root')!;
const app = <StrictMode><App /></StrictMode>;
if (rootEl.firstElementChild) hydrateRoot(rootEl, app); else createRoot(rootEl).render(app);

const quality = detectQuality();
document.documentElement.classList.add(quality === 'off' ? 'no-webgl' : 'has-webgl');
// let hydration finish with the server snapshot, then switch to the live value
queueMicrotask(() => setJourney({ quality }));

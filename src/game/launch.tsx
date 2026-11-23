/* Opens the game over the website (separate React root, loaded on demand) and closes it again. */
import { createRoot, type Root } from 'react-dom/client';
import { stopScroll } from '../animations/scroll/ScrollDirector';
import { GameRoot } from './GameRoot';

let root: Root | null = null, host: HTMLElement | null = null, opener: HTMLElement | null = null;

export function openGame() {
  if (root) return;
  opener = document.activeElement as HTMLElement;
  host = document.createElement('div');
  host.id = 'game';
  document.body.appendChild(host);
  document.getElementById('root')?.setAttribute('inert', '');
  document.documentElement.classList.add('game-open');
  stopScroll(true);
  root = createRoot(host);
  root.render(<GameRoot onExit={closeGame} />);
}

export function closeGame() {
  root?.unmount(); root = null;
  host?.remove(); host = null;
  document.getElementById('root')?.removeAttribute('inert');
  document.documentElement.classList.remove('game-open');
  stopScroll(false);
  opener?.focus?.();
}

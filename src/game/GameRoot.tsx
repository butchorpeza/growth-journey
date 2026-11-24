/* The game overlay: full-screen canvas + HUD, mounted only when the visitor starts the journey and fully
   unmounted when they leave (GPU memory is released). The HTML website underneath stays in the page. */
import { lazy, Suspense, useEffect, useRef } from 'react';
import { GameHUD, usePauseOnUnlock } from '../interface/GameHUD';
import { attachInput, input, lockPointer } from '../player/PlayerInput';
import { setGame, useGame } from './GameState';

const GameCanvas = lazy(() => import('./GameCanvas'));

export function GameRoot({ onExit }: { onExit: () => void }) {
  const surface = useRef<HTMLDivElement>(null);
  const mode = useGame((s) => s.mode);
  usePauseOnUnlock();
  useEffect(() => { setGame({ mode: 'loading', prompt: null, reading: null }); const el = surface.current!; const off = attachInput(el); return off; }, []);
  useEffect(() => { input.enabled = mode === 'playing'; }, [mode]);
  const exit = () => { document.exitPointerLock?.(); onExit(); };

  return (
    <div className={`game${mode === 'playing' ? ' game--playing' : ''}`} role="application" aria-label="The Growth Journey, interactive first-person experience">
      <div ref={surface} className="game__surface" onClick={() => { if (mode === 'playing' && !document.pointerLockElement && surface.current) void lockPointer(surface.current); }}>
        <Suspense fallback={null}><GameCanvas /></Suspense>
      </div>
      <GameHUD surface={() => surface.current} onExit={exit} />
    </div>
  );
}

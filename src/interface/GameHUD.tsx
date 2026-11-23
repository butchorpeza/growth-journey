/* Everything drawn over the game in HTML: chapter indicator, interaction prompt, narrative panel, pause menu,
   intro card and the "click to look around" hint. Restrained, readable, no game-HUD clutter. */
import { useEffect, useRef } from 'react';
import { prototypeChapter } from '../data/chapters';
import { narrative } from '../data/narrative';
import { getGame, resetProgress, setGame, updateSettings, useGame } from '../game/GameState';
import { character } from '../player/characterConfig';
import { clearInput, lockPointer } from '../player/PlayerInput';

export function GameHUD({ surface, onExit }: { surface: () => HTMLElement | null; onExit: () => void }) {
  const mode = useGame((s) => s.mode);
  const prompt = useGame((s) => s.prompt);
  const locked = useGame((s) => s.pointerLocked);
  const play = () => { setGame({ mode: 'playing' }); const el = surface(); if (el) void lockPointer(el); };

  return (
    <div className="hud">
      <div className="hud__chapter" aria-live="polite">
        <span className="hud__num">{prototypeChapter.number}</span>
        <span>{prototypeChapter.title}</span>
        <span className="hud__tag">Prototype · temporary blockout</span>
      </div>
      {character.temporary && <p className="hud__note">Temporary test character.</p>}

      {mode === 'loading' && <div className="hud__center"><p className="hud__label">Loading the world…</p></div>}

      {mode === 'intro' && (
        <div className="hud__card" role="dialog" aria-label="Controls">
          <p className="eyebrow eyebrow--plain">Third-person prototype</p>
          <h2>Movement & camera test</h2>
          <ul className="controls">
            <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</li>
            <li><kbd>Shift</kbd> Run</li>
            <li><kbd>Space</kbd> Jump</li>
            <li><kbd>Mouse</kbd> Look · <kbd>Wheel</kbd> Zoom</li>
            <li><kbd>E</kbd> Interact</li>
            <li><kbd>Esc</kbd> Pause</li>
          </ul>
          <div className="hud__actions">
            <button type="button" className="btn btn--primary" onClick={play} autoFocus>Start exploring</button>
            <button type="button" className="btn btn--ghost" onClick={onExit}>Back to the website</button>
          </div>
        </div>
      )}

      {mode === 'playing' && prompt && (
        <p className="hud__prompt" role="status"><kbd>E</kbd> {cap(prompt.verb)} {prompt.label}</p>
      )}
      {mode === 'playing' && !locked && <p className="hud__hint">Click the scene to look around with the mouse (or drag)</p>}

      {mode === 'reading' && <NarrativePanel onClose={play} />}
      {mode === 'paused' && <PauseMenu onResume={play} onExit={onExit} />}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function NarrativePanel({ onClose }: { onClose: () => void }) {
  const id = useGame((s) => s.reading);
  const entry = id ? narrative[id] : null;
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { clearInput(); btn.current?.focus(); }, []);
  if (!entry) return null;
  return (
    <div className="hud__card hud__card--narrative" role="dialog" aria-labelledby="narrative-title">
      <h2 id="narrative-title">{entry.title}</h2>
      <p>{entry.body}</p>
      {entry.placeholder && <p className="hud__placeholder">Placeholder text · to be written by Butch</p>}
      <button ref={btn} type="button" className="btn btn--ghost" onClick={() => { setGame({ reading: null }); onClose(); }}>Continue <kbd>E</kbd></button>
    </div>
  );
}

function PauseMenu({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  const s = useGame((g) => g.settings);
  const save = useGame((g) => g.save);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { clearInput(); first.current?.focus(); }, []);
  return (
    <div className="hud__card hud__card--pause" role="dialog" aria-labelledby="pause-title">
      <h2 id="pause-title">Paused</h2>
      <div className="hud__actions hud__actions--stack">
        <button ref={first} type="button" className="btn btn--primary" onClick={onResume}>Resume</button>
        <button type="button" className="btn btn--ghost" onClick={onExit}>Exit to the website</button>
      </div>
      <fieldset className="settings">
        <legend>Settings</legend>
        <label>Mouse sensitivity <input type="range" min="0.3" max="2.5" step="0.1" value={s.sensitivity} onChange={(e) => updateSettings({ sensitivity: Number(e.target.value) })} /></label>
        <label><input type="checkbox" checked={s.invertY} onChange={(e) => updateSettings({ invertY: e.target.checked })} /> Invert vertical look</label>
        <label>Graphics
          <select value={s.quality} onChange={(e) => updateSettings({ quality: e.target.value as 'high' | 'low' })}>
            <option value="high">High (shadows, full resolution)</option>
            <option value="low">Performance</option>
          </select>
        </label>
        <label><input type="checkbox" checked={s.audio} onChange={(e) => updateSettings({ audio: e.target.checked })} /> Sound (off by default · audio arrives with the chapters)</label>
      </fieldset>
      <p className="settings__meta">Progress saved on this device · {save.discovered.length} object{save.discovered.length === 1 ? '' : 's'} discovered
        <button type="button" className="linkish" onClick={() => { if (confirm('Reset your saved progress?')) resetProgress(); }}>Reset progress</button></p>
    </div>
  );
}

/** Esc releases pointer lock in the browser; treat that as "pause" while playing */
export function usePauseOnUnlock() {
  useEffect(() => {
    const onChange = () => {
      const locked = !!document.pointerLockElement;
      setGame({ pointerLocked: locked });
      if (!locked && getGame().mode === 'playing') setGame({ mode: 'paused' });
    };
    const onKey = (e: KeyboardEvent) => {
      const m = getGame().mode;
      if (e.code === 'Escape' && m === 'playing' && !document.pointerLockElement) setGame({ mode: 'paused' });
      if (e.code === 'KeyE' && m === 'reading') { setGame({ reading: null, mode: 'playing' }); }
    };
    document.addEventListener('pointerlockchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerlockchange', onChange); window.removeEventListener('keydown', onKey); };
  }, []);
}

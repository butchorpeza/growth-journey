/* Everything drawn over the game in HTML: chapter indicator, centre reticle, interaction prompt, narrative panel,
   pause menu, intro card and the "click to look around" hint. Restrained, readable, no game-HUD clutter. */
import { useEffect, useRef, useState } from 'react';
import { gameChapters, prototypeChapter } from '../data/chapters';
import { narrative } from '../data/narrative';
import { getGame, resetProgress, setGame, updateSettings, useGame } from '../game/GameState';
import { audio } from '../audio/AudioEngine';
import { InteractionMarkers } from './InteractionMarkers';
import { lookFor } from '../rendering/looks';
import { clearInput, lockPointer } from '../player/PlayerInput';

export function GameHUD({ surface, onExit }: { surface: () => HTMLElement | null; onExit: () => void }) {
  const mode = useGame((s) => s.mode);
  const prompt = useGame((s) => s.prompt);
  const locked = useGame((s) => s.pointerLocked);
  const chapterId = useGame((s) => s.chapter);
  const progress = useGame((s) => s.loadProgress);
  const chapter = gameChapters.find((c) => c.id === chapterId) ?? prototypeChapter;
  const isRange = chapter.id === 'prototype';
  const play = () => {
    setGame({ mode: 'playing' }); const el = surface(); if (el) void lockPointer(el);
    const s = getGame().settings; if (s.audio) void audio.enable(s.volume);   // inside the click: browsers allow audio
  };
  useAudioDirector();

  const letterbox = useGame((s) => s.settings.widescreenBars);   // full screen unless the visitor opts in
  const movement = useGame((s) => s.settings.movement);
  const scroll = movement === 'scroll' && !isRange;
  return (
    <div className="hud">
      <div className="hud__vignette" aria-hidden="true" />
      {letterbox && <div className="hud__bars" aria-hidden="true"><span /><span /></div>}
      <div className="hud__chapter" aria-live="polite">
        <span className="hud__num">{chapter.number}</span>
        <span>{chapter.title}</span>
        <span className="hud__tag">{isRange ? 'Prototype · temporary blockout' : 'In production'}</span>
      </div>

      {mode === 'loading' && <div className="hud__center"><p className="hud__label">Loading the world… {progress > 0 && progress < 100 ? `${progress}%` : ''}</p></div>}

      {mode === 'intro' && (
        <div className="hud__card" role="dialog" aria-label="Controls">
          <p className="eyebrow eyebrow--plain">{isRange ? 'First-person prototype' : `Chapter ${chapter.number}`}</p>
          <h2>{isRange ? 'Movement & look test' : chapter.title}</h2>
          {!isRange && <p className="hud__lede">{chapter.narrative}</p>}
          {!isRange && <MovementChoice />}
          <ul className="controls">
            {scroll ? <>
              <li><kbd>Scroll</kbd> Move along the path</li>
              <li><kbd>Mouse</kbd> Look around</li>
              <li><kbd>E</kbd> Interact with <span className="controls__diamond" aria-label="white diamond" /></li>
              <li><kbd>Esc</kbd> Pause</li>
            </> : <>
              <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</li>
              <li><kbd>Shift</kbd> Sprint</li>
              <li><kbd>Space</kbd> Jump</li>
              <li><kbd>Mouse</kbd> Look</li>
              <li><kbd>E</kbd> Interact with <span className="controls__diamond" aria-label="white diamond" /></li>
              <li><kbd>Esc</kbd> Pause</li>
            </>}
          </ul>
          <SoundToggle />
          <div className="hud__actions">
            <button type="button" className="btn btn--primary" onClick={play} autoFocus>Start exploring</button>
            <button type="button" className="btn btn--ghost" onClick={onExit}>Back to the website</button>
          </div>
        </div>
      )}

      <InteractionMarkers />
      {mode === 'playing' && !scroll && <span className={`hud__reticle${prompt ? ' is-active' : ''}`} aria-hidden="true" />}
      {mode === 'playing' && prompt && (
        <p className="hud__prompt" role="status"><kbd>E</kbd> {cap(prompt.verb)} {prompt.label}</p>
      )}
      {mode === 'playing' && !locked && <LookHint />}

      {mode === 'reading' && <NarrativePanel onClose={play} />}
      {mode === 'paused' && <PauseMenu onResume={play} onExit={onExit} />}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** choose how to move: a guided cinematic path (scroll) or free first-person walking (WASD) */
function MovementChoice() {
  const movement = useGame((g) => g.settings.movement);
  return (
    <div className="movement" role="radiogroup" aria-label="How to move">
      <button type="button" role="radio" aria-checked={movement === 'scroll'} onClick={() => updateSettings({ movement: 'scroll' })}>
        <strong>Scroll</strong><span>Guided, cinematic path</span>
      </button>
      <button type="button" role="radio" aria-checked={movement === 'free'} onClick={() => updateSettings({ movement: 'free' })}>
        <strong>WASD</strong><span>Walk freely, first person</span>
      </button>
    </div>
  );
}

/** sound is off until the visitor turns it on (the brief); the switch lives on the intro card and in the pause menu */
function SoundToggle() {
  const on = useGame((g) => g.settings.audio), volume = useGame((g) => g.settings.volume);
  return (
    <button type="button" className="sound-toggle" aria-pressed={on}
      onClick={() => { updateSettings({ audio: !on }); if (!on) void audio.enable(volume); else audio.disable(); }}>
      <span className="sound-toggle__dot" aria-hidden="true" /> Sound {on ? 'on' : 'off'} <span className="sound-toggle__hint">footsteps · ambience · headphones recommended</span>
    </button>
  );
}

/** keeps the audio engine in step with settings and the current chapter */
function useAudioDirector() {
  const on = useGame((g) => g.settings.audio), volume = useGame((g) => g.settings.volume), chapter = useGame((g) => g.chapter);
  useEffect(() => { audio.setAmbience(chapter === 'survival' ? ((lookFor('survival').weather?.rain ?? 0) > 0 ? 'tropical-rain' : 'tropical-day') : null); }, [chapter]);
  useEffect(() => { audio.setVolume(volume); }, [volume]);
  useEffect(() => { if (!on) audio.disable(); }, [on]);
  useEffect(() => () => audio.disable(), []);
}

/** how hover look works, shown for the first few seconds of play while the mouse isn't locked */
function LookHint() {
  const scroll = useGame((g) => g.settings.movement === 'scroll' && g.chapter !== 'prototype');
  const hintText = scroll ? 'Scroll to move along the path · move the mouse to look around · E at a white diamond'
    : 'Move the mouse to look around · hold it near an edge to keep turning';
  const [show, setShow] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShow(false), 6000); return () => clearTimeout(t); }, []);
  return <p className={`hud__hint${show ? '' : ' is-hidden'}`} aria-live="polite">{hintText}</p>;
}

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
        <label>Movement
          <select value={s.movement} onChange={(e) => updateSettings({ movement: e.target.value as 'scroll' | 'free' })}>
            <option value="scroll">Scroll: guided cinematic path</option>
            <option value="free">WASD: walk freely</option>
          </select>
        </label>
        <label><input type="checkbox" checked={s.invertY} onChange={(e) => updateSettings({ invertY: e.target.checked })} /> Invert vertical look</label>
        <label><input type="checkbox" checked={s.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.checked })} /> Reduce motion (no head bob, handheld drift, sprint zoom or film grain)</label>
        <label><input type="checkbox" checked={s.widescreenBars} onChange={(e) => updateSettings({ widescreenBars: e.target.checked })} /> Cinematic widescreen bars (2.39:1)</label>
        <label>Graphics
          <select value={s.quality} onChange={(e) => updateSettings({ quality: e.target.value as 'high' | 'medium' | 'low' })}>
            <option value="high">High (cinematic: full lighting and effects)</option>
            <option value="medium">Medium (balanced)</option>
            <option value="low">Low (performance: no shadows or effects)</option>
          </select>
        </label>
        <label><input type="checkbox" checked={s.audio} onChange={(e) => { updateSettings({ audio: e.target.checked }); if (e.target.checked) void audio.enable(s.volume); else audio.disable(); }} /> Sound (footsteps and ambience)</label>
        {s.audio && <label>Volume <input type="range" min="0" max="1" step="0.05" value={s.volume} onChange={(e) => updateSettings({ volume: Number(e.target.value) })} /></label>}
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

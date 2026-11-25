/* Everything drawn over the game in HTML: chapter indicator, centre reticle, interaction prompt, narrative panel,
   pause menu, intro card and the "click to look around" hint. Restrained, readable, no game-HUD clutter. */
import { useEffect, useRef, useState } from 'react';
import { gameChapters, prototypeChapter } from '../data/chapters';
import { getGame, resetProgress, setGame, updateSettings, useGame } from '../game/GameState';
import { audio } from '../audio/AudioEngine';
import { InteractionMarkers } from './InteractionMarkers';
import { IntroScreen } from './IntroScreen';
import { InfoPanel } from './InfoPanel';
import { lookFor } from '../rendering/looks';
import { clearInput, lockPointer } from '../player/PlayerInput';
import { NARRATION_ENABLED, pause as pauseNarration, resume as resumeNarration, setNarrationVolume } from '../audio/narrator';
import { director } from '../game/director';
import { Subtitles } from './Subtitles';
import { Eyes } from './Eyes';

export function GameHUD({ surface, onExit }: { surface: () => HTMLElement | null; onExit: () => void }) {
  const mode = useGame((s) => s.mode);
  const prompt = useGame((s) => s.prompt);
  const locked = useGame((s) => s.pointerLocked);
  const chapterId = useGame((s) => s.chapter);
  const chapter = gameChapters.find((c) => c.id === chapterId) ?? prototypeChapter;
  const isRange = chapter.id === 'prototype';
  const play = () => {
    setGame({ mode: 'playing' }); const el = surface(); if (el) void lockPointer(el);
    void audio.enable(getGame().settings.volume);   // inside the click: browsers only allow audio after one
  };
  useAudioDirector();

  const movement = useGame((s) => s.settings.movement);
  const scroll = movement === 'scroll' && !isRange;
  return (
    <div className="hud">
      <div className="hud__vignette" aria-hidden="true" />
      <div className="hud__chapter" aria-live="polite">
        <span className="hud__num">{chapter.number}</span>
        <span>{chapter.title}</span>
        <span className="hud__tag">{isRange ? 'Prototype · temporary blockout' : 'In production'}</span>
      </div>

      <InteractionMarkers />
      {mode === 'playing' && !scroll && <span className={`hud__reticle${prompt ? ' is-active' : ''}`} aria-hidden="true" />}
      {mode === 'playing' && prompt && (
        <p className="hud__prompt" role="status"><kbd>E</kbd> {cap(prompt.verb)} {prompt.label}</p>
      )}
      {mode === 'playing' && !locked && <LookHint />}

      <Eyes />
      <ChapterCard onExit={onExit} />
      <ChaseHint />
      <Subtitles />
      {mode === 'playing' && <SkipMoment />}
      {mode === 'reading' && <InfoPanel onClose={play} />}
      {mode === 'paused' && <PauseMenu onResume={play} onExit={onExit} />}
      <IntroScreen onStart={play} onExit={onExit} range={isRange} />
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** the instruction when it comes for the visitor: RUN, and how (the visitor's own movement style) */
function ChaseHint() {
  const hint = useGame((g) => g.hint), movement = useGame((g) => g.settings.movement);
  if (hint !== 'run') return null;
  return (
    <div className="chase-hint" role="alert">
      <p className="chase-hint__word">RUN</p>
      <p className="chase-hint__how">{movement === 'scroll' ? <>Tap <kbd>Space</kbd> again and again to run</> : <>Hold <kbd>Shift</kbd> + <kbd>W</kbd> to sprint</>}</p>
    </div>
  );
}

/** a chapter's title over the scene as it opens: the number, the title with its letters flickering on like failing
 *  light, and the line under it in the handwritten face with its key words in pale gold; then it all fades */
function ChapterCard({ onExit }: { onExit: () => void }) {
  const card = useGame((g) => g.titleCard);
  if (card === 'shadows-end') return (
    <div className="chapter-card chapter-card--end" role="dialog" aria-label="End of Chapter 02">
      <p className="chapter-card__num">End of Chapter 02</p>
      <h1 className="chapter-card__title chapter-card__title--end">THE SHADOWS</h1>
      <p className="chapter-card__line">The things that shaped me, even when I didn't <em>understand them.</em></p>
      <p className="chapter-card__next">Chapter 03 · Rebirth · in production</p>
      <div className="chapter-card__actions">
        <button type="button" onClick={() => { window.location.href = `${window.location.pathname}?chapter=shadows`; }}>Play Chapter 02 again</button>
        <button type="button" onClick={onExit}>Back to the website</button>
      </div>
    </div>
  );
  if (card !== 'shadows') return null;
  const title = 'THE SHADOWS';
  return (
    <div className="chapter-card" aria-live="polite">
      <p className="chapter-card__num">Chapter 02</p>
      <h1 className="chapter-card__title" aria-label="The Shadows">
        {title.split('').map((c, i) => <span key={i} style={{ animationDelay: `${0.25 + ((i * 7) % 11) * 0.11}s` }}>{c === ' ' ? '\u00a0' : c}</span>)}
      </h1>
      <p className="chapter-card__line">The things that shaped me, even when I didn't <em>understand them.</em></p>
    </div>
  );
}

/** "Skip" while a scripted moment can be skipped (Cinematics.tsx); Enter does the same */
function SkipMoment() {
  const cinematic = useGame((g) => g.cinematic);
  const opening = cinematic === 'opening';
  const skippable = !!cinematic && !!director.skip;
  useEffect(() => {
    if (!skippable) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter') { e.preventDefault(); director.skip?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skippable]);
  if (!skippable) return null;
  return <button type="button" className="cine-skip" onClick={() => director.skip?.()}>{opening ? 'Skip intro' : 'Skip'}<kbd>Enter</kbd></button>;
}

/** keeps the audio engine in step with settings and the current chapter */
function useAudioDirector() {
  const volume = useGame((g) => g.settings.volume), chapter = useGame((g) => g.chapter);
  useEffect(() => { audio.setAmbience(chapter === 'survival' ? ((lookFor('survival').weather?.rain ?? 0) > 0 ? 'tropical-rain' : 'tropical-day') : chapter === 'shadows' ? 'island-night' : null); }, [chapter]);
  useEffect(() => { audio.setMusic(chapter === 'survival' ? 'survival' : chapter === 'shadows' ? 'shadows' : null); }, [chapter]);
  useEffect(() => { audio.setVolume(volume); }, [volume]);
  // the narrator: its own volume, and it pauses with the game
  const narration = useGame((g) => g.settings.narration), mode = useGame((g) => g.mode);
  useEffect(() => { setNarrationVolume(narration); }, [narration, volume]);
  useEffect(() => { if (mode === 'paused') pauseNarration(); else resumeNarration(); }, [mode]);
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


/** the pause menu: the game blurred full screen behind a black-and-white panel on the left, in a handwritten
 *  face. Only what a visitor needs: resume, back to the website, volume, how to move, and their saved progress. */
function PauseMenu({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  const volume = useGame((g) => g.settings.volume);
  const movement = useGame((g) => g.settings.movement);
  const guide = useGame((g) => g.settings.guide);
  const narration = useGame((g) => g.settings.narration);
  const cameraFx = useGame((g) => g.settings.cameraFx);
  const save = useGame((g) => g.save);
  const [confirming, setConfirming] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { clearInput(); first.current?.focus(); }, []);
  const found = save.discovered.length;
  return (
    <div className="pause" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="pause__panel">
        <h2 id="pause-title" className="pause__title">Paused</h2>
        <nav className="pause__nav">
          <button ref={first} type="button" className="pause__link" onClick={onResume}>Resume</button>
          <button type="button" className="pause__link" onClick={onExit}>Back to home page</button>
        </nav>

        <div className="pause__group">
          <label className="pause__label" htmlFor="pause-volume">Volume <span>{Math.round(volume * 100)}</span></label>
          <input id="pause-volume" className="pause__range" type="range" min="0" max="1" step="0.05" value={volume}
            style={{ '--fill': `${volume * 100}%` } as React.CSSProperties}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) })} />
        </div>

        {NARRATION_ENABLED && <div className="pause__group">
          <label className="pause__label" htmlFor="pause-voice">Voice <span>{Math.round(narration * 100)}</span></label>
          <input id="pause-voice" className="pause__range" type="range" min="0" max="1" step="0.05" value={narration}
            style={{ '--fill': `${narration * 100}%` } as React.CSSProperties}
            onChange={(e) => updateSettings({ narration: Number(e.target.value) })} />
        </div>}

        <div className="pause__group">
          <p className="pause__label" id="pause-movement">Movement</p>
          <div className="pause__choice" role="radiogroup" aria-labelledby="pause-movement">
            <button type="button" role="radio" aria-checked={movement === 'scroll'} onClick={() => updateSettings({ movement: 'scroll' })}>Scroll</button>
            <button type="button" role="radio" aria-checked={movement === 'free'} onClick={() => updateSettings({ movement: 'free' })}>WASD</button>
          </div>
        </div>

        <div className="pause__group">
          <p className="pause__label" id="pause-guide">Guiding trail</p>
          <div className="pause__choice" role="radiogroup" aria-labelledby="pause-guide">
            <button type="button" role="radio" aria-checked={guide} onClick={() => updateSettings({ guide: true })}>On</button>
            <button type="button" role="radio" aria-checked={!guide} onClick={() => updateSettings({ guide: false })}>Off</button>
          </div>
        </div>

        <div className="pause__group">
          <p className="pause__label" id="pause-camera">Camera effects</p>
          <div className="pause__choice" role="radiogroup" aria-labelledby="pause-camera">
            <button type="button" role="radio" aria-checked={cameraFx} onClick={() => updateSettings({ cameraFx: true })}>On</button>
            <button type="button" role="radio" aria-checked={!cameraFx} onClick={() => updateSettings({ cameraFx: false })}>Off</button>
          </div>
        </div>

        <div className="pause__group pause__progress">
          <p>Progress saved on this device · {found} thing{found === 1 ? '' : 's'} found</p>
          {confirming ? (
            <p className="pause__confirm">Start over?
              <button type="button" onClick={() => { resetProgress(); setConfirming(false); }}>Yes, reset</button>
              <button type="button" onClick={() => setConfirming(false)}>No</button>
            </p>
          ) : (
            <button type="button" className="pause__reset" onClick={() => setConfirming(true)}>Reset progress</button>
          )}
        </div>
      </div>
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
      if (e.code === 'KeyE' && m === 'reading' && getGame().titleCard !== 'shadows-end') { setGame({ reading: null, mode: 'playing' }); }
    };
    document.addEventListener('pointerlockchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerlockchange', onChange); window.removeEventListener('keydown', onKey); };
  }, []);
}

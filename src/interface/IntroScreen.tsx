/* The start of the journey, on a full black screen while the world loads behind it:
   1. the BO mark draws itself (an outline traced round, then the letters), the name rises letter by letter and the
      role and a rule follow (~3 s);
   2. if the world is still loading, a thin progress line under the name;
   3. once both are done, the brand lifts away and the movement choice comes in: Scroll (a mouse whose wheel keeps
      rolling) or WASD (keycaps pressed in turn);
   4. choosing starts the game inside the click (pointer lock and sound need it), the choice fades out, then the black
      fades away to reveal the world.
   Black and white throughout; the name in Inter like the website, everything else in the handwritten face of the
   pause menu. With reduced motion the steps simply appear. */
import { useEffect, useState, type CSSProperties } from 'react';
import { updateSettings, useGame, type Settings } from '../game/GameState';

type Movement = Settings['movement'];
const NAME = 'Butch Orpeza';
const BRAND_MS = 3000, FADE_MS = 2300;

export function IntroScreen({ onStart, onExit, range }: { onStart: () => void; onExit: () => void; range: boolean }) {
  const mode = useGame((s) => s.mode), progress = useGame((s) => s.loadProgress);
  const reduced = useGame((s) => s.settings.reducedMotion);
  const [brandDone, setBrandDone] = useState(false);
  const [chosen, setChosen] = useState<Movement | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => { const t = window.setTimeout(() => setBrandDone(true), reduced ? 300 : BRAND_MS); return () => clearTimeout(t); }, [reduced]);
  useEffect(() => {
    if (!chosen) return;
    const t = window.setTimeout(() => setGone(true), reduced ? 400 : FADE_MS);
    return () => clearTimeout(t);
  }, [chosen, reduced]);

  const ready = mode !== 'loading';
  const showChoice = (brandDone && ready) || !!chosen;
  const choose = (m: Movement) => {
    if (chosen) return;
    updateSettings({ movement: m });
    onStart();                       // inside the click: the browser allows pointer lock and sound only here
    setChosen(m);
  };
  if (gone) return null;

  return (
    <div className={`intro${showChoice ? ' is-choosing' : ''}${chosen ? ' is-leaving' : ''}`} role="dialog" aria-label="Start the journey">
      <div className="intro__brand">
        <div className="intro__mark" aria-hidden="true">
          <svg className="intro__ring" viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" rx="28" pathLength="1" /></svg>
          <span>B</span><span>O</span>
        </div>
        <h1 className="intro__name" aria-label={NAME}>
          {[...NAME].map((c, i) => <span key={i} aria-hidden="true" style={{ '--i': i } as CSSProperties}>{c === ' ' ? ' ' : c}</span>)}
        </h1>
        <p className="intro__role">Digital Growth Strategist</p>
        <span className="intro__rule" aria-hidden="true" />
        {brandDone && !ready && (
          <p className="intro__loading" role="status">
            Loading the world <span>{progress}%</span>
            <i style={{ '--p': progress / 100 } as CSSProperties} aria-hidden="true" />
          </p>
        )}
      </div>

      {showChoice && (
        <div className="intro__choose">
          <p className="intro__chapter">{range ? 'Test range' : 'Chapter 01 · Survival'}</p>
          <h2 className="intro__question">How do you want to move?</h2>
          <div className={`intro__options${range ? ' intro__options--one' : ''}`}>
            {!range && (
              <button type="button" className={`intro__option${chosen === 'scroll' ? ' is-chosen' : ''}`} onClick={() => choose('scroll')} autoFocus>
                <MouseIcon />
                <strong>Scroll</strong>
                <span>A guided, cinematic path</span>
                <small>scroll to move · mouse to look</small>
              </button>
            )}
            <button type="button" className={`intro__option${chosen === 'free' ? ' is-chosen' : ''}`} onClick={() => choose('free')} autoFocus={range}>
              <KeysIcon />
              <strong>WASD</strong>
              <span>Walk freely, first person</span>
              <small>shift to sprint · space to jump</small>
            </button>
          </div>
          <p className="intro__hint">press <kbd>E</kbd> at a white diamond <span className="intro__diamond" aria-hidden="true" /> · <kbd>Esc</kbd> to pause</p>
          <button type="button" className="intro__back" onClick={onExit}>Back to home page</button>
        </div>
      )}
    </div>
  );
}

/** a mouse whose wheel keeps rolling, with chevrons running down */
function MouseIcon() {
  return (
    <span className="intro__icon intro__icon--mouse" aria-hidden="true">
      <svg viewBox="0 0 60 92" fill="none">
        <rect x="6" y="3" width="48" height="76" rx="24" stroke="currentColor" strokeWidth="2.5" />
        <line x1="30" y1="3" x2="30" y2="32" stroke="currentColor" strokeWidth="2" />
        <rect className="intro__wheel" x="26.5" y="12" width="7" height="13" rx="3.5" fill="currentColor" />
      </svg>
      <span className="intro__chevrons"><i /><i /></span>
    </span>
  );
}

/** W A S D keycaps, pressed one after another */
function KeysIcon() {
  return (
    <span className="intro__icon intro__icon--keys" aria-hidden="true">
      {['W', 'A', 'S', 'D'].map((k, i) => <kbd key={k} className={`intro__key intro__key--${k.toLowerCase()}`} style={{ '--k': i } as CSSProperties}>{k}</kbd>)}
    </span>
  );
}

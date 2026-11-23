import { scrollToChapter } from '../../animations/scroll/ScrollDirector';
import { sections } from '../../data/sections';
import { profile } from '../../data/profile';
import { startJourney } from '../../game/startJourney';
import { useJourney } from '../../state/journey';

const chapter = sections[0];

export function BeginningChapter() {
  const quality = useJourney((s) => s.quality);
  return (
    <section id="about" data-chapter="0" className="chapter chapter--beginning" aria-labelledby="h-beginning">
      <div className="chapter__intro chapter__intro--hero">
        <p className="eyebrow" data-reveal><span>{chapter.number}</span> {chapter.title}</p>
        <h1 id="h-beginning" className="hero-title" data-reveal>
          <span className="hero-title__name">{profile.name}</span>
          <span className="hero-title__role">{profile.title}</span>
        </h1>
        <p className="hero-capabilities" data-reveal>{profile.capabilities.map((c) => `${c}.`).join(' ')}</p>
        <p className="hero-tagline" data-reveal>“{profile.tagline}”</p>
        <div className="hero-actions" data-reveal>
          <button type="button" className="btn btn--primary" onClick={startJourney} disabled={quality === 'off'}>
            <span>Start the Journey</span>
            <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14"><path d="M5 3.5v9l7-4.5z" fill="currentColor" /></svg>
          </button>
          <a className="btn btn--ghost" href="#approach" onClick={(e) => { e.preventDefault(); scrollToChapter(1); }}>
            <span>Explore the website</span>
          </a>
          <span className="hero-location">{profile.location}</span>
        </div>
        <p className="hero-note" data-reveal>
          {quality === 'off' ? 'The interactive journey needs WebGL, which this browser has turned off. Everything is also on this page.' : 'An interactive third-person journey · best on a desktop with keyboard and mouse.'}
        </p>
        <p className="scroll-cue" aria-hidden="true">Scroll to begin</p>
      </div>

      <div className="chapter__body">
        <article className="panel panel--wide" data-reveal>
          <h2 className="panel__title">{chapter.narrative}</h2>
          <p>{profile.intro}</p>
        </article>
        <dl className="credentials">
          {profile.credentials.map((c) => (
            <div key={c.k} className="panel panel--small" data-reveal>
              <dt>{c.k}</dt>
              <dd>{c.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

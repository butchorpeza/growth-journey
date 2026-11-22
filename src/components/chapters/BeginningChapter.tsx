import { scrollToChapter } from '../../animations/scroll/ScrollDirector';
import { chapters } from '../../data/chapters';
import { profile } from '../../data/profile';

const chapter = chapters[0];

export function BeginningChapter() {
  return (
    <section id="the-beginning" data-chapter="0" className="chapter chapter--beginning" aria-labelledby="h-beginning">
      <div className="chapter__intro chapter__intro--hero">
        <p className="eyebrow" data-reveal><span>{chapter.number}</span> {chapter.title}</p>
        <h1 id="h-beginning" className="hero-title" data-reveal>
          <span className="hero-title__name">{profile.name}</span>
          <span className="hero-title__role">{profile.title}</span>
        </h1>
        <p className="hero-capabilities" data-reveal>{profile.capabilities.map((c) => `${c}.`).join(' ')}</p>
        <p className="hero-tagline" data-reveal>“{profile.tagline}”</p>
        <div className="hero-actions" data-reveal>
          <a className="btn btn--primary" href="#the-discovery" onClick={(e) => { e.preventDefault(); scrollToChapter(1); }}>
            <span>Explore My Journey</span>
            <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14"><path d="M8 2.5v11m0 0L3.5 9M8 13.5 12.5 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
          <span className="hero-location">{profile.location}</span>
        </div>
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

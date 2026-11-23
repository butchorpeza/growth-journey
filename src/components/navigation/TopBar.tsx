import { scrollToChapter } from '../../animations/scroll/ScrollDirector';
import { SECTION_COUNT } from '../../data/sections';
import { contact, profile, SITE_URL } from '../../data/profile';
import { startJourney } from '../../game/startJourney';
import { setJourney, useJourney } from '../../state/journey';

export function TopBar() {
  const chapter = useJourney((s) => s.chapter);
  const atEnd = chapter === SECTION_COUNT - 1;
  return (
    <header className="topbar">
      <a className="topbar__brand" href={SITE_URL}>
        <span className="topbar__mark" aria-hidden="true">BO</span>
        <span className="topbar__name">{profile.name}<span>{profile.title}</span></span>
      </a>
      <div className="topbar__actions">
        {!atEnd && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => scrollToChapter(SECTION_COUNT - 1)}>Contact</button>
        )}
        <button type="button" className="btn btn--ghost btn--small" aria-haspopup="dialog" onClick={() => setJourney({ navOpen: true })}>
          Sections <kbd>Esc</kbd>
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={startJourney}>Play the journey</button>
        <a className="btn btn--primary btn--small" href={contact.call} target="_blank" rel="noopener">Book a call</a>
      </div>
    </header>
  );
}

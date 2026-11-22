import { scrollToChapter } from '../../animations/scroll/ScrollDirector';
import { CHAPTER_COUNT } from '../../data/chapters';
import { contact, profile, SITE_URL } from '../../data/profile';
import { setJourney, useJourney } from '../../state/journey';

export function TopBar() {
  const chapter = useJourney((s) => s.chapter);
  const atEnd = chapter === CHAPTER_COUNT - 1;
  return (
    <header className="topbar">
      <a className="topbar__brand" href={SITE_URL}>
        <span className="topbar__mark" aria-hidden="true">BO</span>
        <span className="topbar__name">{profile.name}<span>{profile.title}</span></span>
      </a>
      <div className="topbar__actions">
        {!atEnd && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => scrollToChapter(CHAPTER_COUNT - 1)}>Skip the journey</button>
        )}
        <button type="button" className="btn btn--ghost btn--small" aria-haspopup="dialog" onClick={() => setJourney({ navOpen: true })}>
          Chapters <kbd>Esc</kbd>
        </button>
        <a className="btn btn--primary btn--small" href={contact.call} target="_blank" rel="noopener">Book a call</a>
      </div>
    </header>
  );
}

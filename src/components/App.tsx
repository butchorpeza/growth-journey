/* Interface root (HTML). Client-only effects (scroll, reveals, keyboard) run in useEffect, so the same component
   renders on the server for the prerendered page. */
import { useEffect } from 'react';
import { initScroll } from '../animations/scroll/ScrollDirector';
import { initReveals } from '../animations/timelines/reveals';
import { prefersReducedMotion } from '../hooks/useReducedMotion';
import { getJourney, setJourney } from '../state/journey';
import { SiteFooter } from './interface/SiteFooter';
import { ChapterNav } from './navigation/ChapterNav';
import { ProgressBar } from './navigation/ProgressBar';
import { TopBar } from './navigation/TopBar';
import { Story } from './Story';

export function App() {
  useEffect(() => {
    const reduced = prefersReducedMotion();
    const stopScroll = initScroll({ reduced });
    const stopReveals = initReveals(reduced);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setJourney({ navOpen: !getJourney().navOpen });
    };
    window.addEventListener('keydown', onKey);
    return () => { stopScroll(); stopReveals(); window.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <TopBar />
      <ProgressBar />
      <ChapterNav />
      <main id="main">
        <Story />
      </main>
      <SiteFooter />
    </>
  );
}

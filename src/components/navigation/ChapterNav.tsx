/* Minimal chapter navigator: a rail on the right (current chapter marked) and, on Esc / the "Chapters" button,
   a full list. Every chapter is one click or one key away; nobody has to sit through the whole journey. */
import { useEffect, useRef } from 'react';
import { scrollToChapter, stopScroll } from '../../animations/scroll/ScrollDirector';
import { chapters } from '../../data/chapters';
import { setJourney, useJourney } from '../../state/journey';

export function ChapterNav() {
  const current = useJourney((s) => s.chapter);
  const open = useJourney((s) => s.navOpen);
  const firstLink = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    stopScroll(open);
    if (open) { opener.current = document.activeElement as HTMLElement; firstLink.current?.focus(); }
    else opener.current?.focus?.();
  }, [open]);

  const go = (i: number) => { setJourney({ navOpen: false }); requestAnimationFrame(() => scrollToChapter(i)); };

  return (
    <>
      <nav className="rail" aria-label="Chapters">
        <ol>
          {chapters.map((c) => (
            <li key={c.id}>
              <a href={`#${sectionId(c.index)}`} aria-current={current === c.index ? 'step' : undefined}
                onClick={(e) => { e.preventDefault(); go(c.index); }}>
                <span className="rail__num">{c.number}</span>
                <span className="rail__label">{c.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className={`chapters-panel${open ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label="Chapters" hidden={!open}
        onKeyDown={(e) => { if (e.key === 'Tab') trapFocus(e); }}>
        <div className="chapters-panel__inner">
          <p className="eyebrow eyebrow--plain">The Growth Journey</p>
          <ol>
            {chapters.map((c, i) => (
              <li key={c.id}>
                <button ref={i === 0 ? firstLink : undefined} type="button" aria-current={current === c.index ? 'step' : undefined} onClick={() => go(c.index)}>
                  <span className="chapters-panel__num">{c.number}</span>
                  <span className="chapters-panel__title">{c.title}</span>
                  <span className="chapters-panel__line">{c.narrative}</span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="chapters-panel__close" onClick={() => setJourney({ navOpen: false })}>Close <kbd>Esc</kbd></button>
        </div>
      </div>
    </>
  );
}

export const sectionId = (i: number) => ['the-beginning', 'the-discovery', 'the-system', 'the-results', 'the-next-frontier'][i];

function trapFocus(e: React.KeyboardEvent<HTMLDivElement>) {
  const f = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button, a[href]'));
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

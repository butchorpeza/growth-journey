import type { Section } from '../../data/sections';

/** Eyebrow ("02 · The Discovery") + the chapter's narrative line. The heading itself is passed by each chapter. */
export function ChapterHeader({ chapter, headingId, heading, level = 2 }: { chapter: Section; headingId: string; heading: string; level?: 1 | 2 }) {
  const H = level === 1 ? 'h1' : 'h2';
  return (
    <header className="chapter__header">
      <p className="eyebrow" data-reveal><span>{chapter.number}</span> {chapter.title}</p>
      <H id={headingId} className="chapter__title" data-reveal>{heading}</H>
      <p className="chapter__narrative" data-reveal>“{chapter.narrative}”</p>
    </header>
  );
}

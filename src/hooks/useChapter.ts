import { sections } from '../data/sections';
import { useJourney } from '../state/journey';

/** Current chapter (re-renders only when the chapter changes, not on every scroll frame). */
export function useChapter() {
  const index = useJourney((s) => s.chapter);
  return { index, chapter: sections[index] };
}

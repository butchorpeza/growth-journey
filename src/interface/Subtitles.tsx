/* Cinematic subtitles for the narrator (audio/narrator.ts): bottom centre, white, in the panels' handwritten face, with the highlighted
   phrases in warm gold as part of the sentence. One line at a time, its words appearing in step with the voice
   (each fades in as it is spoken); the line fades out when the narration ends. With a discovery panel open they
   sit in the space left of it. */
import { useNarration } from '../audio/narrator';
import { useGame } from '../game/GameState';

export function Subtitles() {
  const id = useNarration((n) => n.id);
  const words = useNarration((n) => n.words);
  const shown = useNarration((n) => n.shown);
  const line = useNarration((n) => n.line);
  const ended = useNarration((n) => n.ended);
  const panel = useGame((g) => g.mode === 'reading');
  if (!id || !words.length) return null;
  return (
    <div className={`subs${panel ? ' subs--panel' : ''}${ended ? ' is-ending' : ''}`} aria-live="polite">
      <p className="subs__line" key={`${id}-${line}`}>
        {words.map((w, i) => (
          <span key={i} className={`subs__w${w.gold ? ' is-gold' : ''}${i < shown ? ' is-on' : ''}`}>{w.glue || i === 0 ? '' : ' '}{w.w}</span>
        ))}
      </p>
    </div>
  );
}

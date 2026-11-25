/* NARRATION: the voice lines and subtitles. The words are NOT written here: every panel's narration is its text in
   data/chapter01.ts and data/chapter02.ts (one paragraph = one subtitle line), and the lines along the way in
   Chapter 02 are chapter02.ts SHADOWS_LINES, so Butch's story is edited in one place only.

   - Each narration is a list of lines. A line is one subtitle: it appears word by word in time with the voice, then
     the next line replaces it. `pause` is the silence after a line (seconds).
   - Words between *asterisks* are highlighted in warm gold in the subtitles (the voice reads them normally).
   - `file` is the recording: put Butch's own recordings at these paths (public/audio/chapter-01/…, MP3) and they are
     used automatically. Optional `cues` give each line's start time in that recording (seconds); without them the
     line timings are spread over the recording by length, which is close for natural speech.
   - There are no recordings yet, and none are faked: the voice is switched off (audio/narrator.ts) and the lines
     that need to appear (Chapter 02's) show as subtitles only. When Butch records them, put the files at the paths
     below (public/audio/chapter-01/<id>.mp3, MP3) and switch the voice on. */
import { DISCOVERIES } from './chapter01';
import { SHADOWS_DISCOVERIES, SHADOWS_LINES } from './chapter02';

export interface NarrationLine { text: string; pause?: number }
export interface Narration {
  id: string;
  /** Butch's recording (used first, when the file exists) */
  file: string;
  /** the generated stand-in recording and its exact line starts, used until then */
  standIn?: { file: string; cues: number[]; duration: number };
  lines: NarrationLine[];
  /** start time (s) of each line in the recording, when known */
  cues?: number[];
  /** how it should be read (for the recording session; the stand-in voice ignores it) */
  delivery?: string;
}

const dir = '/audio/chapter-01';

/** a panel's narration: its own paragraphs, one subtitle line each */
const fromPanel = (id: string, body: string[]): Narration => ({ id, file: `${dir}/${id}.mp3`, lines: body.map((text) => ({ text, pause: 0.5 })) });

export const NARRATION: Record<string, Narration> = {
  opening: {
    id: 'opening', file: `${dir}/opening-intro.mp3`,
    delivery: 'Natural, first person, calm.',
    lines: [{ text: "Hey, I'm *Butch*.", pause: 0.5 }, { text: 'This is where my *story begins*.' }],
  },
  ...Object.fromEntries(Object.values({ ...DISCOVERIES, ...SHADOWS_DISCOVERIES }).map((d) => [d.id, fromPanel(d.id, d.body)])),
  ...Object.fromEntries(Object.entries(SHADOWS_LINES).map(([k, lines]) => [`shadows-${k}`, { id: `shadows-${k}`, file: `${dir}/shadows-${k}.mp3`, lines: lines.map((text) => ({ text, pause: 0.6 })) }])),
};

/** the narration each discovery panel plays when it opens (E): its own */
export const PANEL_NARRATION: Record<string, string> = Object.fromEntries(Object.keys({ ...DISCOVERIES, ...SHADOWS_DISCOVERIES }).map((id) => [id, id]));

/** a line split into words, each flagged gold or not (the asterisks removed); `glue` marks a word that follows the
 *  previous one without a space (the "..." after a gold phrase) */
export function words(text: string): { w: string; gold: boolean; glue: boolean }[] {
  const out: { w: string; gold: boolean; glue: boolean }[] = [];
  let gold = false, spaced = true;
  for (const part of text.split(/(\*)/)) {
    if (part === '*') { gold = !gold; continue; }
    for (const tok of part.split(/(\s+)/)) {
      if (!tok) continue;
      if (/^\s+$/.test(tok)) { spaced = true; continue; }
      out.push({ w: tok, gold, glue: !spaced && out.length > 0 });
      spaced = false;
    }
  }
  return out;
}

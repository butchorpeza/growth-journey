/* The narrator: plays one narration at a time (data/narration.ts) and drives the subtitles.
   - A recording at the narration's `file` (public/audio/chapter-01/…) is used when it exists: the subtitles follow
     its clock (per-line `cues` when given, otherwise the lines spread over the recording by length, and the words
     within a line by length).
   - Without one, the browser's built-in English voice reads it as a temporary stand-in (calm rate, a male voice
     where the system has one); the subtitles follow its word boundaries, or an estimate where the voice gives none.
   - Never two at once: a new narration stops the one playing. pause / resume / stop / replay; its own volume (under
     the master volume); the music and the weather duck while it speaks.
   The subtitle state is a small store (useNarration) the HUD renders. */
import { useSyncExternalStore } from 'react';
import { NARRATION, words, type Narration } from '../data/narration';
import { getGame } from '../game/GameState';
import { audio } from './AudioEngine';

export type Word = { w: string; gold: boolean; glue: boolean };
export interface NarrationState {
  id: string | null;
  line: number;            // index of the line on screen
  words: Word[];           // that line's words
  shown: number;           // how many of them are revealed
  playing: boolean;
  paused: boolean;
  ended: boolean;          // finished (the last line stays a moment, then fades)
  source: 'recording' | 'stand-in' | null;
}

const idle: NarrationState = { id: null, line: 0, words: [], shown: 0, playing: false, paused: false, ended: false, source: null };
let state: NarrationState = idle;
const listeners = new Set<() => void>();
const set = (patch: Partial<NarrationState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
export const getNarration = () => state;
export function useNarration<T>(select: (s: NarrationState) => T): T {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => select(state), () => select(idle));
}

// ---------------------------------------------------------------------------------------------- recordings
const available = new Map<string, Promise<boolean>>();
/** does the recording exist? (a missing file in dev is answered with the HTML page, so check it is audio) */
function hasRecording(file: string) {
  let p = available.get(file);
  if (!p) {
    p = fetch(file, { method: 'HEAD' }).then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('audio/')).catch(() => false);
    available.set(file, p);
  }
  return p;
}

// ---------------------------------------------------------------------------------------------- the stand-in voice
let voice: SpeechSynthesisVoice | null = null;
// the system's novelty and character voices (robotic, sung, aged): never used
const NOVELTY = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Junior|Ralph|Kathy|Fred|Grandma|Grandpa|Rocko|Eddy|Flo|Sandy|Shelley/i;
/** the most natural English voice on this device, a male one where possible: neural/premium voices first, then
 *  the better standard ones */
function pickVoice() {
  if (typeof speechSynthesis === 'undefined') return null;
  const all = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en') && !NOVELTY.test(v.name));
  const male = /Daniel|Aaron|Arthur|Nathan|Evan|Tom|Oliver|Alex|Reed|Rishi|Guy|Ryan|Davis|Andrew|Christopher|Brian|Eric|Steffan|Male/i;
  const score = (v: SpeechSynthesisVoice) =>
    (/Premium|Neural|Natural|Online/i.test(v.name) ? 40 : 0) + (/Enhanced/i.test(v.name) ? 30 : 0) + (/^Google/i.test(v.name) ? 25 : 0) +
    (male.test(v.name) ? 12 : 0) + (/en[-_](US|GB)/i.test(v.lang) ? 5 : 0) + (/^(Daniel|Aaron|Arthur)/.test(v.name) ? 4 : 0);
  voice = [...all].sort((a, b) => score(b) - score(a))[0] ?? null;
  return voice;
}
if (typeof speechSynthesis !== 'undefined') { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }

// ---------------------------------------------------------------------------------------------- playback
let level = 0.9;                       // narration volume (0…1), times the master volume
let run = 0;                           // playback generation: anything from an older one is ignored
let el: HTMLAudioElement | null = null;
let sync = 0, timer = 0, fade = 0;
let finish: ((how: 'ended' | 'stopped') => void) | null = null;
const masterVolume = () => (getGame().settings.audio ? getGame().settings.volume : 0);

function clearTimers() { clearTimeout(sync); clearTimeout(timer); clearTimeout(fade); }

function done(how: 'ended' | 'stopped', gen: number) {
  if (gen !== run) return;
  clearTimers();
  audio.duck(false);
  const f = finish; finish = null;
  if (how === 'ended') {
    set({ playing: false, paused: false, ended: true, shown: state.words.length });
    fade = window.setTimeout(() => { if (gen === run) set(idle); }, 1600);       // the last line lingers, then fades
  } else set(idle);
  f?.(how);
}

/** the narrator is switched off for now (Butch's call): nothing is spoken and no subtitles show. Set to true to
 *  bring the voice back; everything else (recordings, cues, subtitles, panel controls) is still in place. */
export const NARRATION_ENABLED = false;

/** play a narration (stopping any other); resolves when it ends or is stopped */
export function narrate(id: string): Promise<'ended' | 'stopped'> {
  if (!NARRATION_ENABLED) return Promise.resolve('ended');
  const n = NARRATION[id];
  stop();
  if (!n) return Promise.resolve('ended');
  const gen = ++run;
  return new Promise((resolve) => {
    finish = resolve;
    set({ ...idle, id, playing: true, words: words(n.lines[0].text) });
    audio.duck(true);
    // Butch's recording, else the generated stand-in recording, else the browser's own voice
    void Promise.all([hasRecording(n.file), n.standIn ? hasRecording(n.standIn.file) : Promise.resolve(false)]).then(([own, standIn]) => {
      if (gen !== run) return;
      if (own) playRecording(n, gen, n.file, n.cues);
      else if (standIn && n.standIn) playRecording(n, gen, n.standIn.file, n.standIn.cues, true);
      else playStandIn(n, gen, 0);
    });
  });
}

/** show a narration's lines as subtitles only, at a speaking pace, with no voice (used where there is no recording
 *  and none should be faked); works whether or not the voice is switched on */
export function caption(id: string): Promise<'ended' | 'stopped'> {
  const n = NARRATION[id];
  stop();
  if (!n) return Promise.resolve('ended');
  const gen = ++run;
  return new Promise((resolve) => {
    finish = resolve;
    set({ ...idle, id, playing: true, words: words(n.lines[0].text) });
    playSilent(n, gen, 0);
  });
}

function playRecording(n: Narration, gen: number, file: string, cues: number[] | undefined, standIn = false) {
  set({ source: standIn ? 'stand-in' : 'recording' });
  el = new Audio(file); el.volume = level * masterVolume();
  el.addEventListener('ended', () => done('ended', gen));
  el.addEventListener('error', () => { if (gen === run) playStandIn(n, gen, 0); });
  void el.play().catch(() => { if (gen === run) playStandIn(n, gen, 0); });
  // line start times: the cues, or the speaking time spread over the lines by their length
  const lens = n.lines.map((l) => words(l.text).reduce((a, w) => a + w.w.length + 1, 0));
  const tick = () => {
    if (gen !== run || !el) return;
    const dur = Number.isFinite(el.duration) ? el.duration : 0, t = el.currentTime;
    let starts = cues;
    if (!starts && dur) {
      const pauses = n.lines.reduce((a, l, i) => a + (i < n.lines.length - 1 ? l.pause ?? 0.3 : 0), 0);
      const speak = Math.max(0.1, dur - pauses), total = lens.reduce((a, b) => a + b, 0);
      starts = []; let acc = 0;
      n.lines.forEach((l, i) => { starts!.push(acc); acc += (lens[i] / total) * speak + (l.pause ?? 0.3); });
    }
    if (starts) {
      let i = 0; while (i + 1 < starts.length && t >= starts[i + 1]) i++;
      const end = i + 1 < starts.length ? starts[i + 1] - (n.lines[i].pause ?? 0.3) : dur;
      const ws = words(n.lines[i].text), k = Math.min(1, Math.max(0, (t - starts[i]) / Math.max(0.1, end - starts[i])));
      const chars = ws.reduce((a, w) => a + w.w.length + 1, 0);
      let shown = 0, acc = 0; for (const w of ws) { acc += w.w.length + 1; if (acc / chars <= k + 0.02) shown++; }
      if (i !== state.line || shown !== state.shown) set({ line: i, words: ws, shown: Math.max(1, shown) });
    }
    sync = window.setTimeout(tick, 40);           // a timer, not animation frames: keeps time in a background tab too
  };
  sync = window.setTimeout(tick, 40);
}

/** no voice at all (no speech engine, or it never starts): the subtitles run on their own, at a speaking pace */
function playSilent(n: Narration, gen: number, i: number) {
  const line = n.lines[i], ws = words(line.text);
  set({ source: null, line: i, words: ws, shown: 0 });
  let k = 0;
  const step = () => {
    if (gen !== run) return;
    if (state.paused) { timer = window.setTimeout(step, 120); return; }
    set({ shown: ++k });
    if (k < ws.length) timer = window.setTimeout(step, 330);
    else if (i + 1 < n.lines.length) timer = window.setTimeout(() => { if (gen === run) playSilent(n, gen, i + 1); }, 450 + (line.pause ?? 0.3) * 1000);
    else timer = window.setTimeout(() => done('ended', gen), 600);
  };
  timer = window.setTimeout(step, 150);
}

function playStandIn(n: Narration, gen: number, i: number) {
  if (typeof speechSynthesis === 'undefined') { playSilent(n, gen, i); return; }
  const line = n.lines[i], ws = words(line.text);
  set({ source: 'stand-in', line: i, words: ws, shown: 0 });
  const u = new SpeechSynthesisUtterance(line.text.replace(/\*/g, ''));
  u.voice = voice ?? pickVoice(); u.lang = u.voice?.lang ?? 'en-US';
  u.rate = 0.95; u.pitch = 1; u.volume = level * masterVolume();   // natural pitch: lowering it sounds more mechanical
  // word boundaries (char index → word count); an estimate where the voice reports none
  const starts: number[] = []; { let c = 0; const plain = line.text.replace(/\*/g, ''); for (const w of ws) { const at = plain.indexOf(w.w.replace(/\*/g, ''), c); starts.push(at < 0 ? c : at); c = (at < 0 ? c : at) + w.w.length; } }
  let boundaries = false, began = 0;
  let started = false;
  u.onstart = () => {
    started = true;
    began = performance.now();
    const est = () => {
      if (gen !== run || boundaries) return;
      if (!state.paused) set({ shown: Math.min(ws.length, 1 + Math.floor((performance.now() - began) / 360)) });
      timer = window.setTimeout(est, 120);
    };
    timer = window.setTimeout(est, 450);
  };
  u.onboundary = (e) => {
    if (gen !== run || e.name !== 'word') return;
    boundaries = true;
    let k = 0; while (k < starts.length && starts[k] <= e.charIndex) k++;
    set({ shown: Math.max(state.shown, k) });
  };
  u.onend = () => {
    if (gen !== run) return;
    clearTimeout(timer);
    set({ shown: ws.length });
    if (i + 1 < n.lines.length) timer = window.setTimeout(() => { if (gen === run) playStandIn(n, gen, i + 1); }, (line.pause ?? 0.3) * 1000 + 250);
    else done('ended', gen);
  };
  u.onerror = () => { if (gen === run) done('ended', gen); };
  (window as unknown as { __utterance?: SpeechSynthesisUtterance }).__utterance = u;   // keep it alive (Chrome drops events otherwise)
  speechSynthesis.speak(u);
  // a speech engine without a usable voice never starts: carry on silently rather than wait
  timer = window.setTimeout(() => { if (gen === run && !started) { speechSynthesis.cancel(); playSilent(n, gen, i); } }, 1500);
}

/** stop whatever is playing (subtitles clear at once) */
export function stop() {
  if (!state.id && !finish) return;
  run++;
  el?.pause(); el = null;
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  clearTimers();
  audio.duck(false);
  const f = finish; finish = null;
  set(idle);
  f?.('stopped');
}

export function pause() {
  if (!state.playing || state.paused) return;
  el?.pause(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.pause();
  set({ paused: true });
}
export function resume() {
  if (!state.paused) return;
  void el?.play().catch(() => {}); if (typeof speechSynthesis !== 'undefined') speechSynthesis.resume();
  set({ paused: false });
}
export function replay() { const id = state.id; if (id) void narrate(id); }

/** narration volume (0…1) under the master volume */
export function setNarrationVolume(v: number) { level = v; if (el) el.volume = level * masterVolume(); }

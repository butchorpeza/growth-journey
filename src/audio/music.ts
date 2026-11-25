/* Chapter 01's background score, generated live (no recording, so it never audibly loops and needs no licence).
   A slow, quiet, melancholic piece for a night of survival in the rain:
   - a soft pad: D minor → B♭ → F → C (i–VI–III–VII), each chord ~9.6 s with long, overlapping swells, two
     slightly detuned voices per note, warm (low-passed) and wide (a generated hall reverb);
   - a low bass on each chord's root, felt more than heard;
   - now and then a short phrase of gong-like notes from the D minor pentatonic (a nod to the kulintang): a sine
     with a soft metallic overtone, a long decay and an echo, never on every chord, never the same twice.
   Everything is scheduled on the audio clock a little ahead of time; `scheduleUntil` is called every few seconds
   while it plays (and once, far ahead, for offline tests). The caller sets the level (it sits well under the rain). */

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// D3 = 50. Chords as MIDI notes (pad voicing) with their bass root.
const CHORDS: { pad: number[]; bass: number }[] = [
  { pad: [50, 53, 57, 62], bass: 38 },     // D minor
  { pad: [46, 50, 53, 58], bass: 34 },     // B♭ major
  { pad: [48, 53, 57, 60], bass: 41 },     // F major, with C under it (a softer move from B♭)
  { pad: [48, 52, 55, 60], bass: 36 },     // C major
];
const PENTATONIC = [62, 65, 67, 69, 72, 74, 77, 79];   // D minor pentatonic, D4–G5
const CHORD_S = 9.6;

export interface Score { stop: (fade?: number) => void; scheduleUntil: (t: number) => void }

function hallImpulse(ctx: BaseAudioContext, seconds: number) {
  const n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
  }
  return buf;
}

export function survivalScore(ctx: BaseAudioContext, out: AudioNode): Score {
  const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(out);
  bus.gain.setTargetAtTime(1, ctx.currentTime, 3);                         // a slow fade in
  // space: a long, soft hall, mostly wet for the pad and the gongs
  const verb = ctx.createConvolver(); verb.buffer = hallImpulse(ctx, 4.5);
  const verbOut = ctx.createGain(); verbOut.gain.value = 0.55; verb.connect(verbOut).connect(bus);
  const warm = ctx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 1100; warm.Q.value = 0.3;
  const padBus = ctx.createGain(); padBus.gain.value = 0.11;
  padBus.connect(warm); warm.connect(bus); warm.connect(verb);
  // the gongs' echo: a dotted, darkening repeat
  const echo = ctx.createDelay(2); echo.delayTime.value = 0.72;
  const echoFb = ctx.createGain(); echoFb.gain.value = 0.32;
  const echoDark = ctx.createBiquadFilter(); echoDark.type = 'lowpass'; echoDark.frequency.value = 1600;
  const gongBus = ctx.createGain(); gongBus.gain.value = 0.07;
  gongBus.connect(bus); gongBus.connect(verb); gongBus.connect(echo);
  echo.connect(echoDark).connect(echoFb).connect(echo); echoDark.connect(verb); echoDark.connect(bus);

  let next = ctx.currentTime + 0.5, chord = 0, stopped = false, lastGongChord = -2;

  const padNote = (f: number, t: number, len: number, level: number) => {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 3.2);                        // slow swell in
    g.gain.setValueAtTime(level, t + len - 1);
    g.gain.linearRampToValueAtTime(0, t + len + 3.5);                      // and a long release into the next chord
    g.connect(padBus);
    for (const [detune, type] of [[-6, 'triangle'], [5, 'sine']] as [number, OscillatorType][]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
      o.connect(g); o.start(t); o.stop(t + len + 3.6);
    }
  };
  const bassNote = (f: number, t: number, len: number) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 2.5);
    g.gain.setValueAtTime(0.16, t + len - 1); g.gain.linearRampToValueAtTime(0, t + len + 2);
    o.connect(g).connect(bus); o.start(t); o.stop(t + len + 2.1);
  };
  const gong = (f: number, t: number, level: number) => {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, t + 3.2);
    g.connect(gongBus);
    // the body, plus a quiet inharmonic overtone (a struck bronze boss, not a bell)
    for (const [mult, amp] of [[1, 1], [2.76, 0.18], [5.4, 0.05]]) {
      const o = ctx.createOscillator(), a = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * mult; a.gain.value = amp;
      o.connect(a).connect(g); o.start(t); o.stop(t + 3.3);
    }
  };

  const scheduleUntil = (until: number) => {
    while (!stopped && next < until) {
      const c = CHORDS[chord % CHORDS.length];
      c.pad.forEach((n, i) => padNote(midi(n), next, CHORD_S, i === 0 ? 0.32 : 0.24));
      bassNote(midi(c.bass), next, CHORD_S);
      // a gong phrase on some chords (never two chords running), 2–4 notes, rising or falling
      if (chord - lastGongChord > 1 && Math.random() < 0.55) {
        lastGongChord = chord;
        const notes = 2 + Math.floor(Math.random() * 3), start = Math.floor(Math.random() * (PENTATONIC.length - notes));
        const up = Math.random() < 0.5;
        let t = next + 2.5 + Math.random() * 3;
        for (let i = 0; i < notes; i++) {
          const n = PENTATONIC[up ? start + i : start + notes - 1 - i];
          gong(midi(n), t, 0.55 + Math.random() * 0.25);
          t += 0.55 + Math.random() * 0.7;
        }
      }
      next += CHORD_S; chord++;
    }
  };

  return {
    scheduleUntil,
    stop: (fade = 1.2) => {
      stopped = true;
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setTargetAtTime(0, ctx.currentTime, fade);
      if (typeof window !== 'undefined') window.setTimeout(() => bus.disconnect(), fade * 6000);   // notes already scheduled play out silently
    },
  };
}

/* Chapter 02's score: no melody, only unease, generated live like Chapter 01's.
   - a low drone: two close notes (A1 and B♭1) beating slowly against each other through a dark filter that breathes;
   - a high, thin tone that appears and fades, a little out of tune with everything;
   - now and then a few notes of a detuned, music-box-like bell, far off in the reverb, falling by semitones;
   - a deep pulse, like a slow heartbeat felt more than heard, that comes and goes. */
export function shadowsScore(ctx: BaseAudioContext, out: AudioNode): Score {
  const bus = ctx.createGain(); bus.gain.value = 0; bus.connect(out);
  bus.gain.setTargetAtTime(1, ctx.currentTime, 4);
  const verb = ctx.createConvolver(); verb.buffer = hallImpulse(ctx, 6);
  const wet = ctx.createGain(); wet.gain.value = 0.7; verb.connect(wet).connect(bus);
  const nodes: AudioScheduledSourceNode[] = [];
  const lfo = (f: number, depth: number, target: AudioParam) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = depth; o.connect(g).connect(target); o.start(); nodes.push(o); };
  // the drone
  const dark = ctx.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 240; dark.Q.value = 2;
  const droneG = ctx.createGain(); droneG.gain.value = 0.13; dark.connect(droneG); droneG.connect(bus); droneG.connect(verb);
  for (const [n, type, det] of [[33, 'sawtooth', -4], [34, 'sawtooth', 3], [21, 'sine', 0], [45, 'triangle', 7]] as [number, OscillatorType, number][]) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = midi(n); o.detune.value = det; o.connect(dark); o.start(); nodes.push(o);
  }
  lfo(0.045, 120, dark.frequency); lfo(0.023, 0.05, droneG.gain);
  // the thin high tone
  const hi = ctx.createOscillator(); hi.type = 'sine'; hi.frequency.value = midi(88) * 1.012;
  const hiG = ctx.createGain(); hiG.gain.value = 0; hi.connect(hiG); hiG.connect(verb); hi.start(); nodes.push(hi);
  lfo(0.017, 0.012, hiG.gain); lfo(0.13, 4, hi.detune);
  let next = ctx.currentTime + 6, stopped = false;
  const bell = (f: number, t: number, level: number) => {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, t + 2.6);
    g.connect(verb); const dry = ctx.createGain(); dry.gain.value = 0.25; g.connect(dry).connect(bus);
    for (const [mult, amp] of [[1, 1], [3.01, 0.3], [5.97, 0.12]]) {
      const o = ctx.createOscillator(), a = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * mult; o.detune.value = -18 + Math.random() * 10; a.gain.value = amp;
      o.connect(a).connect(g); o.start(t); o.stop(t + 2.7);
    }
  };
  const pulse = (t: number) => {
    for (const [dt, lv] of [[0, 0.22], [0.32, 0.14]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(58, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.3);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(lv, t + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + dt + 0.45);
      o.connect(g).connect(bus); o.start(t + dt); o.stop(t + dt + 0.5);
    }
  };
  const scheduleUntil = (until: number) => {
    while (!stopped && next < until) {
      const r = Math.random();
      if (r < 0.45) {                                      // a falling phrase on the bell
        let t = next, n = 81 + Math.floor(Math.random() * 6);
        for (let i = 0, k = 3 + Math.floor(Math.random() * 3); i < k; i++) { bell(midi(n), t, 0.05 + Math.random() * 0.03); n -= Math.random() < 0.7 ? 1 : 3; t += 0.7 + Math.random() * 0.9; }
      } else if (r < 0.8) {                                // a run of slow heartbeats
        for (let i = 0, k = 6 + Math.floor(Math.random() * 6); i < k; i++) pulse(next + i * 1.25);
      }
      next += 12 + Math.random() * 10;
    }
  };
  return {
    scheduleUntil,
    stop: (fade = 1.5) => {
      stopped = true;
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setTargetAtTime(0, ctx.currentTime, fade);
      if (typeof window !== 'undefined') window.setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* stopped */ } }); bus.disconnect(); }, fade * 6000);
    },
  };
}

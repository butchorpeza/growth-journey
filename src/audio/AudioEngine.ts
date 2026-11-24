/* Sound for the journey (Web Audio). Muted until the visitor turns it on (browsers also require a click first).
   - Footsteps: Kenney "Impact Sounds" recordings (CC0), five takes per surface, slight random pitch and level so
     no two steps sound the same.
   - Ambience, generated live so it never audibly loops. "tropical-rain": rain bed, rumble, gusts and rain drumming
     on the roof when under one. "tropical-day": a breeze that swells and fades
     (filtered noise), cicadas and insects (band-passed noise with a fast pulse and slow swells), and birdsong
     (short synthesised phrases at random times, panned around the listener). */

export type Surface = 'grass' | 'concrete' | 'wood';
type Ambience = 'tropical-day' | 'tropical-rain' | null;

const STEP_FILES: Record<Surface, string[]> = {
  grass: [0, 1, 2, 3, 4].map((i) => `footstep_grass_00${i}.ogg`),
  concrete: [0, 1, 2, 3, 4].map((i) => `footstep_concrete_00${i}.ogg`),
  wood: [0, 1, 2, 3, 4].map((i) => `footstep_wood_00${i}.ogg`),
};

class Engine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private steps = new Map<Surface, AudioBuffer[]>();
  private ambience: { stop: () => void } | null = null;
  private ambienceKind: Ambience = null;
  private lastStep = -1;
  private roof: GainNode | null = null;
  private outdoorFilter: BiquadFilterNode | null = null;
  private bed: GainNode | null = null;          // the ambience bus (rain, insects), ducked near the portal

  get running() { return this.ctx?.state === 'running'; }

  /** call from a click/keypress handler (browsers only allow audio to start after a user gesture) */
  async enable(volume: number) {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.bed = this.ctx.createGain(); this.bed.connect(this.master);
      void this.loadSteps();
    }
    this.master!.gain.value = volume;
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
    if (this.ambienceKind && !this.ambience) this.startAmbience(this.ambienceKind);
  }

  disable() {
    this.ambience?.stop(); this.ambience = null;
    void this.ctx?.suspend();
  }

  /** 0…1: how much the visitor is under a roof while it rains (rain drumming on corrugated iron) */
  setRoof(v: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.roof?.gain.setTargetAtTime(v, t, 0.4);
    this.outdoorFilter?.frequency.setTargetAtTime(v > 0.5 ? 1300 : 9000, t, 0.4);   // indoors: rain heard through walls
  }

  setVolume(v: number) { if (this.master) this.master.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.1); }

  setAmbience(kind: Ambience) {
    if (kind === this.ambienceKind) return;
    this.ambienceKind = kind;
    this.ambience?.stop(); this.ambience = null;
    if (kind && this.running) this.startAmbience(kind);
  }

  private async loadSteps() {
    const base = `${import.meta.env.BASE_URL}audio/footsteps/`;
    for (const [surface, files] of Object.entries(STEP_FILES) as [Surface, string[]][]) {
      const bufs = await Promise.all(files.map((f) => fetch(base + f).then((r) => r.arrayBuffer()).then((b) => this.ctx!.decodeAudioData(b)).catch(() => null)));
      this.steps.set(surface, bufs.filter((b): b is AudioBuffer => !!b));
    }
  }

  /** one footstep; loudness 0…1 (walk ≈ 0.45, run ≈ 0.75, landing ≈ 1) */
  footstep(surface: Surface, loudness: number) {
    const ctx = this.ctx, bufs = this.steps.get(surface);
    if (!ctx || !this.running || !bufs?.length) return;
    let i = Math.floor(Math.random() * bufs.length);
    if (i === this.lastStep) i = (i + 1) % bufs.length;           // never the same take twice in a row
    this.lastStep = i;
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = bufs[i];
    src.playbackRate.value = 0.9 + Math.random() * 0.16;
    f.type = 'lowpass'; f.frequency.value = 2400 + loudness * 6000;  // soft steps are duller
    g.gain.value = (surface === 'grass' ? 0.9 : 0.6) * loudness * (0.85 + Math.random() * 0.3);
    src.connect(f).connect(g).connect(this.master!);
    src.start();
  }

  private noiseBuffer(seconds: number, brown = false) {
    const ctx = this.ctx!, n = ctx.sampleRate * seconds, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  private loopNoise(brown: boolean) {
    const s = this.ctx!.createBufferSource(); s.buffer = this.noiseBuffer(6, brown); s.loop = true; s.start(); return s;
  }

  private lfo(freq: number, depth: number, target: AudioParam) {
    const o = this.ctx!.createOscillator(), g = this.ctx!.createGain();
    o.frequency.value = freq; g.gain.value = depth; o.connect(g).connect(target); o.start(); return o;
  }

  private startAmbience(kind: Exclude<Ambience, null>) {
    if (kind === 'tropical-rain') { this.startRain(); return; }
    if (kind !== 'tropical-day') return;
    const ctx = this.ctx!, out = ctx.createGain(); out.gain.value = 0; out.connect(this.bed!);
    out.gain.setTargetAtTime(1, ctx.currentTime, 1.5);              // fade in
    const nodes: AudioScheduledSourceNode[] = [];

    // breeze: brown noise, low-passed, swelling slowly
    const wind = this.loopNoise(true), wf = ctx.createBiquadFilter(), wg = ctx.createGain();
    wf.type = 'lowpass'; wf.frequency.value = 520; wf.Q.value = 0.4; wg.gain.value = 0.22;
    wind.connect(wf).connect(wg).connect(out);
    nodes.push(wind, this.lfo(0.07, 0.12, wg.gain), this.lfo(0.05, 220, wf.frequency));

    // cicadas / insects: band-passed noise, pulsing fast, swelling slowly
    const bug = this.loopNoise(false), bf = ctx.createBiquadFilter(), pulse = ctx.createGain(), bg = ctx.createGain();
    bf.type = 'bandpass'; bf.frequency.value = 4800; bf.Q.value = 6; pulse.gain.value = 0.5; bg.gain.value = 0.035;
    bug.connect(bf).connect(pulse).connect(bg).connect(out);
    nodes.push(bug, this.lfo(31, 0.5, pulse.gain), this.lfo(0.11, 0.025, bg.gain));

    // birds: short phrases at random times from random directions
    let alive = true, timer = 0;
    const phrase = () => {
      if (!alive) return;
      const t0 = ctx.currentTime + 0.05, pan = ctx.createStereoPanner(), g = ctx.createGain();
      pan.pan.value = Math.random() * 1.6 - 0.8; g.gain.value = 0.05 + Math.random() * 0.05;
      g.connect(pan).connect(out);
      const notes = 2 + Math.floor(Math.random() * 4), base = 2200 + Math.random() * 1800;
      for (let i = 0; i < notes; i++) {
        const o = ctx.createOscillator(), e = ctx.createGain(), t = t0 + i * (0.09 + Math.random() * 0.08), len = 0.05 + Math.random() * 0.07;
        o.type = 'sine';
        o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), t);
        o.frequency.exponentialRampToValueAtTime(base * (1.15 + Math.random() * 0.5), t + len);
        e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + 0.01); e.gain.exponentialRampToValueAtTime(0.001, t + len);
        o.connect(e).connect(g); o.start(t); o.stop(t + len + 0.02);
      }
      timer = window.setTimeout(phrase, 2500 + Math.random() * 7000);
    };
    timer = window.setTimeout(phrase, 1500);

    this.ambience = {
      stop: () => {
        alive = false; clearTimeout(timer);
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
        window.setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); out.disconnect(); }, 1500);
      },
    };
  }

  /** monsoon rain: a broadband rain bed, a low rumble and gusting wind outdoors. Under a roof (setRoof) the outdoor
   *  rain is muffled, as heard through walls, and a soft, steady patter on the corrugated iron fades in — a gentle
   *  band of noise with slow swells, never a pulsing buzz. */
  private startRain() {
    const ctx = this.ctx!, out = ctx.createGain(); out.gain.value = 0; out.connect(this.bed!);
    out.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
    const nodes: AudioScheduledSourceNode[] = [];
    const outdoor = ctx.createBiquadFilter(); outdoor.type = 'lowpass'; outdoor.frequency.value = 9000; outdoor.connect(out);
    const bed = this.loopNoise(false), hp = ctx.createBiquadFilter(), bg = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 450; bg.gain.value = 0.14;
    bed.connect(hp).connect(bg).connect(outdoor);
    nodes.push(bed, this.lfo(0.09, 0.025, bg.gain));
    const rumble = this.loopNoise(true), rf = ctx.createBiquadFilter(), rg = ctx.createGain();
    rf.type = 'lowpass'; rf.frequency.value = 600; rg.gain.value = 0.12;
    rumble.connect(rf).connect(rg).connect(outdoor);
    nodes.push(rumble);
    const wind = this.loopNoise(true), wf = ctx.createBiquadFilter(), wg = ctx.createGain();
    wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.7; wg.gain.value = 0.1;
    wind.connect(wf).connect(wg).connect(outdoor);
    nodes.push(wind, this.lfo(0.06, 0.07, wg.gain), this.lfo(0.04, 160, wf.frequency));
    // rain on the tin roof: soft mid-high patter, slow swells only
    const roofSrc = this.loopNoise(false), roofBp = ctx.createBiquadFilter(), roofLp = ctx.createBiquadFilter(), roofLevel = ctx.createGain();
    roofBp.type = 'bandpass'; roofBp.frequency.value = 1700; roofBp.Q.value = 0.6;
    roofLp.type = 'lowpass'; roofLp.frequency.value = 4200; roofLevel.gain.value = 0.09;
    const roof = ctx.createGain(); roof.gain.value = 0;
    roofSrc.connect(roofBp).connect(roofLp).connect(roofLevel).connect(roof).connect(out);
    nodes.push(roofSrc, this.lfo(0.23, 0.02, roofLevel.gain));
    this.roof = roof; this.outdoorFilter = outdoor;
    this.ambience = {
      stop: () => {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.4); this.roof = null; this.outdoorFilter = null;
        window.setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); out.disconnect(); }, 1500);
      },
    };
  }

  /** thunder `delay` seconds from now; loudness 0…1 (near strikes crack, far ones only rumble) */
  thunder(delay: number, loudness: number) {
    const ctx = this.ctx;
    if (!ctx || !this.running) return;
    const t0 = ctx.currentTime + delay, dur = 3.5 + Math.random() * 3;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(dur + 0.5, true);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(220 + loudness * 900, t0); lp.frequency.exponentialRampToValueAtTime(90, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.9 * loudness, t0 + 0.08 + (1 - loudness) * 0.5);     // near: sharp crack; far: slow swell
    g.gain.exponentialRampToValueAtTime(0.25 * loudness, t0 + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(lp).connect(g).connect(this.master!);
    src.start(t0); src.stop(t0 + dur + 0.2);
  }

  /** the demonic portal, all generated live and placed in the stereo field where the portal is. `level` 0…1 by
   *  proximity, `pan` -1…1 (left…right of the view). Voiced mostly in the 100 Hz – 3 kHz range so it carries on
   *  laptop and phone speakers (which play almost nothing below ~120 Hz), all through a dark, cavernous echo:
   *  - a dissonant drone: a low chord with a tritone in it, saws under a slowly breathing filter, plus sub-bass
   *  - a growling voice: a distorted low saw through two vocal formants that drift between vowels, with a
   *    gravelly rattle and an uneven breath
   *  - a chant: a deep detuned "aah" that swells and fades
   *  - whispers: bursts of hissing noise in phrases, scattered left and right
   *  - groans every 5–10 s (distorted, sliding down in pitch, with a rumble), and a roar the first time the
   *    visitor comes near
   *  The rain and insects duck while the portal is loud. */
  private portal: { bus: GainNode; pan: StereoPannerNode; level: number; timers: number[]; roared: boolean; roar: () => void } | null = null;
  setPortal(level: number, pan = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.running) return;
    if (!this.portal && level > 0) this.portal = this.buildPortal(ctx);
    const p = this.portal; if (!p) return;
    p.level = level;
    const t = ctx.currentTime;
    p.bus.gain.setTargetAtTime(Math.pow(level, 1.3) * 1.1, t, 0.3);
    p.pan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, pan)), t, 0.15);
    this.bed?.gain.setTargetAtTime(1 - 0.55 * level, t, 0.5);
    if (level > 0.55 && !p.roared) { p.roared = true; p.roar(); }
    if (level < 0.2) p.roared = false;                     // walk away and back: it roars again
  }

  private distortion(ctx: AudioContext, drive: number) {
    const w = ctx.createWaveShaper();
    w.curve = Float32Array.from({ length: 2048 }, (_, i) => Math.tanh((i / 1023.5 - 1) * drive));
    w.oversample = '2x';
    return w;
  }

  private buildPortal(ctx: AudioContext) {
    const bus = ctx.createGain(); bus.gain.value = 0;
    const pan = ctx.createStereoPanner();
    // a cavernous echo: a feedback delay, darkened each time round
    const dry = ctx.createGain(), wet = ctx.createGain(); wet.gain.value = 0.5;
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.29;
    const fb = ctx.createGain(); fb.gain.value = 0.48;
    const dark = ctx.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 1800;
    dry.connect(delay); delay.connect(dark).connect(fb).connect(delay); dark.connect(wet);
    // a gentle limiter so the layers can be loud without clipping
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.01; comp.release.value = 0.3;
    dry.connect(comp); wet.connect(comp); comp.connect(bus); bus.connect(pan).connect(this.master!);

    // dissonant drone: D2, G#2 (the tritone), D3, a beating A2 pair; plus sub-bass for big speakers
    const droneF = ctx.createBiquadFilter(); droneF.type = 'lowpass'; droneF.frequency.value = 700; droneF.Q.value = 4;
    this.lfo(0.09, 350, droneF.frequency);
    const drone = ctx.createGain(); drone.gain.value = 0.32;
    for (const [f, type] of [[73.4, 'sawtooth'], [103.8, 'sawtooth'], [146.8, 'sawtooth'], [110.0, 'sawtooth'], [110.7, 'sawtooth'], [36.7, 'sine']] as [number, OscillatorType][]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(droneF); o.start();
    }
    droneF.connect(drone).connect(dry);
    this.lfo(0.13, 0.08, drone.gain);

    // growling voice: saw → distortion (harmonics that small speakers can play) → formants → rattle → breath
    const voice = ctx.createOscillator(); voice.type = 'sawtooth'; voice.frequency.value = 82;
    this.lfo(0.37, 3, voice.frequency);
    const vPre = ctx.createGain(); vPre.gain.value = 0.8;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 480; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1050; f2.Q.value = 8;
    this.lfo(0.07, 160, f1.frequency); this.lfo(0.093, 330, f2.frequency);
    const rattle = ctx.createGain(); rattle.gain.value = 0.6;
    this.lfo(26, 0.4, rattle.gain);
    const breath = ctx.createGain(); breath.gain.value = 0.55;
    this.lfo(0.17, 0.35, breath.gain); this.lfo(0.061, 0.2, breath.gain);
    const vMix = ctx.createGain(); vMix.gain.value = 2.2;
    const vDist = this.distortion(ctx, 3);
    voice.connect(vPre).connect(vDist);
    vDist.connect(f1).connect(vMix); vDist.connect(f2).connect(vMix);
    vMix.connect(rattle).connect(breath).connect(dry);
    voice.start();

    // chant: a deep, detuned "aah" (formants ~700 / 1150 Hz) that swells in and out
    const chant = ctx.createGain(); chant.gain.value = 0.12;
    this.lfo(0.045, 0.11, chant.gain);
    const cf1 = ctx.createBiquadFilter(); cf1.type = 'bandpass'; cf1.frequency.value = 700; cf1.Q.value = 7;
    const cf2 = ctx.createBiquadFilter(); cf2.type = 'bandpass'; cf2.frequency.value = 1150; cf2.Q.value = 9;
    for (const f of [110, 110.9, 109.2, 164.8]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; this.lfo(4.8 + Math.random(), 0.6, o.frequency);
      o.connect(cf1); o.connect(cf2); o.start();
    }
    const cMix = ctx.createGain(); cMix.gain.value = 3;
    cf1.connect(cMix); cf2.connect(cMix); cMix.connect(chant).connect(dry);

    const p = { bus, pan, level: 0, timers: [] as number[], roared: false, roar: () => {} };

    // whispers, in phrases of 4–9 syllables
    const whisper = () => {
      p.timers[0] = window.setTimeout(whisper, (1.2 + Math.random() * 3) * 1000);
      if (!this.running || p.level < 0.05) return;
      const n = 4 + Math.floor(Math.random() * 6);
      let t = ctx.currentTime + 0.05;
      for (let i = 0; i < n; i++) {
        const dur = 0.08 + Math.random() * 0.22;
        const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(dur + 0.1);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3 + Math.random() * 5;
        bp.frequency.setValueAtTime(1600 + Math.random() * 2400, t); bp.frequency.linearRampToValueAtTime(1300 + Math.random() * 1800, t + dur);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.35 + Math.random() * 0.25, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
        const sp = ctx.createStereoPanner(); sp.pan.value = Math.random() * 1.6 - 0.8;
        src.connect(bp).connect(g).connect(sp).connect(dry);
        src.start(t); src.stop(t + dur + 0.05);
        t += dur + 0.03 + Math.random() * 0.12;
      }
    };

    // a groan (or, louder and longer, a roar): a distorted voice sliding down, with a rumble beneath
    const groan = (loud: number, dur: number) => {
      const t = ctx.currentTime + 0.05, f0 = 95 + Math.random() * 35;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + dur);
      const o2 = ctx.createOscillator(); o2.type = 'square';
      o2.frequency.setValueAtTime(f0 * 0.503, t); o2.frequency.exponentialRampToValueAtTime(f0 * 0.25, t + dur);
      const fm = ctx.createBiquadFilter(); fm.type = 'bandpass'; fm.Q.value = 3;
      fm.frequency.setValueAtTime(800, t); fm.frequency.linearRampToValueAtTime(420, t + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(loud, t + 0.35); g.gain.setValueAtTime(loud, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
      const pre = ctx.createGain(); pre.gain.value = 0.9;
      o.connect(pre); o2.connect(pre);
      pre.connect(this.distortion(ctx, 5)).connect(fm).connect(lp).connect(g).connect(dry);
      const rum = ctx.createBufferSource(); rum.buffer = this.noiseBuffer(dur + 0.2, true);
      const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 160;
      const rg = ctx.createGain(); rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(loud * 1.6, t + 0.5); rg.gain.linearRampToValueAtTime(0, t + dur);
      rum.connect(rlp).connect(rg).connect(dry);
      for (const n of [o, o2, rum]) { n.start(t); n.stop(t + dur + 0.1); }
    };
    const groans = () => {
      p.timers[1] = window.setTimeout(groans, (5 + Math.random() * 5) * 1000);
      if (this.running && p.level >= 0.08) groan(0.6, 2 + Math.random() * 1.5);
    };
    p.roar = () => groan(1.0, 3.8);
    p.timers[0] = window.setTimeout(whisper, 1500);
    p.timers[1] = window.setTimeout(groans, 3000);
    return p;
  }
}

export const audio = new Engine();

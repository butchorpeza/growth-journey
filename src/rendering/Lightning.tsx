/* Lightning for stormy looks. Every 7–20 s a strike: two or three quick pulses (~0.5 s in all) that light the sky
   (background), the whole landscape (environment light) and add a cold flash from above, followed by thunder after
   a distance delay (sound travels ~340 m/s: 1–4 s). Turned off with reduced motion, for visitors sensitive to
   flashing light; pulses are always spaced well under 3 flashes per second. */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { DirectionalLight } from 'three';
import { audio } from '../audio/AudioEngine';
import { getGame } from '../game/GameState';
import type { Look } from './looks';

/** the current flash (0…1, read by skies and seas that light up with it); `strike()` calls one now (a scripted
 *  reveal), whatever the timer says */
export const lightningState = { k: 0, forced: false, envScale: 1, strike() { this.forced = true; } };

export function Lightning({ look }: { look: Look }) {
  const scene = useThree((s) => s.scene);
  const flash = useRef<DirectionalLight>(null);
  const st = useRef({ next: 4 + Math.random() * 5, t: 0, pulses: [] as [number, number][] });
  const strength = look.weather?.lightning ?? 0;

  useFrame((_, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 0), 0.1), s = st.current;
    if (strength <= 0 || getGame().settings.reducedMotion) { lightningState.k = 0; lightningState.forced = false; scene.environmentIntensity = look.sky.envIntensity * lightningState.envScale; scene.backgroundIntensity = look.sky.backgroundIntensity; if (flash.current) flash.current.intensity = 0; return; }
    s.t += dt;
    if (s.t >= s.next || lightningState.forced) {
      lightningState.forced = false;
      // a strike: 2–3 pulses, each a sharp rise and quick decay
      const n = 2 + Math.floor(Math.random() * 2);
      s.pulses = Array.from({ length: n }, (_, i) => [s.t + i * (0.11 + Math.random() * 0.12), 0.6 + Math.random() * 0.4] as [number, number]);
      s.next = s.t + 7 + Math.random() * 13;
      const near = Math.random();
      audio.thunder(1 + (1 - near) * 3, 0.5 + near * 0.5);
    }
    let k = 0;
    for (const [at, amp] of s.pulses) { const x = s.t - at; if (x >= 0 && x < 0.35) k = Math.max(k, amp * Math.exp(-x * 14)); }
    lightningState.k = k * strength;
    scene.environmentIntensity = (look.sky.envIntensity + k * 1.6 * strength) * lightningState.envScale;
    scene.backgroundIntensity = look.sky.backgroundIntensity + k * 1.3 * strength;
    if (flash.current) flash.current.intensity = k * 4 * strength;
  });

  return <directionalLight ref={flash} position={[-30, 80, -20]} color="#cfdcff" intensity={0} />;
}

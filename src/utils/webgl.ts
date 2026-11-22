/** Decide how much 3D this device should get. 'off' = HTML-only fallback (no WebGL, or Save-Data). */
import type { Quality } from '../state/journey';

export function detectQuality(): Quality {
  if (typeof window === 'undefined') return 'off';
  const params = new URLSearchParams(window.location.search);
  const forced = params.get('quality');
  if (forced === 'off' || forced === 'low' || forced === 'high') return forced;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'off';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    return 'off';
  }
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return 'off';
  const smallScreen = window.matchMedia('(max-width: 700px)').matches;
  const lowMemory = (nav.deviceMemory ?? 8) <= 4;
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  return smallScreen || lowMemory || fewCores ? 'low' : 'high';
}

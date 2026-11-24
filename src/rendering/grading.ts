/* Colour grading effects for the post-processing chain (postprocessing.Effect, merged into the composer's passes).
   ExposureBalance runs on the HDR image BEFORE tone mapping: exposure in stops + white balance (temperature/tint),
   like a camera. FilmGrade runs AFTER tone mapping, in display space: ASC-CDL-style lift/gamma/gain, contrast
   around mid-grey, saturation, and split toning that adds only the *hue* of the shadow/highlight tints (luminance
   stays put, so grades never crush or blow out). All terms are neutral at their default values. */
import { Effect } from 'postprocessing';
import { Uniform, Vector3 } from 'three';
import type { RGB } from './looks';

const exposureFrag = /* glsl */ `
uniform float exposure;
uniform vec3 balance;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * exp2(exposure) * balance, inputColor.a);
}`;

export class ExposureBalanceEffect extends Effect {
  constructor() {
    super('ExposureBalanceEffect', exposureFrag, {
      uniforms: new Map<string, Uniform>([['exposure', new Uniform(0)], ['balance', new Uniform(new Vector3(1, 1, 1))]]),
    });
  }
  set(exposure: number, temperature: number, tint: number) {
    this.uniforms.get('exposure')!.value = exposure;
    // simple white balance: warm = more red, less blue; tint = green ↔ magenta. Normalised to keep luminance.
    const r = 1 + temperature * 0.14 + tint * 0.05, g = 1 - tint * 0.09, b = 1 - temperature * 0.16 + tint * 0.05;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    (this.uniforms.get('balance')!.value as Vector3).set(r / l, g / l, b / l);
  }
}

const gradeFrag = /* glsl */ `
uniform float contrast;
uniform float saturation;
uniform float splitBalance;
uniform vec3 lift;
uniform vec3 gammaV;
uniform vec3 gain;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = pow(max(inputColor.rgb, 0.0), vec3(1.0 / 2.2));          // to display space
  c = gain * (c + lift * (1.0 - c));                                  // lift / gain
  c = pow(max(c, 0.0), 1.0 / max(gammaV, vec3(0.01)));               // gamma
  c = (c - 0.5) * contrast + 0.5;                                     // contrast around mid-grey
  float l = dot(c, LUMA);
  c = mix(vec3(l), c, saturation);                                    // saturation
  float w = smoothstep(0.0, 1.0, l + splitBalance);                   // split toning: hue only
  c += (shadowTint - dot(shadowTint, LUMA)) * (1.0 - w) * 0.18 + (highlightTint - dot(highlightTint, LUMA)) * w * 0.14;
  c = clamp(c, 0.0, 1.0);
  outputColor = vec4(pow(c, vec3(2.2)), inputColor.a);               // back to linear for the rest of the chain
}`;

export class FilmGradeEffect extends Effect {
  constructor() {
    super('FilmGradeEffect', gradeFrag, {
      uniforms: new Map<string, Uniform>([
        ['contrast', new Uniform(1)], ['saturation', new Uniform(1)], ['splitBalance', new Uniform(0)],
        ['lift', new Uniform(new Vector3())], ['gammaV', new Uniform(new Vector3(1, 1, 1))], ['gain', new Uniform(new Vector3(1, 1, 1))],
        ['shadowTint', new Uniform(new Vector3())], ['highlightTint', new Uniform(new Vector3())],
      ]),
    });
  }
  set(g: { contrast: number; saturation: number; balance: number; lift: RGB; gamma: RGB; gain: RGB; shadows: RGB; highlights: RGB }) {
    const u = this.uniforms;
    u.get('contrast')!.value = g.contrast; u.get('saturation')!.value = g.saturation; u.get('splitBalance')!.value = g.balance;
    (u.get('lift')!.value as Vector3).fromArray(g.lift); (u.get('gammaV')!.value as Vector3).fromArray(g.gamma);
    (u.get('gain')!.value as Vector3).fromArray(g.gain);
    (u.get('shadowTint')!.value as Vector3).fromArray(g.shadows); (u.get('highlightTint')!.value as Vector3).fromArray(g.highlights);
  }
}

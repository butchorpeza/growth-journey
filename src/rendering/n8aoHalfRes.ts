/* Makes n8ao's half-resolution ambient occlusion work on three.js r187.
   In half-res mode n8ao downsamples depth and normals into a two-output render target. It builds that target with
   its own helper class, whose `texture` getter returns the array of both textures; three r187 expects a single
   texture there and throws ("Cannot read properties of undefined (reading 'length')" in setupRenderTarget). After
   n8ao creates the target, it is swapped for a plain three.js two-output WebGLRenderTarget with the same sizes,
   formats and filters, which n8ao uses exactly as before (`.textures[0]`, `.textures[1]`, `setSize`, `dispose`).
   Applied once, to the class itself, before any pass is created. */
import { N8AOPostPass } from 'n8ao';
import { WebGLRenderTarget, type Texture } from 'three';

interface HalfResPass { depthDownsampleTarget: (WebGLRenderTarget & { texture: Texture | Texture[] }) | null; configureHalfResTargets(): void }

let patched = false;
export function patchN8aoHalfRes() {
  if (patched) return;
  patched = true;
  const proto = N8AOPostPass.prototype as unknown as HalfResPass;
  const configure = proto.configureHalfResTargets;
  proto.configureHalfResTargets = function (this: HalfResPass) {
    configure.call(this);
    const old = this.depthDownsampleTarget;
    if (!old || !Array.isArray(old.texture)) return;       // full resolution, or already a plain target
    const target = new WebGLRenderTarget(old.width, old.height, { count: 2, depthBuffer: false });
    target.textures.forEach((t, i) => {
      const o = old.textures[i];
      t.format = o.format; t.type = o.type; t.minFilter = o.minFilter; t.magFilter = o.magFilter; t.generateMipmaps = false;
    });
    this.depthDownsampleTarget = target;                     // the old one was never bound, so nothing to free on the GPU
  };
}

/* Views of scene objects for the information panel ("render:<name>" images): a close-up of the sungka board, the
   motorcycle. Rendered the first time the panel opens (the visitor is standing by the object, so its lights are
   live), straight to the canvas with a temporary camera, read back as a JPEG and cached; the very next frame
   overwrites it, behind the panel. */
import { ACESFilmicToneMapping, PerspectiveCamera, Vector3, type Object3D, type WebGLRenderer } from 'three';

export const renders: Record<string, string> = {};
/** registered by the scene: how to render each named view */
export const snapshotters: Record<string, () => void> = {};
export function getRender(name: string) {
  if (!renders[name]) snapshotters[name]?.();
  return renders[name];
}

export function takeSnapshot(gl: WebGLRenderer, scene: Object3D, name: string, from: [number, number, number], at: [number, number, number], exposure = 1.6) {
  const canvas = gl.domElement;
  const cam = new PerspectiveCamera(42, 4 / 3, 0.05, 200);
  cam.position.set(...from); cam.lookAt(new Vector3(...at)); cam.updateMatrixWorld();
  const prev = { tm: gl.toneMapping, ex: gl.toneMappingExposure, w: canvas.width, h: canvas.height, target: gl.getRenderTarget() };
  gl.setRenderTarget(null);
  gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = exposure;
  // render at a 4:3 viewport in the corner of the canvas, then copy it out
  const w = Math.min(prev.w, 960), h = Math.round(w * 3 / 4);
  gl.setViewport(0, 0, w / gl.getPixelRatio(), h / gl.getPixelRatio());
  gl.setScissor(0, 0, w / gl.getPixelRatio(), h / gl.getPixelRatio()); gl.setScissorTest(true);
  gl.render(scene as never, cam);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  out.getContext('2d')!.drawImage(canvas, 0, prev.h - h, w, h, 0, 0, w, h);
  renders[name] = out.toDataURL('image/jpeg', 0.86);
  gl.setScissorTest(false);
  gl.setViewport(0, 0, prev.w / gl.getPixelRatio(), prev.h / gl.getPixelRatio());
  gl.toneMapping = prev.tm; gl.toneMappingExposure = prev.ex; gl.setRenderTarget(prev.target);
}

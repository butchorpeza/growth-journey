/* Shader warm-up, as console games build their shader cache while loading.
   three.js compiles a material's program (and the GPU driver builds its pipeline) the first time the material is
   drawn. In the village that happened mid-walk: approaching the sungka shelter, two frames took 610 and 655 ms as
   ten new programs compiled, and the first sungka panel took ~380 ms compiling the 40 variants its snapshot needs
   (drawn straight to the canvas with ACES, rendering/snapshots.ts). Measured after this warm-up: no new programs
   anywhere on the walk, worst frame 82 ms, first sungka panel 36 ms.
   Every visible object is drawn once, a small batch per animation frame (so the page stays responsive), in the state
   the main view renders in: into the post-processing input buffer, or straight to the canvas with ACES when
   post-processing is off. (The panels no longer show views rendered from the scene: the camera zooms in instead.) Each batch is drawn into a 4×4
   corner with frustum culling off; nothing of it is ever seen (it runs behind the opaque start screen, and the next
   frame redraws everything). Afterwards every object, count and setting is exactly as it was. */
import { ACESFilmicToneMapping, Vector2, type Camera, type InstancedMesh, type Object3D, type Scene, type WebGLRenderer, type WebGLRenderTarget } from 'three';

/** the render target the main view is drawn into (the composer's input buffer), set by PostFX; null = the canvas */
export const warmTargets: { main: WebGLRenderTarget | null } = { main: null };

const BATCH = 24;            // objects per animation frame

type Drawable = Object3D & { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean; isInstancedMesh?: boolean };

function drawOnly(gl: WebGLRenderer, scene: Scene, camera: Camera, all: Drawable[], part: Set<Drawable>) {
  const saved = all.map((o) => ({ o, visible: o.visible, culled: o.frustumCulled, count: o.isInstancedMesh ? (o as InstancedMesh).count : -1 }));
  for (const o of all) {
    if (!part.has(o)) { o.visible = false; continue; }
    o.frustumCulled = false;
    if (o.isInstancedMesh && (o as InstancedMesh).count === 0) (o as InstancedMesh).count = 1;   // one instance draws the pipeline
  }
  const beforeRender = scene.onBeforeRender, tone = gl.toneMapping, target = gl.getRenderTarget();
  const size = gl.getSize(new Vector2());
  scene.onBeforeRender = () => {};                    // no per-instance culling for this pass
  try {
    gl.setScissorTest(true);
    const draw = (t: WebGLRenderTarget | null, aces: boolean) => {
      gl.setRenderTarget(t); if (aces) gl.toneMapping = ACESFilmicToneMapping;
      gl.setViewport(0, 0, 4, 4); gl.setScissor(0, 0, 4, 4);
      gl.render(scene, camera);
      gl.toneMapping = tone;
    };
    if (warmTargets.main) draw(warmTargets.main, false);   // the main view, into the post-processing buffer
    else draw(null, true);                                  // no post-processing: straight to the canvas with ACES
  } finally {
    gl.setScissorTest(false); gl.setRenderTarget(target); gl.setViewport(0, 0, size.x, size.y); gl.toneMapping = tone;
    scene.onBeforeRender = beforeRender;
    for (const s of saved) { s.o.visible = s.visible; s.o.frustumCulled = s.culled; if (s.count >= 0) (s.o as InstancedMesh).count = s.count; }
  }
}

/** draw every visible object once, BATCH per animation frame; stops early when `cancelled()` turns true */
export async function warmUpShaders(gl: WebGLRenderer, scene: Scene, camera: Camera, cancelled: () => boolean) {
  const all: Drawable[] = [];
  scene.traverseVisible((o) => { const d = o as Drawable; if (d.isMesh || d.isPoints || d.isLine || d.isSprite) all.push(d); });
  for (let i = 0; i < all.length; i += BATCH) {
    if (cancelled()) return false;
    drawOnly(gl, scene, camera, all, new Set(all.slice(i, i + BATCH)));
    await new Promise((r) => requestAnimationFrame(r));
  }
  return true;
}

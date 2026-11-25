# Performance audit and optimisation (2026-11-25)

**Goal:** make the existing Chapter 01 run faster without changing how it looks or behaves. That means no change to the camera, controls, interactions, assets, lighting, materials or layout.

Every change below was checked for visual identity. Where pixels were compared, the before and after images were rendered in the same session with nothing animated in between.

## How it was measured

- **Machine and build:** this MacBook (integrated GPU), Chrome in the app's browser pane, the dev build.
- **Resolution:** 1920×1080 (1280×720 viewport at 1.5× pixel ratio).
- **Views:** six along the scroll path: the room, the yard, the path, the sungka shelter, the road and the portal.
- **Frame time:** CPU plus GPU. Each frame is followed by a 1-pixel `readPixels`, so the GPU work is counted too.
- **CPU time:** JavaScript plus command submission.
- **Counts:** triangles and draw calls from `renderer.info`.
- **Texture memory:** an estimate of width × height × 4 bytes × 1.33 for mip levels, since WebGL doesn't report it.
- **Reliability:** GPU timing on this laptop drifts by ±10–20% between runs (thermal state). So each change was also measured A/B on its own, switching it on and off several times at the same view in the same session. Those A/B numbers are the reliable ones.

## Baseline: what was actually slow

| View | Frame (ms) | p95 (ms) | CPU (ms) | Triangles | Draw calls |
|---|---|---|---|---|---|
| room | 60.6 | 63.4 | 11.2 | 6.55 M | 350 |
| yard | 85.8 | 89.4 | 4.3 | 6.96 M | 372 |
| path | 97.8 | 106.2 | 13.2 | 7.40 M | 361 |
| sungka | 85.0 | 96.5 | 6.2 | 7.15 M | 327 |
| road | 89.1 | 96.7 | 5.8 | 5.78 M | 243 |
| portal | 77.4 | 83.5 | 9.7 | 4.48 M | 191 |

**Scene and memory:**
- 350 meshes (99 instanced) and 17 lights: 15 point lights and one shadow-casting sun.
- 313 geometries, 163 materials and 372 textures, about **2.7 GB** uncompressed on the GPU.
- 35 MB of geometry and a 313 MB JavaScript heap.

**Loading:** ready at 20.2 s, with the asset requests spread over 11.3 s.

**Bottlenecks, from largest to smallest:**

1. **The GPU, not the CPU, is the limit.** JavaScript and submission take 4–13 ms; frames take 60–100 ms.
2. **Point lights shaded everywhere.** All 15 point lights are evaluated at every lit pixel, even far outside their range. That cost 17 ms of a 40 ms scene render.
3. **N8AO ambient occlusion.** About 15–21 ms per frame at 1080p for the whole AO stage. That was measured by switching the pass off; it includes the AO stage's two transparency re-renders of the scene and its full-resolution composite. *Correction:* an earlier per-pass measurement put the AO shader alone at ~41 ms. That figure was wrong: syncing the GPU from inside the post chain attributes queued work to whichever pass happens to wait. Whole-frame A/B measurements are the reliable ones.
4. **Off-screen vegetation.** About 85–95% of the instanced plant triangles drawn each frame were behind or beside the camera. One InstancedMesh covers a whole disc of plants around the visitor, so three.js could never cull it.
5. **Shader compile stutters.**
   - Approaching the sungka shelter, two frames took 610 and 655 ms while 10 programs compiled.
   - The first sungka panel took ~380 ms to compile 40 more.
6. **Serial asset loading.** Suspense loaded the chapter as a chain of about 11 waits: layout, then world, then ground textures, then house textures, then each Sketchfab house in turn, and so on.
7. **Interaction occlusion rays.** All of them were cast together on every 4th frame. A ray past the motorcycle cost ~4 ms, because its 36k triangles had no BVH.
8. **Smaller items:**
   - a redundant full-screen copy at the end of the post chain;
   - eight House A textures loaded twice;
   - the whole world rendering at full cost behind the opaque start screen.

## What changed

| # | Change | Where | Effect (measured) | Visual |
|---|---|---|---|---|
| 1 | **Point lights only where they reach.** The shader skips a light for a pixel beyond its cut-off distance, or when the light is off. three's attenuation is exactly 0 there. | `rendering/lightRange.ts` (installed in `GameCanvas`) | Same session, alternating at the yard and road: **≈92 → 64 ms** per frame | Identical: at most 3 of 921,600 pixels differ, by 1/255 (float rounding) |
| 2 | **Per-instance frustum culling** of instanced vegetation: grass and ground cover, plants, the near 3D trees and bananas. Only plants inside the camera's view are packed into the GPU buffer. It runs in the scene's `onBeforeRender`, so it's exact for every camera, including the panel snapshots. Shadow casters are never culled. | `rendering/instanceCulling.ts`; `Foliage.tsx`, `Bananas.tsx` | Main-pass triangles at the yard 5.70 M → 2.29 M; total per frame about −45%; **≈3 ms** per frame at 1080p (more on GPUs limited by geometry) | Identical: 0 pixels differ at 4 views, 4 sharp turns (including a steep look down) and the snapshot camera |
| 3 | **Trailing copy pass removed.** @react-three/postprocessing adds a CopyPass whenever N8AO is used. The last effect pass now draws straight to the screen. | `PostFX.tsx` | **≈1.5 ms** per frame | 1.5% of pixels differ, each by 1/255 (rounding) |
| 4 | **Ray-cast trees (BVH) for the Sketchfab houses, motorcycle and portal**, as the world model already had. | `SurvivalChapter.tsx` | Interaction checks 0.87 → **0.15 ms** per frame; a ray past the motorcycle ~4 ms → microseconds | Same hits |
| 5 | **Interaction occlusion time-sliced.** A quarter of the on-screen candidates per frame, round-robin. Each is still re-checked at least every 4 frames, as before. | `Interactable.tsx` | No more 4th-frame spike (it was several ms when 3–5 objects were on screen) | Same prompts and diamonds |
| 6 | **Parallel asset streaming.** Every file the chapter needs is requested together as soon as its code loads. The components then find their files already in the loader caches. | `chapters/survival/preload.ts` | Ready **20.2 s → 11.8–12.8 s** on localhost. All requests start within ~2 ms of each other (previously over 11 s). The gain is larger on a real network. | Same loading screen and scene |
| 7 | **Shader warm-up behind the start screen.** Every visible object is drawn once into a 4×4 corner, a batch per animation frame, in both render states: the post-processing buffer and the canvas with ACES. This is the "shader cache" pass consoles run while loading. | `rendering/warmup.ts`, `GameCanvas.tsx` | Walk stutters 610 / 655 ms → **none** (0 new programs on the whole path); first sungka panel 381 → **36 ms** | Nothing is ever visible (opaque start screen) |
| 8 | **No rendering behind the opaque start screen** once warmed up. The click that starts the game restarts it before the black fades. | `GameCanvas.tsx` | GPU idle on the start menu (it ran the full ~60–90 ms frames before) | The screen is black there |
| 9 | **Streetlights share House A's concrete and iron textures** (same URLs, same sampling settings) instead of loading their own copies. | `Streetlights.tsx` | 6 fewer 2K textures (~130 MB of GPU memory, plus decode) | Identical |
| 10 | **Half-resolution ambient occlusion** with depth-aware upsampling (on, awaiting your approval of the side-by-side comparison). n8ao's half-res mode crashed on three r187: its two-output depth target returns an array from `texture`. A one-time patch swaps in a plain three.js two-output target with the same formats. | `rendering/n8aoHalfRes.ts`, `PostFX.tsx`, `types/n8ao.d.ts` | Same session, alternating, page visible: room 47.6 → 39.8 ms, yard 56.8 → 50.5 ms, sungka within noise (an earlier run: 57.0 → 49.8 ms). Typically **≈6 ms (≈10%)**, most in close-up and interior views | Mean difference 0.3–0.4/255 per pixel. Only 1–2% of pixels differ by more than 2/255 (contact shadows very slightly softer). See `docs/visual-review/performance/ao-*.jpg` |

## After

Same machine, views and resolution:

| View | Frame (ms) | p95 (ms) | CPU (ms) | Triangles | Draw calls |
|---|---|---|---|---|---|
| room | 43.7 | 47.2 | 5.3 | 3.21 M | 344 |
| yard | 51.4 | 53.0 | 4.9 | 3.55 M | 368 |
| path | 54.9 | 57.0 | 5.6 | 3.75 M | 359 |
| sungka | 51.9 | 52.8 | 4.7 | 3.69 M | 323 |
| road | 51.8 | 52.6 | 3.6 | 2.43 M | 238 |
| portal | 41.9 | 43.2 | 2.6 | 1.66 M | 158 |

**Summary of the gains:**
- **Frame time:** about **30–45% lower** across the path. p95 is now within 1–4 ms of the median, where before it was up to 11 ms above, so frame delivery is steadier.
- **Triangles:** halved.
- **CPU per frame:** about halved.
- **Stalls:** no shader-compile stalls on the walk or the panels.
- **Loading:** ready about 8 s sooner.

**Memory leak check:** I drove the rail end to end 13 times and opened and closed the sungka and motorcycle panels 10 times. GPU geometries (276), textures (373) and shader programs stayed constant, and the JavaScript heap fell after garbage collection.

**Production build:** `npm run build` passes, including the SSR prerender.

## Not changed: these would visibly change the experience

Each of these needs your decision first.

1. **N8AO ambient occlusion.** Half resolution is now on (change 10). What's left of the AO stage is mostly the two transparency re-renders and the composite at full resolution. Further options:
   - **"Performance" sampling (8 samples) on High:** fewer samples per pixel, with slightly grainier contact shadows before denoising.
   - **Turning off `transparencyAware`:** saves the two extra scene renders, but AO would then darken behind the rain, halos and other transparent surfaces.
   - **A smaller AO radius:** cheaper, because each sample stays closer to its pixel. AO reaches less far, though, so corners darken less.
2. **KTX2 / Basis texture compression.** GPU texture memory would drop from about 2.7 GB to about 0.7 GB (UASTC) or about 0.35 GB (ETC1S). That is the largest memory saving available, and it matters on 8 GB laptops and phones.
   - UASTC is visually near-lossless, but its downloads are larger than today's WebP.
   - ETC1S downloads are smaller, but it shows mild artefacts, especially on normal maps.
   - It needs the KTX-Software encoder installed (a download that's still waiting for your approval).
3. **MSAA 4× → 2×** on High. `TECHNICAL_ARCHITECTURE.md` says High uses 2×, but the code uses 4×. 2× costs less memory bandwidth, with slightly softer anti-aliasing on thin edges such as wires and fence slats.
4. **The photo wall's timber texture** is loaded without sRGB decoding, so it renders lighter than House A's timber. Sharing House A's texture would save about 44 MB, but the board's colour would change.
5. **Banana and banana LOD** embed the same images twice, about 35 MB. Merging them needs a build-script change.

## Checked and left as is

- **Resolution policy:** the High DPR cap is your earlier choice, and `PerformanceMonitor` already steps resolution down below ~45 fps.
- **Sun shadow map:** about 1 ms per frame. Rendering it less often would make the animals' and door's shadows lag.
- **Occlusion culling:** frustum culling removed most hidden work. The village's few buildings hide little of the dense vegetation, so a GPU occlusion pass would cost about what it saves.
- **LOD:** already in place, and kept as is:
  - density thinning with grow-in for ground cover;
  - impostor cards beyond 14–30 m for trees and bananas, with a dithered crossfade.
- **Baked lighting:** the lamps flicker and swell, and the streetlight pool moves with the visitor. Baking would freeze that.
- **Mesh simplification:** it would change silhouettes up close.

## Adaptive quality for weaker devices (2026-11-25)

**The problem:** on a base Apple M2 MacBook at full screen, High rendered at the full 2× Retina density (2940×1660) and ran at about 94 ms per frame (about 10 fps).

**The fix:** `rendering/adaptive.ts` now picks a starting step from the GPU, and a governor in `GameCanvas` steps the budget down and up from real frame times. The full ladder and the per-step measurements are in `TECHNICAL_ARCHITECTURE.md` section 10.

**Results on this machine:**
- "fast" (where base M-series GPUs start): about 29 ms.
- "lite", the last step: about 16 ms (60 fps). It is AO off, half-density ground cover and a 0.75 render scale.

**Live check:** I loaded the page without pinning a step and played. The governor started at "fast", then stepped to "faster" on its own when a stretch averaged 21 ms.

**WebGPU:** not adopted. See section 10 of the architecture doc.

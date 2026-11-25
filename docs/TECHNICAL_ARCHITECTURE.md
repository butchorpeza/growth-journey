# The Growth Journey — Technical Architecture

First-person, realistic, browser-based journey for **Butch Orpeza · Digital Growth Strategist**.
Four chapters: **01 Survival → 02 The Shadows → 03 Rebirth → 04 The New Era**, plus a complete HTML website
(About, Approach, Services, Work, Contact) that works without the game.

**The visitor is the camera.** There is no player model, no hands, no character shadow and no skeletal animation.
The player is an invisible physics capsule carrying a first-person camera.

Status (2026-11-24): first-person controller prototype playable on the temporary test range. See
`DEVELOPMENT_ROADMAP.md` for the phase plan and `PROJECT_AUDIT.md` for what existed before this pass.

---

## 1. Runtime stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite 8, TypeScript, React 19 | Fast dev server. Code splitting keeps the game out of the website bundle. |
| 3D | three.js 0.187, React Three Fiber 9, Drei 10 | Declarative scene graph, GLTF/HDRI loaders, adaptive DPR, performance monitor. |
| Physics | @react-three/rapier 2.2 (Rapier, WASM) | Kinematic character controller with slopes, autostep and ground snapping. |
| Cinematics / UI motion | GSAP | Camera rails through `cameraOverride`; never fights the visitor's own controls. |
| Website | Prerendered HTML (react-dom/server at build), Lenis + ScrollTrigger | All professional content is readable without JS or WebGL; the game is an optional layer. |
| Assets | GLB (meshopt or Draco), WebP now → KTX2/Basis later, Poly Haven HDRIs | gltf-transform CLI and Blender scripts in `scripts/`. |

The website bundle is about 128 KB gzip. The game chunk (mostly the Rapier WASM) loads only when the visitor presses
**Start the Journey**.

## 2. Source structure

```
src/
  main.tsx, entry-server.tsx         website hydration / prerender
  components/                        HTML website (About, Approach, Services, Work, Contact), nav, footer
  data/                              profile, services, projects, sections (website) · chapters, narrative (game)
  game/                              GameRoot (overlay), GameCanvas (renderer + physics), GameState (store, save),
                                     launch / startJourney (lazy entry)
  player/
    Player.tsx                       invisible capsule + Rapier character controller
    PlayerCamera.tsx                 first-person eyes: look, head bob, step easing, sprint FOV
    PlayerInput.ts                   keyboard + mouse (pointer lock, or hover look with edge turning)
    movement.ts                      MOVE (body tuning) and VIEW (camera tuning)
    playerState.ts                   per-frame shared state (position, velocity, view angles)
    cameraOverride.ts                hook for GSAP cinematic camera rails
  physics/CollisionLayers.ts         collision groups
  environment/Lighting.tsx           HDRI + a shadow sun that follows the visitor
  interactions/Interactable.tsx      interaction framework (registry + centre-screen raycast)
  interface/GameHUD.tsx              chapter label, reticle, prompt, narrative panel, pause/settings, intro
  chapters/prototype/TestRange.tsx   TEMPORARY grey blockout for controller tests (open with ?range)
  chapters/survival/                 Chapter 01: SurvivalChapter (world, collision, door, interactions, exit),
                                     Foliage (instanced, distance-culled), fineGrass (procedural carabao grass),
                                     Bananas (instanced groves), scatter (terrain-aware placement),
                                     terrainMaterial (4-layer splat), layout
```

The brief's suggested layout (`components/Experience`, `components/Chapters/*`, `systems/*`) maps onto this one:
`game/` is the experience shell, `player/` is the camera + movement system, `interactions/` is the interaction system and
`interface/` is the UI. New chapters go in `chapters/<survival|shadows|rebirth|new-era>/`. The layout is kept rather
than reshuffled, so working code isn't churned for naming alone.

## 3. First-person controller

**Body** (`Player.tsx`). An invisible kinematic capsule, 1.75 m tall with a 0.32 m radius, moved by Rapier's
character controller. Nothing is rendered for it.
- Movement is relative to the view's yaw only, so looking up or down never slows walking.
- Walk 1.6 m/s, sprint 4.4 m/s. Exponential acceleration (10/s) and deceleration (12/s), 35% air control.
- Gravity 22 m/s². Jumps use 6.2 m/s with 0.12 s coyote time and a 0.12 s jump buffer.
- Slopes climbable up to 46°. Autostep handles 0.38 m (stairs). Ground snapping 0.35 m. Dynamic props get pushed.
- Rapier slides the capsule along walls. Its velocity is deliberately not cut on a blocked move, because cutting it breaks autostep.

**Eyes** (`PlayerCamera.tsx`), tuned in `VIEW` in `movement.ts`:
- Eye height is 1.62 m. FOV is 55° (a cinematic lens), plus up to 3° at full sprint.
- Mouse look needs no button. Where the browser allows it, "Start exploring" takes pointer lock (cursor hidden, unlimited turning; Esc pauses). Otherwise **hover look** applies: the view follows the mouse while it's over the game, and holding the cursor in the outer 15% of the screen keeps turning (up to 1.9 rad/s sideways, 0.8 rad/s up and down, eased in across the edge band). The cursor is hidden over the game while playing (the centre reticle replaces it) and comes back for the intro, pause menu and reading panels. Sensitivity and vertical look are fixed (no settings). Pitch is limited to ±85°.
- Head bob makes one cycle per stride, driven by the distance actually travelled, so walking into a wall doesn't bob. Peak-to-peak it measures about 4.8 cm walking and 6.8 cm sprinting. It fades in and out with speed.
- Hard landings give a small view dip, scaled by fall speed.
- The eye eases up and down stairs instead of snapping with each autostep. It never lags more than 0.3 m behind the body.
- **Reduce motion** follows the OS `prefers-reduced-motion` setting (there is no toggle) and turns off bob, landing dip and sprint FOV.
- Camera collision: the camera sits inside the capsule, whose radius (0.32 m) is far larger than the near plane (0.05 m), so the view can't pass through walls.

**Cinematics.** While `cameraOverride.active` is set (by a GSAP timeline), the camera follows the override's
position, target and FOV. Movement input is ignored outside `mode === 'playing'`, so a sequence can pause the game,
animate the camera, then hand control back. The smooth hand-back blend is part of Phase 4.

## 4. Interaction system

`<Interactable id label verb narrativeId|onInteract reach>` wraps any object. The `InteractionManager` casts one ray
from the centre of the view each frame. If the first visible mesh it hits within reach (default 2.6 m from the eye)
belongs to an interactable:
- the reticle opens into a ring,
- the HUD shows "E · Inspect old photograph",
- E runs the action. By default that opens the narrative panel, pauses movement and releases the pointer.

Because the ray stops at the first surface, objects behind walls or other props can't be used, and you have to look at
an object to use it. Discovered ids are saved. The raycast costs about 0.01 ms on the test range. Large chapters
should add `three-mesh-bvh` or raycast only against interactable meshes plus simplified occluders.

## 5. Physics layers

player / environment / interactive / trigger / dynamic (`physics/CollisionLayers.ts`). Render meshes are never used
as colliders in production chapters. Each asset gets simplified `COL_*` collision geometry (see `ASSET_PIPELINE.md`).

## 6. State and save

`GameState.ts` holds the mode (`loading → intro → playing ⇄ paused / reading`), chapter, prompt, settings and save data.
Frame-rate values (position, velocity, view angles) live in `playerState.ts`. They are mutable and never re-render React.

Saved in localStorage, with no personal data:
- **Progress:** chapter, checkpoint, completed chapters, discovered objects, restored structures.
- **Settings:** the pause menu (a black-and-white panel on the left over the blurred game, in the handwritten Caveat face) offers only resume, back to the home page, volume, movement (Scroll / WASD), the saved-progress note and reset. Graphics are always High (only the render resolution adapts), sound is always on (volume 0 mutes it), no letterbox bars; these are reapplied on every load, so settings from older builds can't override them.

## 7. Chapter 01 pipeline

`scripts/blender/build_survival.py` (Blender, headless) → `assets-src/survival/out/` → `scripts/optimize-survival.mjs`
→ `public/models/survival/{world.glb, foliage.glb, layout.json, ground/*.webp}`.

- **world.glb:** scanned props simplified, meshes merged per material within 24 m cells (so view and shadow culling still work). The door, photograph and terrain are kept as named nodes.
- **layout.json:** collision boxes, interactables, the door hinge, spawn, exit, lights and foliage instances, all in three.js coordinates.
- **Terrain:** splat weights in vertex colours (R mud, G laterite, B forest floor, rest grass), shaded by `terrainMaterial.ts`. It's a MeshStandardMaterial patched in `onBeforeCompile`, so PBR, shadows and fog still apply. UVs are rebuilt at load, because the optimiser drops them from an untextured material.
- **Interactions inside merged meshes** use invisible hit volumes (`colorWrite: false`), so the centre-screen raycast can find them.

## 8. Rendering: cinematic look (`src/rendering/`)

Each chapter has a **Look** (`looks.ts`), similar to an ENB preset. It bundles sky (HDRI, environment and background intensity), sun, height fog and the post-processing grade. Chapters 02–04 have presets prepared from the brief's lighting direction.

| Layer | What it does |
|---|---|
| `PostFX.tsx` | N8AO ambient occlusion → depth of field with autofocus (High) → bloom → exposure + white balance → AgX/ACES tone mapping → film grade → chromatic fringe → vignette → grain |
| `grading.ts` | Custom shaders. **ExposureBalance** (before tone mapping): exposure in stops plus temperature/tint. **FilmGrade** (after): lift/gamma/gain, contrast, saturation, hue-only split toning. |
| `focus.ts` | A focus puller. A BVH raycast at the centre of frame racks focus smoothly, faster in than out. |
| `heightFog.ts` | Replaces three.js's exponential fog for all materials with analytically integrated height fog: haze in the valleys that thins with altitude. |
| `wind.ts` | Vertex sway for every instanced plant, with a per-instance phase and travelling gusts. |
| `clouds.ts` | Weather: cloud shadows. Patched into each material's sunlight term (sky light untouched). Drifting noise cells dim direct sun by up to 75%. |
| Sun FX (`PostFX.tsx`) | A lens flare that fades when the sun is blocked or off-frame (a BVH ray toward the sun), plus god rays from an HDR sun disc aligned with the sky's sun. |
| Bananas (`chapters/survival/Bananas.tsx`) | Village clumps use the full model with shadows. The hills (about 2,400+ plants) are 3D within 40 m and **impostors** beyond: two crossed cards with a picture of the real model, rendered from it at load. That's 4 triangles instead of about 2,500. |
| `src/audio/` | Web Audio. Footsteps are Kenney recordings chosen by surface (a raycast underfoot: concrete, wood, earth) and triggered by stride distance, with a landing thump. Ambience is generated live: breeze, cicadas, birdsong. Muted until the visitor turns it on. |
| `bvh.ts` | three-mesh-bvh accelerated raycasts. In the village the look-at ray went from 15–52 ms to 0.2–0.5 ms per frame. |
| Lighting | Texel-snapped sun shadows (no shimmer), PCF radius for soft overcast penumbrae, 4096² map on High. |
| Camera | 55° cinematic lens, faint handheld drift, optional 2.39:1 letterbox (off by default: full screen; bars capped at 12% of the height each). |

**Quality tiers** (tuned 2026-11-24 for integrated GPUs. Since 2026-11-25, the adaptive budget in section 10 sets resolution, MSAA, depth of field, AO sampling and shadow size within High):
- **High:** everything above, 2× MSAA, 2048² shadows, DPR ≤ 1.5.
- **Medium:** AO at "performance" sampling, no depth of field / light rays / flare, SMAA, 1024² shadows, DPR ≤ 1.2.
- **Low:** no post-processing or shadows; the renderer tone-maps with ACES at the Look's exposure.

The post chain is rebuilt when quality changes. AO runs at half resolution with depth-aware upsampling. n8ao's half-res render target breaks on three r187, so `rendering/n8aoHalfRes.ts` replaces it with a plain two-output target.

**Performance engineering** (2026-11-25, details and measurements in `docs/PERFORMANCE_AUDIT.md`):
- `lightRange.ts`: point lights skip the pixels they can't reach.
- `instanceCulling.ts`: per-instance frustum culling of instanced vegetation.
- `warmup.ts`: every shader is compiled behind the start screen, and rendering pauses there afterwards.
- `chapters/survival/preload.ts`: all chapter assets are requested in parallel.
- BVH ray-cast trees for the Sketchfab models, and time-sliced interaction occlusion rays.

None of these changes the image.

**Known limits.** The remaining "CG" look comes mostly from the assets: box-modelled walls with perfectly straight edges, and uniform tiling textures. Closing that gap needs photoscanned or hand-modelled hero buildings (see the roadmap), not more post-processing. Screen-space GI and motion blur are not included. **Ray tracing / DLSS:** browsers expose neither hardware ray tracing nor NVIDIA DLSS (DLSS is a native DirectX/Vulkan SDK for RTX GPUs), so the realistic browser equivalents are screen-space effects (AO, reflections, GI) and, for still images, a progressive path tracer (e.g. three-gpu-pathtracer) as a "photo mode".

## 9. Chapter loading (planned, Phase 4)

One chapter is mounted at a time. A `ChapterManager` will:
1. Preload selected GLBs of the next chapter during the exit sequence.
2. Swap scenes under a cinematic transition (fade + camera rail + fog blend).
3. Dispose the previous chapter's geometries, materials and textures, and clear its GLTF cache entries.

## 10. Device tiers and adaptive quality

`utils/webgl.ts` decides whether the 3D journey is offered at all ("off" means the HTML website only).

Inside the game, `rendering/adaptive.ts` runs a dynamic-quality ladder, like a console game's dynamic resolution. Each step trades the least visible thing for the most time.

| Step | Render scale | MSAA | Depth of field | AO | Shadows | Ground cover |
|---|---|---|---|---|---|---|
| ultra | 2× | 4× | on | 16 samples | 2048² | full |
| high | 1.5× | 4× | on | 16 samples | 2048² | full |
| balanced | 1.25× | 2× | on | 16 samples | 2048² | full |
| smooth | 1× | 2× | off | 16 samples | 2048² | full |
| fast | 1× | none | off | 8 samples | 1024² | full |
| faster | 0.8× | none | off | 8 samples | 1024² | full |
| lite | 0.75× | none | off | off | 1024² | half |

**How the step is chosen:**
- **First guess:** from the GPU (`WEBGL_debug_renderer_info`) and whether the device is a phone or tablet. Base Apple M-series and integrated GPUs start at "fast"; phones and tablets at "faster"; Pro/Max/discrete GPUs at "high".
- **Governor:** it times real frames while the visitor plays. It steps down after about 1.5 s averaging slower than about 45 fps, and back up after about 8 s at a steady 60 fps. A step that proved too slow twice is not retried.
- **Pinning:** `?quality=N` pins a step for testing.

**Measured on a base Apple M2 at a full-screen 1470×830 window:**

| Step | Frame time |
|---|---|
| ultra | ~94 ms |
| balanced | ~45 ms |
| smooth | ~33 ms |
| fast | ~29 ms |
| faster | ~23.5 ms |
| lite | ~16 ms (60 fps) |

**What doesn't change:** lighting, materials, colour grade, fog and rain are the same on every step. The pause menu's Graphics choice is gone; quality is always High, and the budget adapts within it.

**WebGPU was assessed and not adopted.** three.js's WebGPURenderer can't run:
- the scene's GLSL shader patches (height fog, weather, wind, terrain blend, LOD dissolve, light range);
- the `postprocessing` and n8ao passes.

Moving would mean rewriting all of them in TSL. On Macs, WebGL and WebGPU both run on Metal, so a scene limited by per-pixel work gains little.

Touch-only devices currently get the website plus a note. Touch move and look controls are planned for Phase 6.

## 11. Verified controller behaviour (2026-11-24)

Measured in the in-app browser with the game loop driven at a fixed 60 fps and real keyboard events:

| Check | Result |
|---|---|
| Walk / sprint speed | 1.60 m/s / 4.39 m/s ✅ |
| Head bob (peak-to-peak) | walk 4.8 cm, sprint 6.8 cm ✅ (restrained) |
| Sprint FOV | 70° → 74° while sprinting, back to 70° on stopping ✅ |
| Jump | peak 0.83 m, lands and re-grounds ✅ |
| Wall | stops 0.32 m (capsule radius) from the wall face ✅ |
| 44° slope / 58° slope | climbs / blocked ✅ |
| Stairs (17 cm rise) | reaches the 1.7 m landing ✅ |
| Look at photograph within reach | prompt "old photograph" ✅ |
| Same spot facing away, or 2.1 m back | no prompt ✅ |
| Player model / shadow | none in the scene ✅ |

`node scripts/dev/play-test.mjs` (with `npm run preview` running) repeats these checks in headless Chrome.

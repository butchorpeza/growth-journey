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
    PlayerInput.ts                   keyboard + mouse (pointer lock, drag fallback)
    movement.ts                      MOVE (body tuning) and VIEW (camera tuning)
    playerState.ts                   per-frame shared state (position, velocity, view angles)
    cameraOverride.ts                hook for GSAP cinematic camera rails
  physics/CollisionLayers.ts         collision groups
  environment/Lighting.tsx           HDRI + a shadow sun that follows the visitor
  interactions/Interactable.tsx      interaction framework (registry + centre-screen raycast)
  interface/GameHUD.tsx              chapter label, reticle, prompt, narrative panel, pause/settings, intro
  chapters/prototype/TestRange.tsx   TEMPORARY grey blockout for controller tests (open with ?range)
  chapters/survival/                 Chapter 01: SurvivalChapter (world, collision, door, interactions, fog, exit),
                                     Foliage (instanced, distance-culled), terrainMaterial (4-layer splat), layout
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
- Eye height is 1.62 m. FOV is 70°, plus up to 4° at full sprint.
- Mouse look uses pointer lock, with drag-to-look as the fallback. Sensitivity and inverted Y are in the pause menu. Pitch is limited to ±85°.
- Head bob makes one cycle per stride, driven by the distance actually travelled, so walking into a wall doesn't bob. Peak-to-peak it measures about 4.8 cm walking and 6.8 cm sprinting. It fades in and out with speed.
- Hard landings give a small view dip, scaled by fall speed.
- The eye eases up and down stairs instead of snapping with each autostep. It never lags more than 0.3 m behind the body.
- **Reduce motion** (pause menu; it defaults to the OS `prefers-reduced-motion` setting) turns off bob, landing dip and sprint FOV.
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
- **Settings:** sensitivity, invert Y, reduce motion, graphics quality, audio (off by default).

## 7. Chapter 01 pipeline

`scripts/blender/build_survival.py` (Blender, headless) → `assets-src/survival/out/` → `scripts/optimize-survival.mjs`
→ `public/models/survival/{world.glb, foliage.glb, layout.json, ground/*.webp}`.

- **world.glb:** scanned props simplified, meshes merged per material within 24 m cells (so view and shadow culling still work). The door, photograph and terrain are kept as named nodes.
- **layout.json:** collision boxes, interactables, the door hinge, spawn, exit, lights and foliage instances, all in three.js coordinates.
- **Terrain:** splat weights in vertex colours (R mud, G laterite, B forest floor, rest grass), shaded by `terrainMaterial.ts`. It's a MeshStandardMaterial patched in `onBeforeCompile`, so PBR, shadows and fog still apply. UVs are rebuilt at load, because the optimiser drops them from an untextured material.
- **Interactions inside merged meshes** use invisible hit volumes (`colorWrite: false`), so the centre-screen raycast can find them.

## 8. Chapter loading (planned, Phase 4)

One chapter is mounted at a time. A `ChapterManager` will:
1. Preload selected GLBs of the next chapter during the exit sequence.
2. Swap scenes under a cinematic transition (fade + camera rail + fog blend).
3. Dispose the previous chapter's geometries, materials and textures, and clear its GLTF cache entries.

## 9. Device tiers

`utils/webgl.ts`, `PerformanceMonitor` and the graphics setting decide the tier:
- **High:** shadows, DPR ≤ 1.75, full foliage.
- **Low:** no shadows, DPR ≤ 1.15, reduced foliage and particles.
- **Off:** HTML website only.

The brief asks for Low / Medium / High. A Medium tier (shadows at 1024, DPR ≤ 1.4) is planned with the first real
chapter, when there is something heavy enough to tune it against. Touch-only devices currently get the website plus a
note. Touch move and look controls are planned for Phase 6.

## 10. Verified controller behaviour (2026-11-24)

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

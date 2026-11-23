# The Growth Journey — Technical Architecture & Plan

Third-person, realistic, browser-based journey for **Butch Orpeza · Digital Growth Strategist**.
Four chapters: **01 Survival → 02 The Shadows → 03 Rebirth → 04 The New Era**, plus a complete HTML website
(About, Approach, Services, Work, Contact) that works without the game.

Status (2026-11-23): Phase 01 audit done · Phase 02 research done (see `ASSET_MANIFEST.md`) · Phase 03 controller
prototype playable on a temporary test range with a temporary character.

---

## 1. Phase 01 audit (what existed)

| Item | Finding | Decision |
|---|---|---|
| `~/Desktop/3d Portfolio/3d-webgl-portfolio` | Next.js 16 template for another person ("kalashree-portfolio"); R3F, Drei, GSAP, Lenis, Tailwind; own git repo | Left untouched. Not Butch's content; Vite was requested. |
| `growth-journey/` (this repo) | Built earlier the same day for the previous scroll-driven brief: Vite 8 + React 19 + TS + R3F 9 + Drei 10 + GSAP + Lenis, prerendered HTML (SEO), verified content data | Kept as the foundation. Scroll-camera worlds removed (tag `scroll-journey-v1` keeps them). |
| `~/Downloads/island.glb` (75 MB) | Stylised low-poly island + cartoon "Kid" character, Mixamo rig, 1 clip, 8K PNG cloth textures | **Not usable as final art** (low-poly and cartoon are prohibited). The optimisation script (75 → 3 MB, `npm run assets:island`) stays as a pipeline example. |
| `~/Downloads/Elias_III_0041.blend`, `Kaspar_II_0001.blend` | Inspected with Blender 5.1 CLI: clothing-store scenes (rails, shoes, coats), 4.0 M / 0.6 M polys, no armature, BlenderKit + Poliigon materials | Not a character. Possibly reusable *clothing references* for the New Era outfit. |
| `~/Downloads/assets_3d_portfolio.zip` | Assets of a public low-poly portfolio tutorial (fox, bird, plane, island, sky) | Not used (low-poly, someone else's project). |
| Tools on this Mac | Node 24, npm 11, Blender 5.1.2 (`/Applications/Blender.app`), Chrome | Blender CLI is scriptable for inspection, decimation, GLB export. `toktx` (KTX2) not installed yet. |

## 2. Runtime stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite 8, TypeScript, React 19 | Fast dev server; code splitting keeps the game out of the website bundle |
| 3D | three.js 0.187 + React Three Fiber 9 + Drei 10 | Declarative scene graph, GLTF/HDRI loaders, adaptive DPR, performance monitor |
| Physics | **@react-three/rapier 2.2** (Rapier 0.12, WASM) | Kinematic character controller with slopes, autostep, ground snapping; ray casts for the camera |
| Animation | three.js AnimationMixer (character), GSAP (cinematics, UI) | GSAP never drives the character — only camera rails and interface |
| Website | Prerendered HTML (react-dom/server at build), Lenis + ScrollTrigger | All professional content readable without JS/WebGL; the game is an optional layer |
| Assets | GLB (meshopt or Draco), WebP now → KTX2/Basis later, HDR from Poly Haven | gltf-transform CLI in `scripts/` |

The website bundle is ~128 KB gzip. The game (`GameCanvas` chunk, ~1.1 MB gzip, mostly the Rapier WASM) loads only when
the visitor presses **Start the Journey**. Switching to `@dimforge/rapier3d` (non-compat, streamed `.wasm`) is a later
optimisation.

## 3. Source structure (current)

```
src/
  main.tsx, entry-server.tsx         website hydration / prerender
  components/                        HTML website (About, Approach, Services, Work, Contact), nav, footer
  data/                              profile, services, projects, sections (website) · chapters, narrative (game)
  game/                              GameRoot (overlay), GameCanvas (renderer + physics), GameState (store, save),
                                     launch/startJourney (lazy entry)
  player/                            Player (controller), PlayerCamera, PlayerInput, PlayerAnimations,
                                     characterConfig (model + clips + movement tuning), playerState
  physics/CollisionLayers.ts         collision groups
  environment/Lighting.tsx           HDRI + following shadow sun
  interactions/Interactable.tsx      interaction framework (registry + proximity manager)
  interface/GameHUD.tsx              chapter indicator, prompt, narrative panel, pause/settings, intro
  chapters/prototype/TestRange.tsx   TEMPORARY blockout for controller tests
  chapters/<survival|shadows|rebirth|new-era>/   (Phase 04–07)
  audio/                             (Phase 05: AudioManager, ambience, footsteps)
scripts/
  optimize-island.mjs                example GLB pipeline (resize, WebP, meshopt)
  prerender.mjs                      HTML prerender
  dev/play-test.mjs, dev/kcc-test.mjs   automated controller tests (headless Chrome / Rapier in Node)
```

Planned additions as chapters arrive: `game/ChapterManager.ts` (load current chapter, preload next, dispose previous),
`chapters/*/{Scene,Environment,Interactions,config}`, `environment/{Terrain,Foliage,Weather,Atmosphere}`,
`interactions/{Portal,Collectible}`, `audio/*`, `utils/{assetLoader,disposal,performance}.ts`.

## 4. Game systems

**State.** `GameState.ts`: mode (`loading → intro → playing ⇄ paused/reading`), chapter, prompt, settings, save data.
Frame-rate values (position, velocity, camera angles) live in `playerState.ts` (mutable, never re-render React).

**Character controller** (`Player.tsx`). Kinematic capsule (1.8 m, r 0.32) moved by Rapier's KCC:
- Movement is camera-relative, with exponential acceleration (10/s), deceleration (12/s) and 35% air control.
- Gravity is 22 m/s². Jumps use a 6.2 m/s impulse, 0.12 s coyote time and a 0.12 s jump buffer.
- Max climbable slope is 46°. Autostep handles 0.38 m. Ground snapping is 0.35 m. Dynamic props are pushed.
- Facing is smoothed. Animation states follow the *actual* motion, with cross-fades and walk/run playback scaled to the ground speed.

**Camera** (`PlayerCamera.tsx`). Over-the-shoulder orbit at a 1.55 m pivot with a 0.42 m shoulder offset:
- Yaw and pitch come from pointer-locked mouse (drag fallback); the wheel sets distance (1.6–6.5 m).
- Collision is a ray cast from the shoulder to the camera; the camera pulls in at 30/s and eases out at 3/s.
- Pivot and position are damped. The FOV widens slightly while running.
- `cameraOverride` is the hook for GSAP cinematic rails.

**Physics layers.** player / environment / interactive / trigger / dynamic. The camera ray only sees environment and
interactive, so crates and triggers never yank the camera.

**Interactions.** `<Interactable id label verb narrativeId|onInteract radius>` registers a point of interest. One
`InteractionManager` picks the nearest one in reach and shows "E Inspect …". Pressing E runs it: by default it opens a
narrative panel, pauses movement and releases the pointer. Discovered ids are saved.

**Save.** localStorage stores the chapter, checkpoint, completed chapters, discovered objects and restored structures, and the pause
menu offers Reset progress. Settings are also stored: sensitivity, invert Y, graphics quality and audio (off by default). No personal data.

**Chapter loading (Phase 08).** One chapter is mounted at a time. A `ChapterManager` preloads selected GLBs of the next
chapter during the exit sequence, swaps scenes under a cinematic transition (fade + camera rail + fog blend), then
disposes the previous chapter's geometries, materials and textures (`utils/disposal.ts`) and clears the GLTF cache entries.

**Device tiers.** `utils/webgl.ts` + `PerformanceMonitor` + settings:
- **high:** shadows, DPR ≤ 1.75, full foliage.
- **low:** no shadows, DPR ≤ 1.15, reduced foliage and particles.
- **off:** HTML website only.

Touch-only devices get the website with a note for now. A simplified touch controller is planned for Phase 10.

## 5. Verified prototype behaviour (headless Chrome, real key events)

`node scripts/dev/play-test.mjs` (with `npm run preview` running). Results on 2026-11-23:

| Test | Result |
|---|---|
| Walk / run speed | 1.7 m/s / 4.6 m/s ✅ |
| Jump | peak 0.82 m, lands and re-grounds ✅ |
| Wall collision (run into wall at x = −10.2) | stops at x = −10.53 (capsule radius) ✅ |
| 44° slope | climbable ✅ · 58° slope blocked ✅ |
| Stairs (17 cm rise) | climbs (1.03 m after 2.5 s) ✅ |
| Interaction | prompt "old photograph" in reach, E opens the narrative panel ✅ |
| Camera in a 4 m corridor | stays inside (x = −10.58, wall at −10.2) ✅ |

Found and fixed during testing: cutting the velocity on a blocked move stopped Rapier's autostep (character stuck at
the first stair); kinematic-vs-fixed sensors don't fire in Rapier by default (switched to proximity).

## 6. Milestones

| Phase | Deliverable | Exit criterion |
|---|---|---|
| 01 Audit | this document | ✅ |
| 02 Assets | `ASSET_MANIFEST.md`, `ASSET_PIPELINE.md` | ✅ research · ⏳ purchases/downloads need Butch's accounts |
| 03 Character & camera | playable controller (✅), realistic MPFB character (✅), full Mixamo clip set (✅), close-camera fade, touch prototype | walk/run/jump/interact with the final character, no foot sliding, no camera clipping |
| 04 Survival | rural village from real assets, overcast HDRI, first objective, exit road | visual sign-off by Butch before Phase 05 |
| 05 Shadows | forest road + abandoned settlement, moonlight, fog, audio layer | sign-off |
| 06 Rebirth | castle + village, two-state restoration (gate, bridge, light) | sign-off |
| 07 New Era | city, five service destinations + project gallery (HTML panels), final platform cinematic | sign-off |
| 08 Progression | ChapterManager, transitions, checkpoints, save, skippable cinematics | full playthrough |
| 09 Website | About/Services/Projects/Contact panels in-game, SEO, accessible nav, fallback | Lighthouse a11y/SEO 100 |
| 10 Optimisation | KTX2, LODs, instancing, memory checks, mobile tier | stable 60 fps on a mid laptop, no leaks across chapters |

Deployment target: `https://butchorpeza.com/about/` (static build; `base: './'`). The WordPress side needs a page
or rewrite that serves `dist/` at `/about/` — to be set up when the first chapter is signed off.

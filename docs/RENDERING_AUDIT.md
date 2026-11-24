# Rendering & Performance Audit — 2026-11-24

Phase 1 (audit) and Phase 2 (plan) of the "AAA realism & performance" brief. **No code was changed for this
document.** All numbers were measured in the in-app browser (Chromium) at DPR 1.5, canvas 862×1155, quality High,
on the uncommitted working tree that has the sunny weather, carabao grass and banana plants. That browser pane
throttles itself and its timings swing 2–4× with focus, so **draw calls, triangles and memory are reliable; frame
times are indicative only.** A real benchmark needs a focused Chrome window on the target Mac (see P7 below).

## 1. Current architecture

| Layer | Implementation |
|---|---|
| Stack | three 0.187 · @react-three/fiber 9.8.2 · drei 10.7.9 · @react-three/rapier 2.2 · postprocessing 6.39.6 + @react-three/postprocessing 3.2.2 · n8ao 2.0.1 · three-mesh-bvh 0.8.3 · GSAP 3.15 · React 19.3 · Vite 8.3 |
| Website | Prerendered HTML (SEO, works without WebGL). The game is a lazy-loaded overlay. |
| Game shell | `game/` (GameRoot, GameCanvas, GameState with save/settings), one chapter mounted at a time |
| Player | Invisible Rapier kinematic capsule + first-person camera (55° lens, head bob, handheld drift), pointer lock or hover look |
| Interaction | Centre-screen BVH raycast, invisible hit volumes, E prompt, narrative panels |
| Chapter 01 | `chapters/survival/`: village GLB, terrain splat shader, 161 box colliders + terrain trimesh, hinged door, foliage instancing, procedural carabao grass, banana groves (3D + impostor cards), terrain-aware scatter |
| Lighting | Poly Haven HDRI (IBL + background), one directional sun with PCF shadows (texel-snapped, 48 m frustum), oil-lamp point light, analytic height fog, cloud shadows patched into every material's sun term |
| Post | N8AO → DOF (autofocus) → god rays → bloom → lens flare → exposure/white balance → AgX/ACES → film grade → chromatic fringe → vignette → grain; SMAA on Medium |
| Quality | High / Medium / Low plus automatic step-down below ~45 fps (focused window only) |
| Audio | Web Audio: surface-aware recorded footsteps, generated ambience |
| Asset pipeline | Blender build script → `scripts/optimize-survival.mjs` (gltf-transform: simplify, cell merge, WebP, meshopt) |

## 2. Measurements

**Payload** (`public/`, 60 MB; first 3D load ≈ 53 MB):

| File | Size | Note |
|---|---|---|
| `models/survival/world.glb` | **40.0 MB** | 38 textures at 2K + 153 at 512, WebP; geometry meshopt-compressed |
| `hdri/kloofendal…_2k.hdr` | 5.5 MB | Chapter 01 sky |
| `hdri/farmland_overcast_2k.hdr` | **6.5 MB** | **unused**: dead weight in the build |
| `hdri/overcast_soil_puresky_1k.hdr` | 1.2 MB | test range + placeholder for chapters 02–04 |
| `models/survival/foliage.glb` | 2.9 MB | |
| `models/survival/ground/*.webp` | 3.0 MB | 4 layers × colour + normal, 1K |
| `banana.glb` + `banana_lod.glb` | 1.0 MB | |
| `layout.json` | 0.6 MB | |

Load time (Start the Journey → intro card): **5.6 s from the local dev server with a warm cache**. Over a real
connection, 53 MB is several times longer. The brief's target is 5–10 MB.

**GPU memory:** **≈ 1.2 GB of textures** (311 textures; world.glb alone is ≈ 1.15 GB once decoded to RGBA with mipmaps).
This is the single biggest risk on laptops with integrated graphics, where GPU memory is shared with the system.

**Per frame, quality High** (all render passes counted):

| View | Draw calls | Triangles | Frame time (indicative) |
|---|---|---|---|
| Interior, house A | 296 | 4.25 M | 22.8 ms |
| Yard | 309 | 4.51 M | 19.1 ms |
| Village toward the hills | 332 | 4.92 M | 23.3 ms |
| Road | 283 | 3.51 M | 24.5 ms |

Triangle breakdown, village → hills view:

| Source | Triangles |
|---|---|
| Ground cover (carabao grass) | **2.19 M** |
| Shadow pass (139 draw calls) | **1.34 M** |
| Other plants (shrubs, weeds, nettles, calathea) | 0.75 M |
| Village buildings + props | 0.66 M |
| Bananas (3D near + impostor cards) | 0.37 M |
| Terrain | 0.07 M |

A note on an earlier claim: last turn I reported 6.6 ms for the yard view. That figure did not reproduce here (19.1 ms
for the same view). This pane's timing is not trustworthy enough to quote, which is why P7 adds an in-game benchmark.

## 3. Findings

### Critical
1. **Texture memory ≈ 1.2 GB, uncompressed.** WebP shrinks downloads but decodes to full RGBA on the GPU. No KTX2/Basis.
2. **Payload ≈ 53 MB, one blocking 40 MB file.** Nothing is shown until everything has arrived. There's no progressive or low-res-first loading, and an unused 6.5 MB HDRI ships with the build.
3. **Ground cover is 2.2 M triangles.** Every carabao clump has 18–26 blades at full detail regardless of distance; only the instance count thins with distance, not the blade count.

### High
4. **No baked lighting.** Interiors and contact areas get only screen-space AO and sky IBL. The IBL is not occluded by walls, so rooms read too evenly lit (a key "CG" tell). The village is static, which makes it ideal for baked lightmaps.
5. **The shadow pass is 1.34 M triangles / 139 draw calls.** Every village mesh and the near bananas cast shadows. The merged 24 m cells are too coarse for shadow culling.
6. **Coarse culling.** Only 11 merged cells, so most of the village draws even when behind you, and there is no LOD on scanned props.
7. **No in-game performance monitor.** FPS, frame time, calls, triangles and memory are only reachable through `?debug` scripting. Real benchmarks on the target device aren't possible yet.

### Medium
8. **Materials.** The Poly Haven PBR scans (wood, plaster, block, corrugated iron) are good, but they're applied to box-modelled walls with perfectly straight edges and uniform tiling: no macro variation, grime or edge wear, and no decals (stains, cracks, water marks). Glass is a flat transparent material.
9. **Atmosphere.** Fog, wind, cloud shadows, god rays and the flare exist. There are no dust motes in sunlight and no rain or puddles, and water isn't used anywhere.
10. **Scene management.** One chapter is mounted at a time and R3F disposes on unmount, but there's no ChapterManager (preload next, cross-fade, explicit cache eviction). That only matters once Chapter 02 exists.
11. **Per-frame cost.** No allocations inside `useFrame` hot paths. Cloud shadows and height fog add a few ALU ops per fragment on every material (acceptable). The lens-flare shader runs full-screen even when its strength is 0.

### Asset replacement needed (not silently substituted)

| Asset | Why | Spec | Source / licence |
|---|---|---|---|
| Hero house(s) | Box-modelled walls are the main CG tell up close | Photoscan or hand-modelled, 20–60k tris, 2K PBR (KTX2), separate `COL_*` collision | Sketchfab "Old House Wooden Enterable Rusty" (CC-BY 4.0), or a Fab Southeast Asian village kit (paid; check that the licence allows web delivery) |
| Coconut / tropical palms | Skyline variety beside the bananas | 3–8k tris + impostor, 1K alpha leaves | Sketchfab CC-BY packs (e.g. Tropical Plants Pack M02P) |
| Clutter decals | Grime, stains, cracks | 1K RGBA decal atlas | Poly Haven / ambientCG (CC0) |

## 4. Prioritised plan

| # | Priority | Work | Expected effect | Needs |
|---|---|---|---|---|
| P1 | Critical | **KTX2 / Basis textures** (UASTC for normals, ETC1S for colour) in the optimiser, KTX2Loader in the game | GPU texture memory ≈ 1.2 GB → ≈ 0.25–0.3 GB; download also shrinks | KTX-Software 4.4.2 (`toktx`, 6.8 MB pkg from KhronosGroup on GitHub). It can be unpacked into `~/.local` without an admin install. **Needs your OK to download.** |
| P2 | Critical | **Progressive loading:** low-res village first (playable in ~8–12 MB), 2K textures streamed in behind; drop the unused HDRI; sky as 1K HDR for lighting + compressed LDR backdrop | First playable in a fraction of the time | — |
| P3 | Critical | **Grass LOD:** 3 clump detail levels by distance (26 → 10 → 4 blades), fade-out instead of pop | Ground cover 2.2 M → ≈ 0.5 M triangles | — |
| P4 | High | **Baked lighting in Blender** (Cycles): lightmap + AO atlas for the static village, applied as `lightMap`/`aoMap`; sky IBL reduced indoors | The biggest realism step for interiors and contact; cheap at runtime | Blender (installed); bake time ≈ minutes to an hour |
| P5 | High | **Shadow budget:** casters limited to within ~25 m of the visitor, plants never cast beyond 15 m, finer 12 m village cells | Shadow pass 1.34 M → ≈ 0.3–0.4 M triangles, fewer calls | — |
| P6 | High | **Finer culling + prop LOD:** 12 m cells, distance LOD for scanned rocks and clutter | Fewer calls behind and beside the camera | — |
| P7 | High | **Performance HUD** (`?stats`): FPS, frame time p50/p95, calls, triangles, texture/geometry memory, load and transition times, plus a scripted fly-through benchmark | Real numbers on your Mac | — |
| P8 | Medium | **Material pass:** world-space grime and moisture masks (edges, wall bases), roughness breakup, decals; better glass (MeshPhysical, low IOR grime) | Less "clean CG" | Optional CC0 decal atlas |
| P9 | Medium | **Atmosphere:** instanced dust motes in sunbeams; optional rain/overcast weather preset with wet-ground shader | — | — |
| P10 | Medium | **ChapterManager:** load, preload next, dispose previous, transition (scaffold now, used from Chapter 02) | — | — |
| P11 | Optional | Path-traced **photo mode** (three-gpu-pathtracer) for still images | True ray-traced stills | New dependency (to discuss) |
| P12 | Optional | Touch controls for mobile | — | — |

Suggested order: P7 (to measure honestly), then P1, P3, P5, P2, then P4 and P6, then P8–P10.

## 5. Decisions needed from Butch

1. **Chapter 01 weather.** This brief asks for overcast, rain and moisture. On 2026-11-24 you chose a sunny afternoon. Keep sunny, go back to overcast with rain, or offer both as weather presets?
2. **Number of environments.** This brief describes three (Beginning, Horror, Rebuilding). The project and earlier brief have four (Survival, Shadows, Rebirth, New Era with the portfolio city). Merge to three, or keep four?
3. **KTX-Software download** (6.8 MB, Khronos, Apache-2.0) for P1.

# Development Roadmap

Phases follow the first-person master brief. Each phase has an exit criterion. A chapter is not "done" because it
renders: it needs real assets, materials, lighting, collision and functional exploration, plus Butch's visual sign-off.

| Phase | Deliverable | Exit criterion | Status |
|---|---|---|---|
| **1 · Audit** | `PROJECT_AUDIT.md`, `TECHNICAL_ARCHITECTURE.md`, `ASSET_MANIFEST.md`, `DEVELOPMENT_ROADMAP.md` | Docs reflect the first-person brief | ✅ 2026-11-24 |
| **2 · First-person prototype** | Invisible capsule, pointer-lock look, WASD, sprint, jump, slopes, stairs, collision, head bob, raycast interaction, pause menu, reduce-motion | Movement and collision verified on the test range | ✅ 2026-11-24 (see verification table in `TECHNICAL_ARCHITECTURE.md`) |
| **3 · Chapter 01 Survival** | Rural settlement from real assets (Poly Haven CC0 set on disk + Sketchfab hero house), terrain, overcast HDRI, fog, `COL_*` collision, 2–3 meaningful interactables, an openable door, an exit path that darkens | Visual sign-off by Butch | ⏳ Next |
| 3 · Chapter 02 The Shadows | Abandoned settlement, forest, chapel, cemetery, moonlight, volumetric fog, opt-in audio | Sign-off | Planned |
| 3 · Chapter 03 Rebirth | Castle, village, bridge, restoration mechanic (bridge / gate / lights) with damaged → restored transitions | Sign-off | Planned |
| 3 · Chapter 04 The New Era | City, five service destinations, project gallery, observation deck finale | Sign-off | Planned |
| **4 · Cinematics** | Opening sequence, chapter transitions, landmark reveals, ending; GSAP rails via `cameraOverride` with smooth hand-back; `ChapterManager` (load current, preload next, dispose previous) | Full playthrough with no hard cuts | Planned |
| **5 · Portfolio integration** | Services, projects, About, Contact as HTML panels in-game; real links and screenshots | All content reachable in-game **and** without the game | Planned |
| **6 · Optimisation & testing** | KTX2, LODs, instancing, Low/Medium/High tiers, touch move + look controls, memory checks across chapters, WebGL fallback check, keyboard accessibility | Stable 60 fps on a mid-range laptop, no leaks, usable on mobile | Planned |

## Immediate next steps (Phase 3, Chapter 01)

1. Inspect `assets-src/survival/out/survival-world.glb` and `survival-foliage.glb` (built by `scripts/blender/build_survival.py`) and the Poly Haven source set. Record polycounts and texture sizes in the manifest.
2. Download the hero house ("Old House Wooden Enterable Rusty", CC-BY, Sketchfab). This needs Butch's Sketchfab account.
3. Block out the village layout in Blender with real assets: a muddy road, 3–4 houses, an outdoor living space, utility poles, vegetation.
4. Build `COL_*` collision and export it. Add a `chapters/survival/` scene that replaces the test range.
5. Lighting pass: overcast HDRI (`mud_road` or `farmland_overcast`), soft sun, light fog.
6. Interactables: old photograph (narrative text from Butch, no invented memories), an openable door, one more personal object.
7. Screenshot review with Butch before Chapter 02.

## Needed from Butch

- Narrative text for Chapter 01 objects (nothing autobiographical will be invented).
- Screenshots for Kleidereisen, Endo Kids Concierge and MilaBoo, plus MilaBoo project details.
- A Sketchfab account (free) for the CC-BY hero assets. Fab purchases only if a listed paid kit is chosen.

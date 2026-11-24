# Development Roadmap

Phases follow the first-person master brief. Each phase has an exit criterion. A chapter is not "done" because it
renders: it needs real assets, materials, lighting, collision and functional exploration, plus Butch's visual sign-off.

| Phase | Deliverable | Exit criterion | Status |
|---|---|---|---|
| **1 · Audit** | `PROJECT_AUDIT.md`, `TECHNICAL_ARCHITECTURE.md`, `ASSET_MANIFEST.md`, `DEVELOPMENT_ROADMAP.md` | Docs reflect the first-person brief | ✅ 2026-11-24 |
| **2 · First-person prototype** | Invisible capsule, pointer-lock look, WASD, sprint, jump, slopes, stairs, collision, head bob, raycast interaction, pause menu, reduce-motion | Movement and collision verified on the test range | ✅ 2026-11-24 (see verification table in `TECHNICAL_ARCHITECTURE.md`) |
| **3 · Chapter 01 Survival** | Rural settlement from real assets (Poly Haven CC0 set on disk + Sketchfab hero house), terrain, overcast HDRI, fog, `COL_*` collision, 2–3 meaningful interactables, an openable door, an exit path that darkens | Visual sign-off by Butch | 🟡 Playable 2026-11-24, awaiting sign-off |
| 3 · Chapter 02 The Shadows | Abandoned settlement, forest, chapel, cemetery, moonlight, volumetric fog, opt-in audio | Sign-off | Planned |
| 3 · Chapter 03 Rebirth | Castle, village, bridge, restoration mechanic (bridge / gate / lights) with damaged → restored transitions | Sign-off | Planned |
| 3 · Chapter 04 The New Era | City, five service destinations, project gallery, observation deck finale | Sign-off | Planned |
| **4 · Cinematics** | Opening sequence, chapter transitions, landmark reveals, ending; GSAP rails via `cameraOverride` with smooth hand-back; `ChapterManager` (load current, preload next, dispose previous) | Full playthrough with no hard cuts | Planned |
| **5 · Portfolio integration** | Services, projects, About, Contact as HTML panels in-game; real links and screenshots | All content reachable in-game **and** without the game | Planned |
| **6 · Optimisation & testing** | KTX2, LODs, instancing, Low/Medium/High tiers, touch move + look controls, memory checks across chapters, WebGL fallback check, keyboard accessibility | Stable 60 fps on a mid-range laptop, no leaks, usable on mobile | Planned |

## Chapter 01 status (2026-11-24)

**Playable.** You wake inside house A, open the front door (E), explore the village and leave by the road.

| Part | State |
|---|---|
| Village | 3 houses (hollow block + plaster, timber on stilts, nipa/sawali), fenced yard, outdoor kitchen, washing line, utility poles + wires, props. Built by `scripts/blender/build_survival.py` from Poly Haven CC0 scans. |
| Web assets | `scripts/optimize-survival.mjs`: world 305 → 19 MB, foliage 24 → 2.5 MB, 4 ground layers, layout.json |
| Ground | 4-layer splat shader (mud road, laterite yards, forest floor, grass) with noise-broken borders and damp/dry patches |
| Collision | terrain triangle mesh + 161 boxes from the layout; the door has its own swinging collider |
| Interactions | front door (open/close), old photograph, oil lamp, sungka board: placeholder text until Butch writes it |
| Atmosphere | overcast HDRI, soft high sun, exponential fog, warm oil-lamp light |
| Plants | 16,830 instances of 56 variants, distance-culled (ground cover 42 m, shrubs 80 m), leaf cut-outs from Poly Haven alpha maps |
| Exit | reaching the end of the road shows the "Chapter 02 begins here" placeholder |
| Performance | ≈ 2.1M triangles / 250 draw calls at the busiest spot, including shadows |

**Still to do in Chapter 01**
1. Butch's sign-off on the look, plus the text for the photograph, lamp, sungka board and the road.
2. The darkening path toward Chapter 02 (the brief's transition). The road currently just ends.
3. Hero assets the scans can't provide: the Sketchfab weathered house, palms and banana plants (needs Butch's Sketchfab account).
4. ✅ Photographic sky (`farmland_overcast`) and the cinematic rendering pass (post-processing, height fog, DOF, wind) are done. Load size grew to ≈ 50 MB (2K building textures + 2K HDRI); KTX2 compression is the next fix.
5. Performance: KTX2 textures (needs `toktx`), LODs for the scanned rocks, and the Medium quality tier.
6. Audio: wind, distant roosters, footsteps on mud and wood (opt-in).

## Needed from Butch

- Narrative text for Chapter 01 objects (nothing autobiographical will be invented).
- Screenshots for Kleidereisen, Endo Kids Concierge and MilaBoo, plus MilaBoo project details.
- A Sketchfab account (free) for the CC-BY hero assets. Fab purchases only if a listed paid kit is chosen.

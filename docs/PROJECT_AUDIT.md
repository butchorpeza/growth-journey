# Project Audit — 2026-11-24

An audit of `growth-journey/` against the **first-person** master brief ("The Growth Journey — A Cinematic
First-Person Interactive Portfolio"). The earlier brief was third-person with a realistic player character; this one
replaces it.

## 1. What exists

| Area | State | Reuse? |
|---|---|---|
| App shell | Vite 8 + React 19 + TypeScript, prerendered HTML website (`scripts/prerender.mjs`), canonical URL `butchorpeza.com/about/` | ✅ Keep. It already meets "the website works without the game". |
| HTML website | About, Approach, Services, Work, Contact sections, chapter nav, SEO tags, JSON-LD Person/ProfilePage | ✅ Keep. This is the brief's "traditional website access" and WebGL fallback. |
| Content data | `src/data/profile.ts`, `services.ts`, `projects.ts`. Comments say every line was taken from butchorpeza.com, with no invented metrics. | ✅ Keep. **Not re-checked against the live site in this pass.** |
| 3D stack | three 0.187, @react-three/fiber 9, drei 10, @react-three/rapier 2.2, GSAP, Lenis | ✅ Matches the brief. No dependency changes were needed. |
| Game shell | Lazy-loaded overlay (`game/`), state store with save/settings, pause menu, narrative panel, interaction framework, quality setting | ✅ Keep. |
| Player | **Was** a third-person MPFB2 character with 11 baked Mixamo clips and an orbit camera | ❌ Conflicts with the brief ("no visible protagonist model"). **Replaced** by an invisible first-person controller in this pass. |
| Test range | Grey blockout: slopes, stairs, walls, jump platforms, crates, two interactables | ✅ Keep as a temporary controller test range only. Never shown as final art. |
| Chapter 01 assets | Poly Haven CC0 set on disk in `assets-src/survival/polyhaven/` (125 MB). `scripts/blender/build_survival.py` (uncommitted) has produced `survival-world.glb` and `survival-foliage.glb` in `assets-src/survival/out/`. | ⚠️ Not inspected or integrated yet. That's the first Phase 3 task. |
| Docs | Architecture, asset manifest (Chapters 01–04 researched), asset pipeline | ✅ Updated in this pass. |

## 2. Changes made in this pass

- **Removed the player character:** `player-survival.glb`, the animation state machine, the character config and the character-only docs and test script. `assets-src/character/` (not in git) was left on disk in case it's ever useful.
- **New first-person controller:** invisible capsule, eye-height camera, pointer-lock look, restrained head bob, step easing, sprint FOV, reduce-motion setting.
- **New interaction system:** centre-screen raycast with occlusion, a reticle that opens when something is in reach, and the E prompt.
- **Fixed:** clicking the scene where pointer lock is refused (embedded browsers) threw uncaught errors. It now falls back to drag-to-look quietly.
- **Credits:** the Character and Animation sections were removed from `CREDITS.md` because no Mixamo or MPFB content ships anymore.

## 3. Gaps against the brief

| Brief requirement | Current state |
|---|---|
| Four environments | None built. Only the test range exists. Chapter 01 has assets on disk and a Blender build script. |
| Cinematic sequences (GSAP) | `cameraOverride` hook exists; no sequences yet. |
| Low / Medium / High quality | Only High and Low (Performance) exist. |
| Mobile touch controls | Not built. Touch-only devices get the website with a note. |
| Audio | Setting exists (off by default); no sounds yet. |
| Project gallery: 8 named projects | Data exists for Land AI, Kleidereisen, Lumara Systems, North Horizon, JOA Electrical, Brandon Parker and Endo Kids Concierge. **MilaBoo** is only in the client-logo list, with no project entry. Screenshots exist for 8 projects but **not** for Kleidereisen, Endo Kids or MilaBoo, so these need screenshots from Butch. |
| Opening door interactions | Interaction framework supports it; no door asset yet. |

## 4. Risks and housekeeping

- **Git history cleaned (2026-11-24) before publishing.** These were removed from every commit:
  - Headless-Chrome test profiles (`.chrome-pose/`, `.chrome-sheet/`, `.chrome-test/`), which held cookies and cache from automated tests.
  - `public/models/characters/`: the old character with baked Mixamo clips and the three.js Mixamo "Soldier". Mixamo forbids redistributing them.
  - `public/models/island.glb`: the unused low-poly island of unknown origin.

  The island now lives in `assets-src/legacy/`, which isn't in git. A full pre-cleaning backup is at `../growth-journey-backup-2026-11-24.bundle`.
- **Licences:** Sketchfab "Free Standard" and Fab assets may forbid redistribution. A GLB served to a browser can be extracted. Each one has to be checked before shipping (tracked in `ASSET_MANIFEST.md`).
- **Raycast cost:** fine on the test range (0.01 ms). Large chapters need `three-mesh-bvh` or a restricted raycast set.
- **Browser testing:** the in-app preview pane throttles animation when it isn't focused. Timing-based tests need a focused window, or the fixed-step loop described in `TECHNICAL_ARCHITECTURE.md`.

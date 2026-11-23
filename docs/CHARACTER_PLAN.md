# Character & Animation Plan

## Requirements (from the brief)
One realistic adult male. Realistic proportions, clothing, skin and hair. Skeletal rig. One identity across all four
chapters, with the outfit evolving:

| Chapter | Outfit |
|---|---|
| 01 | worn, practical |
| 02 | same, darker treatment |
| 03 | clean, refined |
| 04 | contemporary professional |

Outfits come from swappable clothing meshes or material variants, not four separate models.

## Current state (2026-11-24)
- **Built:** `public/models/characters/player-survival.glb`, 1.85 MB.
  - Made with MPFB2 (CC0), using `scripts/blender/build_character.py`.
  - Adult man about 1.71 m tall, around 30 years old, with an Asian/Filipino build.
  - Young-Asian-male skin tinted warm tan, brown high-poly eyes, eyebrow006, short02 hair in dark brown.
  - **Chapter 01 outfit:** blue work shirt and grey jeans (`male_casualsuit01`) with `shoes06`.
  - About 70k triangles. Textures are 2K WebP, geometry is meshopt-compressed.
  - Skeleton: MPFB's **Mixamo** rig (52 bones, `mixamorig:*` names).
  - Preview renders: `docs/images/character-survival-front.png`, `character-survival-face.png`.
- **Animation (2026-11-24): 11 Mixamo clips baked into `player-survival.glb`** (2.1 MB total).
  - Idle, Walk, WalkBack, Run, TurnLeft, TurnRight, JumpStart, Fall, Land, Interact, LookAround.
  - The source names and trims are in `ASSET_MANIFEST.md`.
  - Downloaded on Mixamo's **Y Bot** (FBX, Without Skin, 30 fps, In Place), then baked in Blender by `scripts/blender/bake_mixamo_clips.py`:
    1. Pose the character like Y Bot's rest pose.
    2. Each frame, apply Y Bot's per-bone rotation change from rest.
    3. Scale hip height, and play the clip in place.
  - In game (`PlayerAnimations.ts`):
    - Idle, walk, run and fall loop.
    - Jump, land and inspect play once.
    - After 9 s of standing still the character looks around.
    - Walk and run playback follows ground speed. Measured clip speeds: walk 1.1 m/s, run 4.1 m/s. Player speeds: walk 1.45 m/s, run 4.6 m/s.
  - Pressing E on an interactable turns the character to face it and plays the pick-up/inspect clip.
  - WalkBack and the turns are in the GLB but not used yet. The controller always faces the direction of travel.
  - Result: `docs/images/character-ingame-poses.png`.
- **Two lessons from the bake:**
  - MPFB must build the body with `detailed_helpers=True`. Without the joint helpers the rig keeps T-pose arm and hand bones on an A-pose mesh, and every arm rotation pivots in the wrong place (thin "tube" arms, spaghetti fingers).
  - Uploading our own skeleton to Mixamo doesn't work. Mixamo assumes its own bone axes and twists the arms. The interim run-time retargeter (`retargetClips.ts`) and the Soldier clips are gone.
- **New Era outfit:** `--outfit new-era` builds the elegant suit on the same body and skeleton. Re-run the bake on it (same clips).

## Recommended pipeline (legally clean, practical in three.js)

**Body: MPFB2 (MakeHuman for Blender)**
- Source: https://extensions.blender.org/add-ons/mpfb/ (v2.0.18, Blender 4.2+, so it works in the installed Blender 5.1).
- Licence: the add-on is GPL, but the core assets (base mesh, targets, skins) are **CC0**. Generated characters may be sold and used in closed-source games.
- Clothing: the CC0 packs Shirts 01, Pants 01, Shoes 01 and Suits 01/02 cover the outfit progression (worn → professional). More realistic CC-BY packs (Shirts 02/03, Pants 02/03, Hair 02) need a credit line.
- Skin needs manual material work in Blender to read as realistic.

**Rig: MPFB "Mixamo" rig** (or GameEngine).

**Animations: Mixamo**
- Royalty-free for commercial projects, but needs an Adobe ID. Butch must log in and download.
- Clips: Idle, Walking, Walking Backwards, Running, Left/Right Turn, Jump (start / air / land), Falling Idle, Hard Landing, Picking Up / Inspect, Idle Looking Around, Opening Door, Walking Up Stairs.
- Download "Without Skin" and "In Place" for locomotion.

**CC0 fill-ins:** Quaternius Universal Animation Library (https://quaternius.com/packs/universalanimationlibrary.html) and CMU mocap (http://mocap.cs.cmu.edu/), retargeted in Blender.

**Higher-realism alternative:** Renderpeople "Eric" photoscan, CC-BY (https://sketchfab.com/3d-models/eric-rigged-001-rigged-3d-business-man-a46bc9f67aaa415bb4f3241eef900e7f).
- 20.5k faces with 8K maps. Re-rig it through Mixamo.
- Downsides: a single scanned mesh means no outfit swaps, and it needs a credit.

**Rejected**
- Character Creator: its EULA requires non-extractable formats, which conflicts with a GLB served to a browser.
- MetaHuman: too heavy, and its web terms are unverified.
- Ready Player Me: shut down January 2026.
- The island "Kid": cartoon style.

**Licence risk.** Mixamo forbids redistributing raw files, and a GLB served to a browser can be extracted. Mitigation:
bake the clips into the character GLB, compress it, and never offer it as a download. For zero ambiguity, use CC0 animation only (Quaternius + CMU).

## Blender → GLB steps
1. Generate the body in MPFB2 (adult male, about 1.78 m). Add clothing sets as separate meshes on the same armature, and the Mixamo rig.
2. Export a "reduced doll" FBX, upload it to Mixamo, and download the clips listed above as FBX "Without Skin".
3. Import the clips in Blender, snap them to the character, and give each its own Action. Name them `Idle`, `Walk`, `WalkBack`, `Run`, `TurnLeft`, `TurnRight`, `JumpStart`, `JumpAir`, `Land`, `Fall`, `Interact`, `LookAround`, `DoorOpen`, `StairsUp`.
4. Decimate to about 30–60k triangles total. Bake skin, cloth and hair to 2K PBR (base colour, normal, ORM).
5. Export one GLB with all actions and all outfits (hidden by default). Then `gltf-transform` with meshopt plus KTX2 (UASTC for normals, ETC1S for colour).
6. Set the URL, clip names and authored walk/run speeds in `src/player/characterConfig.ts`. Nothing else in the code changes.

## Open items
- Optionally send reference photos so the face and build lean towards your own look (not a replica).
- Before launch: confirm the Mixamo terms cover clips baked into a browser-served GLB (see "Licence risk" above).

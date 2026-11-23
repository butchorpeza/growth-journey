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

## Current state
- The prototype uses `public/models/characters/temp-soldier.glb`. This is the three.js example "Soldier", a Mixamo character with Mixamo rig and Idle/Walk/Run clips.
- It is **temporary** and labelled as such in the HUD. It has no jump, fall, interact or turn clips. The controller maps those states to idle until the final character arrives.
- The two `.blend` files in Downloads (Elias III, Kaspar II) are clothing-store scenes, not characters.

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

## What Butch needs to do
- Sign in to an **Adobe ID** at mixamo.com to download the animation clips. I can't log in for you.
- Choose between **MPFB2** (CC0, outfit swaps, needs skin work) and the **Renderpeople scan** (more realistic, no outfit swaps, CC-BY).
- Optionally send reference photos so the face and build lean towards your own look (not a replica).

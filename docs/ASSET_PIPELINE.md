# Asset Pipeline: Blender → GLB → browser

Every environment asset goes through the same steps. Nothing is loaded into the game straight from a marketplace download.

## 1. Intake (per asset)
1. Download into `assets-src/<chapter>/<asset>/`, which is kept out of git. Keep the original archive and the licence text or screenshot.
2. Record it in `ASSET_MANIFEST.md`: source URL, licence, price, formats, original size, tris, texture resolution, rig/animation, and status (`Pending` → `Acquired` → `Inspected` → `Integrated`).
   Never mark an asset Acquired until the file is on disk and has been opened.
3. Reject or flag anything that is Unreal-only (`.uasset`), AI-generated where that matters, stylised, low-poly, or non-commercial (NC).

## 2. Blender inspection (Blender 5.1 at `/Applications/Blender.app`)
Scriptable check: `Blender -b file.blend --python scripts/blender/inspect.py`. This prints the objects, polycounts, armatures, actions, image sizes, unit scale and modifiers. The script will be added with the first chapter.

Checklist:
- **Scale and transforms:** metres, applied transforms, sensible origin and pivot (ground contact at Z = 0), Z-up converted on export.
- **Geometry:** normals facing out, no hidden or duplicate objects, no unapplied modifiers that change the silhouette.
- **UVs and materials:** UVs present, a second UV only if a lightmap or AO bake needs it. Materials converted to Principled BSDF with image textures; procedural node materials do **not** export to glTF and must be baked.
- **Lighting:** no lighting baked into the base colour, except photoscans, which are flagged as "baked" and only used as backdrops.
- **Collision:** separate collision meshes named `COL_*`, built from simple boxes and convex shapes. They are exported as invisible nodes and the game turns them into Rapier colliders.

## 3. Optimisation targets

| Class | Triangles | Textures | Notes |
|---|---|---|---|
| Hero building / landmark | 20k–80k (+ LOD1 at 30–50%) | 2K (4K only if justified) | ORM-packed (AO, roughness, metallic) |
| Mid-distance prop or building | 2k–15k | 1K–2K | shared atlases for small props |
| Background / skyline | < 2k each | 512–1K, shared | instanced where repeated |
| Foliage | cards + instancing | 1K atlas, alpha-tested | LOD to impostors far away |
| Character | 30k–60k total | 2K body, 2K outfit, 1K hair | KTX2; one GLB with all clips |

Per-chapter budget, first load: ≤ 25 MB of compressed GLB and KTX2, ≤ 1.5 M visible triangles on the high tier, and a draw-call target under 400.

## 4. Export and compression
- Blender glTF exporter: GLB, +Y up, apply modifiers, export materials, export animations (one Action per clip), and leave out cameras and lights.
- `gltf-transform` CLI (installed as a dev dependency):
  ```
  gltf-transform resize in.glb tmp.glb --width 2048 --height 2048
  gltf-transform uastc tmp.glb tmp.glb --slots "{normalTexture,occlusionTexture,metallicRoughnessTexture}"   # needs KTX-Software (toktx)
  gltf-transform etc1s tmp.glb tmp.glb --slots "baseColorTexture"
  gltf-transform dedup tmp.glb tmp.glb && gltf-transform prune tmp.glb tmp.glb
  gltf-transform meshopt tmp.glb out.glb        # or: draco (static meshes only)
  ```
  WebP is the fallback until `toktx` is installed (`brew install ktx-software`). `scripts/optimize-island.mjs` is the working example (75 MB → 3 MB).
- **Character:** `scripts/blender/build_character.py` (body, rig, outfit) → `scripts/blender/bake_mixamo_clips.py`
  (bakes every Mixamo FBX in `assets-src/character/mixamo/` onto the rig, one action per clip) → `gltf-transform resize
  --width 2048 --height 2048`, `webp`, `prune`, `resample`, `meshopt` → `public/models/characters/player-survival.glb`.
  Review renders of the baked clips before shipping (feet planted, no twisted wrists).
- Meshopt is the default because it also compresses skinning and animation and decodes fast, and three.js ships the decoder. Draco is optional for large static meshes.
- **Always compare before and after in a test scene.** Never compress blindly, and check normal maps and silhouettes.

## 5. Runtime integration
- `useGLTF(url, false, true)` loads the GLB (meshopt on). KTX2 uses `KTX2Loader` with the Basis transcoder self-hosted in `public/basis/`.
- **Colliders:** `COL_*` nodes become `<RigidBody type="fixed" colliders="hull|cuboid">`, or a trimesh for terrain only. Render meshes are never used as colliders.
- **Repeated props:** `<Instances>` or `InstancedMesh`. Foliage scatter comes from a vertex-group or texture mask exported from Blender.
- **LOD:** Drei `<Detailed distances={[0, 40, 120]}>` for hero assets.
- **Disposal:** when a chapter unmounts, call `useGLTF.clear(url)` for its files and dispose remaining textures (`utils/disposal.ts`, Phase 08).

## 6. Licensing hygiene
- Keep `CREDITS.md`, generated from the manifest, for every CC-BY item. The website footer and pause menu will link to it.
- Fab Standard Licence allows commercial use in any engine but forbids redistributing the raw asset. A GLB served to browsers is extractable, so get legal confirmation before shipping Fab or Mixamo content.
- Never use ripped game assets, and never use Genshin Impact assets. Genshin is atmosphere inspiration only.

# Asset Manifest

Every listing below was opened and checked during research on 2026-11-23 (sources: Fab listing pages and JSON,
Sketchfab model API, Poly Haven API, ambientCG, publisher pages). **Nothing has been downloaded yet** unless the Status
says Acquired. Prices are in USD. Sketchfab downloads need a free account; Fab needs an Epic account. Every CC-BY item
needs a credit (see `CREDITS.md`, to be generated).

**Status:** `Pending` = researched, not downloaded. `Manual` = needs Butch's account or a purchase.
`Acquired` = file on disk and inspected. `Rejected` = checked and unsuitable (reason given).

---

## Acquired (on disk)

| Asset | Chapter | Source | Licence | Format | Notes | Status |
|---|---|---|---|---|---|---|
| Overcast Soil (Pure Sky) HDRI, 1K | Prototype / Survival | https://polyhaven.com/a/overcast_soil_puresky | CC0 | HDR 1.2 MB | `public/hdri/` | Acquired |
| three.js example "Soldier" | Prototype only | https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Soldier.glb | Mixamo character (Adobe royalty-free terms) from the three.js repo | GLB 2.2 MB, Mixamo rig, Idle/Walk/Run | Interim clip source; **removed 2026-11-24** (replaced by the Mixamo set below) | Retired |
| Mixamo clip set (11 clips) | — | https://www.mixamo.com/ | Adobe Mixamo terms | FBX in `assets-src/character/mixamo/` (not in git) | Was baked into the third-person character. The first-person brief has no player model, so it was **removed from the site 2026-11-24**. | Retired |
| Survival CC0 set from Poly Haven (fetched with `scripts/fetch-polyhaven.mjs`) | Survival | https://polyhaven.com (each folder has SOURCE.txt) | CC0 | HDRI 2K, glTF 1K, PBR 2K | HDRIs: mud_road, farmland_overcast. Materials: rusty_corrugated_iron, red_laterite_soil_stones, concrete_block_wall, weathered_planks, damaged_plaster, muddy_tracks. Models: modular_electricity_poles (200k polys, needs LOD), modular_electric_cables, plastic_monobloc_chair_01, WoodenTable_01, plastic_jerrycan, wooden_bucket_01, pot_enamel_01, barrel_stove, wicker_basket_01, sungka_board, vintage_oil_lamp, wooden_crate_01, old_tyre, wooden_ladder, rusted_spade_01. In `assets-src/survival/polyhaven/` (125 MB source; not in git). | Acquired (inspection pending in Phase 04) |
| MPFB2 extension v2.0.18 | — | https://extensions.blender.org/add-ons/mpfb/ | GPL add-on, CC0 assets | Blender extension | Built the third-person character, which was **removed 2026-11-24** (first-person brief, no player model) | Retired |
| Island + "Kid" (Butch's Downloads) | — | local file | unknown origin | GLB 75 MB | Low-poly and cartoon, so not usable as final art | Rejected |

---

## Chapter 01 summary (format from the master brief)

| Chapter | Asset | Source | Format | License | Optimization | Status |
|---|---|---|---|---|---|---|
| 01 | Overcast HDRIs (overcast_soil_puresky, mud_road, farmland_overcast) | Poly Haven | HDR 1K–2K | CC0 | farmland_overcast 2K (6.5 MB) is the Chapter 01 sky; a 1K export would save ~5 MB | Integrated |
| 01 | PBR materials: rusty corrugated iron, laterite soil, concrete block, weathered planks, damaged plaster, muddy tracks | Poly Haven | 2K JPG/PNG maps | CC0 | KTX2, ORM packing | Acquired |
| 01 | Household props (monobloc chair, table, jerrycan, bucket, enamel pot, barrel stove, basket, sungka board, oil lamp, crate, tyre, ladder, spade) | Poly Haven | glTF, 1K | CC0 | meshopt, 512 WebP, scans simplified | Integrated |
| 01 | Utility poles + cables | Poly Haven | glTF | CC0 | Simplified to 40% | Integrated |
| 01 | Village build (`survival-world.glb`, `survival-foliage.glb`) | `scripts/blender/build_survival.py` | GLB | CC0 sources | `scripts/optimize-survival.mjs`: simplify scans, merge per 24 m cell, 1K/512 WebP, meshopt → `public/models/survival/` (19 MB + 2.5 MB) | Integrated |
| 01 | Plant alpha (cut-out) maps for grass_bermuda_01, weed_plant_02, nettle_plant, shrub_02/03/04, calathea_orbifolia_01, anthurium_botany_01 | Poly Haven | JPG 1K (1.1 MB total) | CC0 | Merged into the colour textures by the optimiser | Acquired 2026-11-24 |
| 01 | Banana Plant by evolveduk | https://sketchfab.com/3d-models/banana-plant-85695b82c7ba4b3497a663616cc3bf25 | GLB, 1K | CC-BY 4.0 (credited) | 4.3k tris; banana.glb 0.7 MB + banana_lod.glb 0.3 MB, instanced groves | Integrated 2026-11-24 |
| 01 | Sky: Kloofendal 48d Partly Cloudy (Pure Sky) | Poly Haven | HDR 2K, 5.5 MB | CC0 | sun direction measured from the image | Integrated 2026-11-24 |
| 01 | Footsteps: Kenney Impact Sounds (grass, concrete, wood ×5) | https://kenney.nl/assets/impact-sounds | OGG, 136 KB used | CC0 | — | Integrated 2026-11-24 |
| 01 | Grass | procedural (fineGrass.ts) | — | own | replaces the scanned grass tufts | Integrated 2026-11-24 |
| 01 | Hero weathered house ("Old House Wooden Enterable Rusty") | Sketchfab | glTF / FBX | CC-BY 4.0 | 24k faces, 2K, `COL_*` collision | Pending |
| 01 | Shacks (Old Shack 1, Shack 2) | Blendkit | .blend | CC0 / Blendkit RF | Export GLB, 2K | Pending |
| 01 | Clothes line, wooden cart, bicycle, corrugated panels | Sketchfab | glTF | CC-BY | Decimate where > 50k faces | Pending |
| 01 | Rusty motorbike (cansuaydin, 82k) | Sketchfab | GLB | CC-BY 4.0 | Full detail, 1K WebP, meshopt: 1.9 MB | Acquired 2026-11-24 (a tricycle and a jeepney were tried and dropped: too low-poly up close) |
| 01 | Stone portal frame at the end of the road (soidev, 2.9k) | Sketchfab | GLB | CC-BY 4.0 | 1K WebP, 0.4 MB | Acquired 2026-11-24 |
| 01 | Palms, banana / tropical plants | Sketchfab | glTF | CC-BY | Alpha-tested cards, instancing, impostors far away | Pending |
| 01 | Trees, ferns, shrubs, rocks, distant hills | Poly Haven | glTF | CC0 | island_tree needs impostors (1.8–3.7M polys) | Pending |

The detailed research per asset follows.

## 01 · Survival (grounded tropical rural village)
Blendkit (BlenderKit renamed itself in 2026) needs the add-on plus a free account and delivers .blend only.

**Sketchfab "Free Standard" licence:** commercial use is allowed, but the asset may not be redistributed. A GLB served to a browser can be extracted, so check this before shipping.

| Asset | Category | Source | Licence | Price | Specs | Status |
|---|---|---|---|---|---|---|
| Old House Wooden Enterable Rusty | Hero weathered house | https://sketchfab.com/3d-models/old-house-wooden-enterable-rusty-7f496b3002d24341a618408cb8221e8c | CC-BY 4.0 | Free | 24.2k faces; rusted corrugated roof, timber upper floor, concrete ground floor | Pending (**best fit**) |
| Abandoned Building Shop Old House | Weathered house / shop | https://sketchfab.com/3d-models/abandoned-building-shop-old-house-0ed14367314946b298d9a58db66da040 | CC-BY | Free | 12.8k faces | Pending |
| Rustic Old Brick & Mud House | Small concrete house | https://sketchfab.com/3d-models/rustic-old-brick-mud-house-low-poly-b91c140cd167434bbeae85f03240bf25 | CC-BY | Free | 469k faces, realistic despite its title; decimate | Pending |
| Old Shack 1 | Storage shed | https://www.blendkit.com/asset-gallery-detail/813771d5-0b43-415c-bd75-98d3bf9a82d1/ | CC0 | Free | 14.6k faces, 2K, rusted corrugated sheets | Pending |
| Shack 2 | Shed | https://www.blendkit.com/asset-gallery-detail/1b280ba7-0439-476f-b22d-31a0942e48b5/ | Blendkit RF | Free | 11.4k faces, 2K | Pending |
| NIPA HUT | Outdoor shelter | https://sketchfab.com/3d-models/nipa-hut-0162f1a7e8ec4fe18a1feae6279e7420 | CC-BY | Free | 54.8k faces, semi-realistic | Pending |
| South East Asian Village House Set (AliasHasim) | Village houses | https://www.fab.com/listings/a80b5c6f-a185-4f25-b3a2-81a6413294ab | Fab (tier unverified) | ≈ PHP 926 | FBX + OBJ, 4K/8K; the only non-Unreal regional option | Manual |
| Asian Farm Props and Modular Shacks Vol. 1 | Shacks + props | https://www.fab.com/listings/1c24885b-eff0-40e0-8de5-51d0af52bcf9 | Fab | ≈ PHP 2,076 | `.uasset` only | Rejected (Unreal-only) |
| Tropical Village (PolyPixel) | Huts, palms, banana | https://www.fab.com/listings/5f5b8dc8-34c1-423a-ae0a-899e35f6d803 | Fab | ≈ PHP 1,916 | `.uasset` only | Rejected (Unreal-only) |
| modular_electricity_poles + modular_electric_cables | Utility poles + wires | https://polyhaven.com/a/modular_electricity_poles · https://polyhaven.com/a/modular_electric_cables | CC0 | Free | 200k / 42k polys, 12.4 / 6.0 MB as glTF with 1K textures | Pending (**best fit**) |
| Utility Pole – 2048px² | Utility pole | https://sketchfab.com/3d-models/utility-pole-2048px2-dbb782fcb99b4b4395ffc44b0bca7e92 | CC-BY | Free | 17.1k faces, 2K | Pending |
| Fences, Concretes, Metal, Desert, Old Pack | Fences / walls | https://sketchfab.com/3d-models/fences-concretes-metal-desert-old-pack-0cbf546419cf499cbabfee3af0916215 | CC-BY | Free | 2.5k faces | Pending |
| chainlink fence, gate latch | Fence / gate | https://polyhaven.com/a/modular_chainlink_fence · https://polyhaven.com/a/gate_latch_01 | CC0 | Free | 89k polys | Pending |
| Poly Haven household props | Table, chairs, containers, cooking | https://polyhaven.com/a/plastic_monobloc_chair_01 · /a/WoodenTable_01 · /a/plastic_jerrycan · /a/plastic_container · /a/wooden_bucket_01 · /a/metal_jerrycan · /a/pot_enamel_01 · /a/barrel_stove · /a/wicker_basket_01 · /a/sungka_board · /a/vintage_oil_lamp · /a/wooden_crate_01 | CC0 | Free | 1–20k polys each, scanned; the monobloc chair and sungka board are authentic Filipino touches | Pending |
| Poly Haven tools / junk | Spade, tyre, ladder, hatchet | https://polyhaven.com/a/rusted_spade_01 · /a/old_tyre · /a/wooden_ladder · /a/hatchet | CC0 | Free | 2–11k polys | Pending |
| Old Rusty Rice Cooker | Cooking prop | https://sketchfab.com/3d-models/old-rusty-rice-cooker-crafted-by-jerovdl-44c181d1d71c49399ae23f65198b94e4 | CC-BY | Free | 5.3k faces | Pending |
| Old Cooking Pot / Plastic pail (scan) | Props | https://sketchfab.com/3d-models/old-cooking-pot-e2914c2ce86141d9b8d9859a4aed7ab0 · https://sketchfab.com/3d-models/pail-bucket-plastic-3d-scan-53e3310475974512b39dc46f3a3d7dd5 | CC-BY | Free | 15k / 40k faces | Pending |
| Clothes Line | Hanging clothes | https://sketchfab.com/3d-models/clothes-line-ccd9af8480e64da2b5646f5e9b2c9bce | CC-BY | Free | 129k faces (decimate) | Pending |
| Old wooden cart | Broken cart | https://sketchfab.com/3d-models/old-wooden-cart-c06d6248b9d64173b376926ee212fd6f | CC-BY | Free | 57.4k faces | Pending |
| Old red bicycle | Bicycle | https://sketchfab.com/3d-models/old-red-bicycle-577376dfd2f142359dbac143a49a2489 | CC-BY | Free | 18k faces, clean (needs a rust pass) | Pending |
| Rusted corrugated panels | Loose roofing | https://sketchfab.com/3d-models/rusted-corrugated-panels-ea06568a9e304ecc806cb7cb0552e269 | CC-BY | Free | 6.7k faces | Pending |
| Damaged Corrugated Sheets Pack | Loose roofing | https://sketchfab.com/3d-models/damaged-corrugated-sheets-pack-05f5e371f6f8473b9ccf0f690cb17d46 | Sketchfab Free Standard | Free | 81.6k faces | Pending (licence check) |
| Realistic Palm Tree 2 / Coconut Palm | Palms | https://sketchfab.com/3d-models/realistic-palm-tree-2-free-d05c8ffb6ec64a7184c4b673e21f7224 · https://sketchfab.com/3d-models/coconut-palm-26e787f2ff2e4c0fb004c3b0210805a3 | CC-BY | Free | 60.8k / 7.4k faces | Pending |
| Tropical Plants Pack M02P | Banana, monstera, palms | https://sketchfab.com/3d-models/tropical-plants-pack-m02p-2f093afb792742438f0f7ba7eaab90f0 | CC-BY | Free | 46.6k faces, realistic cards | Pending |
| Poly Haven vegetation + rocks | Trees, fern, grass, shrubs, rocks, distant hills | https://polyhaven.com/a/pachira_aquatica_01 · /a/fern_02 · /a/shrub_01 · /a/rock_moss_set_01 · /a/boulder_01 · /a/mountainside · /a/island_tree_01 | CC0 | Free | island_tree is 1.8–3.7M polys, so it needs impostors or decimation | Pending |

**Materials (CC0):**
- Rusted corrugated iron: polyhaven rusty_corrugated_iron, corrugated_iron_02, worn_corrugated_iron; ambientCG CorrugatedSteel006A, 007A, 008A
- Mud and roads: polyhaven muddy_tracks, red_laterite_soil_stones, mud_forest, stony_dirt_path; ambientCG Ground083, Ground054
- Weathered planks: polyhaven weathered_planks, wood_peeling_paint_weathered
- Concrete: polyhaven cracked_concrete_wall, concrete_block_wall (hollow blocks), concrete_moss
- Plaster: polyhaven damaged_plaster, worn_cracked_plaster
- Nipa-style roofs: polyhaven thatch_roof_angled, reed_roof_04
- Bark: polyhaven palm_tree_bark

**HDRI (CC0):** https://polyhaven.com/a/mud_road · /a/farmland_overcast · /a/kloofendal_overcast (Overcast Soil is already acquired)

**Custom Blender work:**
- A small hollow-block house with a GI roof, and a nipa/sawali stilt house. No realistic free game-ready version exists; build them from the CC0 materials above.
- Banana-leaf cards from a photo atlas.
- A rust pass on the bicycle.

---

## 02 · The Shadows (forest road + abandoned settlement)
| Asset | Category | Source | Licence | Price | Specs | Status |
|---|---|---|---|---|---|---|
| Abandoned Gothic House | Hero mansion | https://sketchfab.com/3d-models/abandoned-gothic-house-9cf92b2776064207b41055d9fecc9c36 | CC-BY | Free | 178k faces, ivy, moss, broken windows | Pending (**best fit**) |
| FREE Gothic Victorian Mansion | Mansion (lighter) | https://sketchfab.com/3d-models/free-gothic-victorian-mansion-3d-environment-0149bead014141519fd8a0536c3cd3c7 | CC-BY | Free | 45k faces | Pending |
| Abandoned House (PBRPX) | Ruined concrete building | https://www.blendkit.com/asset-gallery-detail/7cb3f4f0-2a23-4c7b-abfe-d9587adee35e/ | CC0 | Free | 1.11M faces, 8K (decimate); also works for Survival | Pending |
| Forest house ruin (scan) | Abandoned wooden house | https://sketchfab.com/3d-models/forest-house-ruin-d19549af2c6c45638cedaa70f805414b | CC-BY | Free | 990k faces (retopology needed) | Pending |
| St. Guevroc Chapel | Chapel | https://sketchfab.com/3d-models/st-guevroc-chapel-bb4098bdeec84cfbaf0476540662dd37 | CC-BY | Free | 60.6k faces, realistic stone | Pending |
| Chapel (Kyb3r) / Old English Church | Chapel / church | https://www.blendkit.com/asset-gallery-detail/9334501b-4218-41b6-9f52-3d20e3e43892/ · https://www.blendkit.com/asset-gallery-detail/8c95f407-9b78-4f64-8fd3-baa976494b97/ | Blendkit RF | Free | 8.5k faces / 474k faces, 4K | Pending |
| gravestone pack | Gravestones | https://sketchfab.com/3d-models/gravestone-pack-915174119a454fa7b2573a9e3bddac8b | CC-BY | Free | 8.3k faces | Pending (**best fit**) |
| Cemetery Iron Fence & Gate Pack | Cemetery gates | https://sketchfab.com/3d-models/cemetery-iron-fence-gate-pack-07f20cee85cb4ac9b887ecaa73617dd0 | CC-BY | Free | 16.9k faces | Pending |
| large_iron_gate | Rusted gate | https://polyhaven.com/a/large_iron_gate | CC0 | Free | 38k polys, 3.1 MB as glTF with 1K textures | Pending (**best fit**) |
| Tropical Graveyard Pack (Kaizen) | Southeast Asian cemetery | https://www.fab.com/listings/2fafcf07-a2e0-4008-905a-9533e051cd2a | Fab | ≈ PHP 4,470 | `.uasset` only (photogrammetry) | Rejected (Unreal-only) |
| Abandoned Mansion Modular (Krystian Zem) | Mansion kit | https://www.fab.com/listings/79ffb105-7fd0-473d-acb9-88483f76101e | Fab | ≈ PHP 2,554 | Unreal + 3ds Max/Substance sources | Manual (sources may allow conversion) |
| abandoned house interior (scan) | Ruined room | https://sketchfab.com/3d-models/abandoned-house-interior-c2130293962244d0b8e325919b4cf99d | CC-BY | Free | 619k faces (decimate) | Pending |
| Poly Haven interior set | Gothic bed and cabinet, old bed frame, rocking chair, grandfather clock, worn bookshelf, books, mirror, chandelier, candlestick | https://polyhaven.com/a/GothicBed_01 · /a/GothicCabinet_01 · /a/old_bed_frame · /a/Rockingchair_01 · /a/vintage_grandfather_clock_01 · /a/wooden_bookshelf_worn · /a/book_encyclopedia_set_01 · /a/ornate_mirror_01 · /a/Chandelier_01 · /a/wooden_candlestick | CC0 | Free | 3–112k polys | Pending |
| Shrouded Couch (and matching table, chair, figure) | Sheet-covered furniture | https://www.blendkit.com/asset-gallery-detail/36bcc728-6618-4ec4-85f6-e11b1bf14770/ | Blendkit RF | Free | 4k faces, 2K | Pending |
| Broken chair (scan), book stack, paper boxes, Victorian curtain | Ruined-room props | https://sketchfab.com/3d-models/imperfect-broken-chair-0f5bf969c7404cf1ada939d09f17f350 · https://sketchfab.com/3d-models/medieval-book-stack-0ea43f7fdcb7411cb1123b987f297d41 · https://sketchfab.com/3d-models/old-paper-cardboard-boxes-72a4804f8a4d4de18e59abb60b81c54f · https://sketchfab.com/3d-models/victorian-curtain-3a7e18700d5c4033a67d1d143b3cf64c | CC-BY | Free | 3–99k faces | Pending |
| Dead trees, stumps, roots, branches, moss (scans) | Dead forest | https://polyhaven.com/a/dead_tree_trunk · /a/dead_tree_trunk_02 · /a/tree_stump_01 · /a/root_cluster_01 · /a/dry_branches_medium_01 · /a/moss_01 | CC0 | Free | 17k–339k polys | Pending |
| Dead Tree (Calvin Serrano) | Dead tree | https://www.blendkit.com/asset-gallery-detail/d3eb288f-2e01-416f-9098-b7736681d9b4/ | Blendkit RF | Free | 27.5k faces, 8K | Pending |
| VW Beetle wreck / covered car | Abandoned vehicle | https://www.blendkit.com/asset-gallery-detail/ac9264d6-f1c2-4531-b6de-1dc083415026/ · https://polyhaven.com/a/covered_car | Blendkit RF / CC0 | Free | 16.5k faces, 4K | Pending (trademarked car shape: check) |
| Abandoned street lights pack / street lamps | Broken streetlights | https://sketchfab.com/3d-models/abandoned-street-lights-pack-c853eca300e8435d8fe9206bcb524eda · https://polyhaven.com/a/street_lamp_01 · /a/street_lamp_02 | CC-BY / CC0 | Free | 22k faces / 20–31k polys | Pending |
| Rusty oil lanterns | Lanterns | https://sketchfab.com/3d-models/rusty-old-oil-lantern-de28cba29f58414c914298f648da90bf · https://polyhaven.com/a/Lantern_01 | CC-BY / CC0 | Free | 7.6k faces / 34k polys | Pending |
| Forest mud puddle (scan) | Forest-road ground | https://sketchfab.com/3d-models/forest-mud-puddle-6a92c9c3db254defa8bc31d240ebe1f2 | CC-BY | Free | 318k faces | Pending |
| Abandoned Mansion (udayjeet) · Abandoned mansion bedroom | Mansion / room | https://sketchfab.com/3d-models/abandoned-mansion-7fa8fd7a219f4fbcaa6532c3b9364739 · https://sketchfab.com/3d-models/abandoned-mansion-bedroom-3a3f5aa2c04840bf8437eec822ec5481 | Sketchfab Free Standard | Free | 244k / 53.7k faces | Pending (licence check) |

**Materials (CC0):**
- Plaster and wallpaper: polyhaven worn_mossy_plasterwall, damaged_plaster; ambientCG Wallpaper001C (damaged wallpaper)
- Stone and moss: polyhaven mossy_stone_wall, mossy_rock; ambientCG Moss002
- Forest floor: polyhaven forest_floor, forest_leaves_02, dry_decay_leaves; ambientCG Ground037, ScatteredLeaves009
- Rust and bark: ambientCG Rust009, Bark011

**HDRI (CC0):** https://polyhaven.com/a/moonlit_golf · /a/narrow_moonlit_road · /a/qwantani_moonrise

**Custom Blender work:**
- Torn curtains: cloth simulation with torn alpha masks.
- Old staircase: built from the plank materials. The realistic free staircases found are all NC-ND licensed, so they're excluded.

**Excluded for licence reasons:** CC-BY-NC and NC-ND models (Old Rusty Car, the RAWscan mansion, the Dilapidated Spiral Staircase, the cemetery angel scans).

---

## 03 · Rebirth (realistic medieval kingdom)

### Client-supplied references (verified)
| Asset | Source | Licence / price | Formats | Specs | Verdict |
|---|---|---|---|---|---|
| Medieval Fantasy Village (CODEMA) | https://codema.itch.io/medieval-fantasy-village | Commercial OK, no resale, $9.99+ | BLEND (4.2+), FBX, GLB, OBJ | 65 assets, 188k tris, 58 MB, procedural node materials + 48 baked maps | **Poor fit as hero art.** Tagged low-poly/fantasy, and procedural materials don't export. Filler only. |
| Medieval Castle 3D Modular Kit (RoyalPoly) | https://www.fab.com/listings/a1d9b8d9-1814-44b0-b713-4178a995a20d | Fab Standard, $44.99 | BLEND, FBX, converted GLB | 120 pieces, 2 texture sets at 2K/4K/8K, real-world dimensions, tagged Realistic | **Good fit**: castle, gate, towers, walls. `Manual` |
| European Medieval Castle 3D Scan (DoggoCreative) | https://sketchfab.com/3d-models/european-medieval-castle-3d-scan-71e06c3774804937b0fd88b98cda4ea7 | CC-BY 4.0, free | GLB 44 MB + source | 768k tris, 4K (8K external), baked lighting | **Backdrop only**, after decimation. Can't host gameplay. |
| Modular Futuristic City Kit (SAMOOSAA) | https://www.fab.com/listings/1424c241-7800-45cc-af66-614d31af914c | Fab Standard, $49.99 / $149.99 | 14 GLB (about 210 MB confirmed) | tris and texture resolution not stated | **Reject.** The listing says "Generated with AI: Yes" and it is tagged Cyberpunk/Neon, which the brief excludes. |

### Additional candidates
| Asset | Category | Source | Licence | Price | Specs | Status |
|---|---|---|---|---|---|---|
| Medieval House 3D Modular Kit (RoyalPoly) | Village houses (new and rundown sets, suits the restoration states) | https://www.fab.com/listings/35f80179-1cb3-4c72-b5ab-f72bcbd5bfd4 | Fab Standard | $44.99 | 150 pieces, 2K–8K, BLEND/FBX | Manual |
| Medieval Castle (UgurYksk) | Central castle | https://sketchfab.com/3d-models/medieval-castle-2964776c3847493ba908fd192e071ca3 | CC-BY | Free | 64k tris, 2K | Pending |
| Medieval Fortress Kit (ayarady) | Walls, gate, towers | https://sketchfab.com/3d-models/medieval-fortress-kit-f246ce47e15f407b8399c1b270d782bd | CC-BY | Free | 92k tris, 4K (225 MB GLB, resize) | Pending |
| Tower and Castle Walls | Towers | https://sketchfab.com/3d-models/tower-and-castle-walls-fca85f8450604e6f98952a2739f92672 | CC-BY | Free | 10k tris, 2K | Pending |
| Simple Castle Gate | Gate | https://sketchfab.com/3d-models/simple-castle-gate-0e2fa827aa034f718a35f6094fd097a7 | CC-BY | Free | 43k tris, 4K | Pending |
| Stone Bridge (Templa) | Bridge | https://sketchfab.com/3d-models/stone-bridge-38879ba7169d4944ac3ef85580f5b1a5 | CC-BY | Free | 2.9k tris, 4K | Pending |
| Stone Bridge_3arch | Bridge | https://sketchfab.com/3d-models/stone-bridge-3arch-58691a67ba774f2bbccff7ce8f85d1d8 | CC-BY | Free | 3.5k tris, 4K | Pending |
| Asset Pack – Blacksmith Equipment | Blacksmith props | https://sketchfab.com/3d-models/asset-pack-blacksmith-equipment-0f358eaab21d4e70836ad855de34c423 | CC-BY | Free | 37k tris, 2K | Pending |
| Medieval Food Stall | Market | https://sketchfab.com/3d-models/medieval-food-stall-7d9b2922dd0941dab820c4763078c789 | CC-BY | Free | 25k tris, 2K | Pending |
| Medieval Market Asset Pack | Market props | https://sketchfab.com/3d-models/medieval-market-asset-pack-006ffc4ac5f34a1782f567b07e6605f2 | CC-BY | Free | 31k tris, 1–2K | Pending |
| Medieval Fayre | Tents, carts, stalls | https://sketchfab.com/3d-models/medieval-fayre-free-game-assets-595624e5bd7543fe968bd8b2e3280196 | CC-BY | Free | 65k tris, 2K | Pending |
| Well (FlukierJupiter) | Well | https://sketchfab.com/3d-models/well-d8442bc92f224f0ebfa8446a1bca836d | CC-BY | Free | 9k tris, 2K | Pending |
| Medieval Fountain Empty | Fountain | https://sketchfab.com/3d-models/medieval-fountain-empty-free-952a9c257db641229902c36abb97e8bc | CC-BY | Free | 4.5k tris, 1K | Pending |
| Medieval Cart (Peter.Nox) | Cart | https://sketchfab.com/3d-models/medieval-cart-5dedd347d77943729475486f0d1d05e8 | CC-BY | Free | 4.2k tris, 2K | Pending |
| Old Lantern | Lantern | https://sketchfab.com/3d-models/old-lantern-game-ready-asset-42d15b68713f4a9ba0554ea2ea7efed0 | CC-BY | Free | 12.8k tris, 2K | Pending |
| Medieval Wall Scan 01 | Stone wall | https://sketchfab.com/3d-models/medieval-wall-scan-01-e03c857ecd554a03b707f5dffb063b1e | CC-BY | Free | 41k tris, 8K (photoscan) | Pending |
| Waterfall Mountain River | Waterfall backdrop | https://sketchfab.com/3d-models/waterfall-mountain-river-446f36f2ccb54cf1bc090cd5bc25dce1 | CC-BY | Free | 313k tris, 4K, needs a water shader | Pending |
| Zwoelfernock Mountain Peak | Mountain backdrop | https://sketchfab.com/3d-models/zwoelfernock-mountain-peek-2516-m-8252-ft-cb035c08e59f48459c56156327b56dc5 | CC-BY | Free | 535k tris, 8K | Pending |
| Gravel Rally tree pack | Pine and broadleaf trees | https://sketchfab.com/3d-models/gravel-rally-tree-pack-27-trees-3-seasons-65da19fc1a4449a988f8dbaf2513ae59 | CC-BY | Free | 27 trees × 3 seasons, made for a browser game | Pending |
| Pine trees pack (LODs) | Pines | https://sketchfab.com/3d-models/pine-trees-pack-lowpoly-game-ready-lods-e1e9c07b8e2e445c943fec660beefba2 | CC-BY | Free | 15 trees, LODs + billboards | Pending (check realism) |
| Poly Haven rocks, plants, props | Moss rocks, boulder, fern, moss, shrub, stump, barrels, crates, bucket, lantern | https://polyhaven.com/a/rock_moss_set_01 · /a/rock_moss_set_02 · /a/boulder_01 · /a/fern_02 · /a/moss_01 · /a/shrub_01 · /a/tree_stump_01 · /a/wooden_barrels_01 · /a/wooden_crate_01 · /a/wooden_bucket_01 · /a/wooden_lantern_01 | CC0 | Free | 2k–124k tris, 1–8K | Pending (no login) |
| Castle Forge (Hivemind) | Castle | https://www.fab.com/listings/8b55ff8e-9d1c-43d8-9078-6aa03a4ffcd7 | Fab Standard | ~$49 | `.uasset` only | Rejected (Unreal-only) |

**Materials (CC0):**
- Castle stone: polyhaven castle_wall_slates, medieval_blocks_02; ambientCG Bricks089, Bricks100
- Cobblestone: polyhaven cobblestone_floor_05, mossy_cobblestone; ambientCG PavingStones046
- Roof tiles: polyhaven clay_roof_tiles_02; ambientCG RoofingTiles014B
- Timber: polyhaven medieval_wood; ambientCG WoodSiding008
- Moss rock and ground: polyhaven mossy_rock, forest_ground_04; ambientCG Rock064

**HDRI (CC0):** https://polyhaven.com/a/fouriesburg_mountain_lookout · /a/champagne_castle_1 · /a/qwantani_dusk_2

---

## 04 · The New Era (believable future city)
| Asset | Category | Source | Licence | Price | Specs | Status |
|---|---|---|---|---|---|---|
| Futuristic city Utopian Buildings kit (ZippyLee) | 23 towers | https://www.fab.com/listings/6c4b1e2a-16db-47c1-854a-dab46c3264fd | Fab Standard | $69.99 (50% off until 2 Dec) | BLEND, FBX, glTF; not AI-generated | Manual (check previews) |
| Singapore Office Skyscraper | Office tower | https://sketchfab.com/3d-models/singapore-office-skyscraper-free-2305f0fe03ba44229a1f768dcb48bd8f | CC-BY | Free | 26k tris, 1K, 10 MB, web-friendly | Pending |
| SKYSCRAPER (mitya-petrov) | Central tower | https://sketchfab.com/3d-models/skyscraper-659d9c8cb53f48e5a779d75ba039e8fb | CC-BY | Free | 34k tris, 4K | Pending |
| [FREE] Atlanta Corporate Office Building | Office | https://sketchfab.com/3d-models/free-atlanta-corperate-office-building-d96380fb001345cca9a9be121f3e43d5 | CC-BY | Free | 37k tris, 2K | Pending |
| Modern Building – Gallery – Office | Innovation centre | https://sketchfab.com/3d-models/modern-building-gallery-office-5546323923cf4b539071809d87a3e3b8 | CC-BY | Free | 5k tris, 4K | Pending |
| Futuristic background buildings kit | Skyline | https://sketchfab.com/3d-models/futuristic-background-buildings-kit-2d5727126bc441ce88dba3a891857876 | CC-BY | Free | 150k tris, 4K, partly cyberpunk | Pending (select pieces) |
| Helix Bridge | Pedestrian bridge | https://sketchfab.com/3d-models/helix-bridge-1221edc4c2454b29b3b6adcd6fdefb0e | CC-BY | Free | 160k tris, untextured | Pending |
| Modern / Future Street 1 and 2 | Roads | https://sketchfab.com/3d-models/modern-future-street-a12fd208cf81468984e6b54408d74afb · https://sketchfab.com/3d-models/modern-future-street-2-d4616756f4ef4d3a887776f403e0f519 | CC-BY | Free | 10k / 352k tris | Pending |
| Futuristic racing car "Molnia" | Vehicle | https://sketchfab.com/3d-models/futuristic-racing-car-molnia-738a78a4c9154614b90029bf8bb80d61 | CC-BY | Free | 18k tris, 4K | Pending |
| Standard Bus Stop | Transit shelter | https://sketchfab.com/3d-models/standard-bus-stop-32cc4c5f6aa147acabdb173e2d2373fa | CC-BY | Free | 11.6k tris | Pending |
| Modern Bench 1 | Bench | https://sketchfab.com/3d-models/modern-bench-1-caa4515e36444e4c8c100296463e83c1 | CC-BY | Free | 2k tris | Pending |
| Poly Haven street furniture | Seating, lamp, planters | https://polyhaven.com/a/modular_street_seating · /a/street_lamp_01 · /a/planter_box_01 · /a/potted_plant_01 | CC0 | Free | 8k–96k tris | Pending |
| [FREE] London Skyscraper | Glass tower | https://sketchfab.com/3d-models/free-london-skyscraper-52b73f6ea18a440cb42734840d5edc72 | CC-BY | Free | real landmark (One Blackfriars) | Rejected (recognisable real building) |
| Audi e-tron Vision GT | Vehicle | https://sketchfab.com/3d-models/2018-audi-e-tron-vision-gran-turismo-2a9de0433cd94d5086f3dd0365b4a461 | CC-BY | Free | — | Rejected (trademark) |
| Monorail (Panza) | Transit | https://sketchfab.com/3d-models/monorail-4f7d1fb61753490da5c5001ce23149a5 | CC-BY | Free | based on the Disneyland monorail | Rejected (IP risk) |

**Materials (CC0, ambientCG):** facade glass Facade018A, Facade001, Facade006 · brushed metal Metal009, Metal051A · polished concrete Concrete034, Concrete046 · asphalt Asphalt031, Road012A. Glass itself uses three.js `MeshPhysicalMaterial` with transmission.

**HDRI (CC0):** dusk https://polyhaven.com/a/sunset_jhbcentral · /a/modern_evening_street; day /a/homecoming_center_rooftop · /a/potsdamer_platz

**Must be custom-modelled in Blender** (no realistic, non-cyberpunk source found): central tech tower, observation deck, innovation centre, transit station, digital kiosks and holographic displays, and the five service destinations.

---

## Player character and animation — retired (2026-11-24)
The first-person brief has **no visible player**: no character model, hands, shadow or skeletal animation. The MPFB2
character (`player-survival.glb`) and its 11 Mixamo clips were removed from the site. The source files stay in
`assets-src/character/`, which isn't in git. Mixamo/MPFB may come back only for *non-player* figures, if a chapter
ever calls for them.

## Audio (CC0 unless noted; check each sound's own licence field on Freesound)
| Item | Source |
|---|---|
| Footsteps on grass, gravel, mud and rock (walk, run, jump) | https://freesound.org/people/Nox_Sound/packs/29889/ |
| Footsteps (wood, concrete) | https://freesound.org/people/florianreichelt/packs/25949/ |
| Wind in trees | https://freesound.org/people/florianreichelt/packs/25951/ |
| Rural ambience | https://freesound.org/people/Kinoton/packs/20130/ |
| Night forest | https://freesound.org/people/felix.blume/packs/21116/ |
| Town ambience | https://freesound.org/people/bolkmar/packs/24065/ |
| City traffic | https://freesound.org/people/lupalenzuela/packs/28747/ |
| UI and foley | https://kenney.nl/assets/rpg-audio · https://kenney.nl/assets/impact-sounds |
| Pro ambiences (royalty-free, no attribution) | https://sonniss.com/gameaudiogdc |

# Chapter 01 — visual quality audit (daylight)

Date: 2026-11-24. Lighting: overcast late afternoon after rain (the new default; the stormy night is kept as
`?weather=storm`). Screenshots of the six review views are in [`visual-review/`](visual-review/).

| # | View | File |
|---|------|------|
| 1 | Cottage (house A) entrance | `01-cottage-entrance.jpg` |
| 2 | Muddy pathway | `02-muddy-pathway.jpg` |
| 3 | Forest boundary | `03-forest-boundary.jpg` |
| 4 | Sungka shelter and motorbike (the tricycle was removed earlier at your request) | `04-sungka-motorbike-area.jpg` |
| 5 | Photograph corner inside house A (there is no photo collage yet; the photograph sits on the cabinet) | `05-photograph-corner.jpg` |
| 6 | Wide overview | `06-wide-overview.jpg` |

## What changed in this pass

- **Lighting.** New sky: Poly Haven *Citrus Orchard Road (Pure Sky)*, CC0. It's mostly overcast with blue openings and
  a soft warm glow low in the west. The sun's compass direction is measured from that glow in the HDRI; its height is
  raised to 18° for late-afternoon shadows. Soft, light-grey distance haze (half the previous density); drifting
  cloud shadows; no rain; ground still wet.
- **Tone mapping.** AgX flattened this bright overcast scene into a milky, low-contrast band (measured by rendering
  the same view with and without it). Daylight now uses the Khronos PBR Neutral tone mapper, which keeps material
  colours faithful, with a restrained grade (contrast 1.06, saturation 0.92, bloom 0.1 above 1.0).
- **Wet surfaces.** The sheen bottoms out at roughness 0.55 (was 0.42): soaked earth and wood stay matte instead of
  mirroring the bright horizon (the "snow" look).
- **Puddles.** They used to be noise patches. Now they form in real depressions: at load, the terrain height is
  sampled on a 256² grid over the village and road (65k BVH rays, ~120 ms), and each point is compared with its
  ~1.2 m surroundings. Water stands in shallow ruts on compacted mud (from 2.4 cm) and only in deeper hollows on grass
  (9 cm). The surface is flattened to face up, so it reflects the sky as still water. It's slightly rough rather than
  a mirror, and a darker band of soaked earth rings each puddle.
- **Distant banana impostors.** They read pale, because the cards were lit as if they faced straight up. Their
  normals now lean outwards and up like a rounded crown, the lower part is shaded, and they reflect less sky, so they
  now match the 3D plants.

## Asset classification

A = low-poly geometry · B = low-resolution textures · C = material configuration · D = composition

| Asset | Source | Problems | Verdict |
|---|---|---|---|
| House A (cottage) walls, roof, door, window | Box-modelled in our Blender build (walls 30 triangles, door 12) | **A**: flat walls with no thickness, trim, base course or eaves detail; door and window are flat boards. **B/C**: the plaster texture repeats visibly indoors; the door's peeling-paint material reads as tree bark. | **Complete replacement** (preferred) with a detailed Filipino house, or a geometry rebuild with real wall thickness, trims and a proper door. This is the weakest asset in daylight. |
| Painted cabinet (photograph corner) | Box-modelled (80 triangles) | **A**: a plain white box. | **Replace** with a detailed cabinet model. |
| Sungka shelter | Box-modelled timbers and roof planes | **A**: flat roof planes without thickness or corrugation. | **Geometry improvement**: corrugated roof sheets, thicker posts with bracing. |
| Sungka board | Our model (7.3k triangles) | Acceptable at viewing distance. | No change. |
| Wooden fences | Box-modelled from the `rough_timber` material | Acceptable silhouette at walking distance; good material. | No change (optional: random lean and gaps). |
| Poly Haven props (stones, boulders, electricity poles, barrels, crates, jerrycans, pots, tyre, stove, planters, potted plants, tree stump) | Poly Haven, CC0 | None: real scans/PBR at 1K–2K. | **No change.** |
| Shop house, iron shanty, wooden shanty | Sketchfab, yadrogames, CC-BY | **B**: 1K textures (compressed by us); fine at mid distance, soft up close. Grounding fixed earlier. | **No change for now**; re-export at 2K if visitors get close. |
| Motorbike | Sketchfab, cansuaydin, CC-BY | None. | No change. |
| Portal gate | Sketchfab, soidev, CC-BY | Stylised on purpose; 1K textures. | No change. |
| Banana plant (near, 3D) | Sketchfab, evolveduk, CC-BY | **B**: the pseudostem texture is blurry up close. Leaves are acceptable. | **Texture replacement** for the stem, or a higher-quality banana model. |
| Banana forest (hills) | The same model ×thousands | **D**: one species and one model repeated: a uniform wall at the forest edge. | **Composition**: mix species and add an understorey (see the decision below). |
| Carabao grass | Ours (approved) | None. | No change (preserved as you asked). |
| Terrain | Poly Haven ground textures, splat-mapped | **C/D**: mud reads grey-beige; one texture set per layer at a single scale, with visible repetition on the open road. | **Material improvement**: darker wet mud, a second detail scale, gravel and exposed-earth variation. |

## Decision needed: what replaces the banana forest

The brief asks to replace the banana plants with pine, oak, birch and deciduous trees. That conflicts with the
brief's own goal ("an authentic Filipino rural countryside") and with your earlier requests for a banana forest. Oak
and birch don't grow in the Philippine lowlands; pines only in the Cordillera highlands. Two directions:

1. **Tropical Filipino mix (recommended)**: keep bananas near the houses and road, and mix in what actually grows
   there: coconut palms, mango and acacia (*Samanea saman*) as large hero trees, bamboo clumps, ferns, taro and
   understorey shrubs.
2. **The brief's temperate list**: pine, oak, birch and deciduous trees, as written.

## Not done yet

- House A replacement or rebuild, cabinet, sungka shelter roof.
- Vegetation replacement (waiting on the decision above).
- Terrain material upgrade (darker wet mud, detail scale, gravel and exposed earth).
- Puddles reflect the sky only, not nearby houses and trees; that would need screen-space reflections (a further
  post-processing cost).
- KTX2 texture compression (still needs your OK for the KTX-Software download).

---

# Stage 1 — House A, forest, terrain (2026-11-24)

Lighting is now **dusk after rain, 5:50 PM** (Poly Haven *Belfast Sunset Pure Sky*); the late afternoon is kept as
`?weather=afternoon` and the stormy night as `?weather=storm`. Review screenshots from the same six viewpoints are in
[`visual-review/stage1/`](visual-review/stage1/). The originals are in [`visual-review/`](visual-review/).

**House A** (`src/chapters/survival/houseA.ts`) was rebuilt on its exact footprint (6 × 4.5 m, the same door hinge,
openings, roof, interior, spawn and colliders) as a provincial Filipino house:
- a plastered hollow-block lower course with a concrete ledge, and overlapping timber lap boards above;
- timber corner posts, fascia and barge boards, and gables that follow the existing corrugated-iron roof;
- framed windows with projecting sills and green louvred shutters swung open;
- a panelled blue-grey door (stiles, rails, recessed panels, handle) on the original hinge.

It totals about 3.7k triangles, merged into 6 draw calls. It reuses the chapter's own textures, UV-mapped in metres.
The old wall slabs stay in the file, hidden, so their materials survive the build.

**Forest** (`Flora.tsx`, planting in `scatter.ts`): a tropical Filipino mix in natural zones replaces the single banana
model on a grid.

| Species | Source | Triangles (3D) | Planted | Full-3D range |
|---|---|---|---|---|
| Coconut palm | evolveduk, CC-BY | 6.6k | 635 | 30 m |
| Mango | stealth86, CC-BY (simplified) | 88k | 46 | 18 m |
| Rain tree | Poly Haven Island Tree 02, CC0 (canopy thinned 715k → 215k) | 255k | 14 | 22 m |
| Bamboo clump | JonhGillessen, CC-BY | 1.1k | 138 | 24 m |
| Taro / elephant ear / fern | CC-BY / CC-BY / CC0 | 1.3k / 1.5k / 6.2k | ~1,400 | 14 m |
| Banana | evolveduk, CC-BY | 2.5–4.3k | by houses, gardens, path edges, wild clumps | 18 m |

Every species is drawn as an impostor card beyond its full-3D range. Spacing rules keep hero trees apart (rain trees
22 m, mango 13 m), with clearances from buildings and the walk.

**Terrain** (`terrainMaterial.ts`, `weather.ts`):
- each layer is sampled at two scales and rotations, so there's no visible tiling;
- height-blended transitions between grass, mud and laterite;
- Poly Haven brown_mud_02 wet patches on the road;
- two tyre ruts along the road's centreline;
- stony laterite verges at the road's shoulders;
- softened drip lines under roofs;
- puddles collect in measured hollows.

**Measured cost:** 317–354 draw calls and 4.8–5.5 M triangles per frame across the review views (before Stage 1:
200–310 calls, 3.9–4.6 M). This is roughly 20% more, for a far denser and more varied forest. Frame time on target
hardware was not measured; the browser pane was hidden.

**Known issues after Stage 1:**
- From high viewpoints a near tree can look soft and pale: probably depth-of-field blur, not yet confirmed.
- Small bright specks in distant canopies, where the sky shows through.
- The mango and rain-tree 3D models are heavy: if frame rate suffers, their full-3D ranges are the first to shorten.
- The cabinet is still a plain box (Stage 2).

**Stage 2 (next):** Filipino tricycle, improved sungka shelter and surroundings, photo wall with replaceable frames on
the existing E interaction.

## Quality pass after Stage 1 (sharpness, pop-in)

Screenshots: [`visual-review/stage1-quality/`](visual-review/stage1-quality/).

- **Pop-in removed.** Trees and plants no longer swap instantly between their impostor card and the full model.
  Across a 3.5 m band both are drawn with complementary dithering (`rendering/fade.ts`), re-selected every metre.
  Every plant is always drawn as one or the other.
- **Ground cover:**
  - full density to 22 m, then a smooth falloff to 20% at 55 m (larger plants 120 m; before: 16 m, then one in three
    to 45 m, then nothing);
  - each plant has a stable random threshold and grows in from nothing near it;
  - re-selected every 1.5 m instead of every 4 m.
- **Texture resolution:**
  - props back to their 1K source (were 512);
  - roughness/AO maps at 1K (were 512);
  - terrain layers at 2K (were 1K);
  - plants and houses at up to 2K where the source allows;
  - the banana model used at forest edges at 60% detail with 1K textures (was 30% and 512);
  - impostor cards rendered at 1024 (were 512).
- **Filtering:** maximum anisotropic filtering (16×) on every texture once the world has loaded; before, most had none
  and smeared at grazing angles.
- **Image:** High renders at the screen's pixel density (up to 2×; was capped at 1.5×). Adaptive resolution now steps
  down gently and never below 1× (it used to drop to 0.85×). 4× MSAA (was 2×). Depth of field much gentler (bokeh
  0.4, wide focus range).
- **Robustness:** frame time is clamped to be non-negative everywhere. A clock jump could make the camera's field of
  view NaN and render black.

**Measured cost:** 319–360 draw calls and about 7.3 M triangles per frame at the review views (after Stage 1: about
5 M). Most of it is ground cover. The download for the chapter is 89 MB (about 70 MB before). Frame rate on target
hardware still needs measuring on a real machine.

## House A, architectural replacement (2026-11-24)

Screenshots: [`visual-review/houseA/`](visual-review/houseA/): the original and the replacement from the same camera and
lighting, a front close-up, the corner with the roof and gable, and the interior roof structure.

**What was there.** In the world model, House A was about 45 pieces:
- 18 flat wall slabs (12 triangles each), two gables and a band;
- a single-slope corrugated sheet roof (10 sheets plus 2 patch sheets) on 5 rafters and 4 purlins;
- a flat door board.

**What replaces it** (`src/chapters/survival/houseA.ts`): about 660 individual pieces, generated at load and merged per
material. The old walls, roof, rafters, purlins and plates are kept in the file as separate named meshes and hidden at
runtime, so the floor, interior, door hinge and colliders are untouched.

- **Roof:** a 35° gable with 0.8 m eaves and 0.5 m gable overhangs:
  - rafters every 0.6 m and purlins every 0.55 m;
  - four tie beams and a ridge beam;
  - seven overlapping thatch courses, cut into strips of random length and tilt (ragged edges);
  - a sagging ridge roll and a rusty corrugated patch where the thatch was mended.
- **Frame:** timber posts at the corners, beside every opening and mid-span; a girt at 0.95 m, a wall plate at 2.7 m,
  king posts in the gables.
- **Walls:** a plastered hollow-block lower course (painted aqua on the front) and woven bamboo (sawali) panels above,
  set back between the posts. The gables are filled with bamboo up to the roof line.
- **Foundation:** a concrete plinth proud of the walls, with a concrete pad under every post.
- **Openings:**
  - deep timber frames, with sloped sills on the windows and a concrete threshold at the door;
  - louvred painted shutters on hinges, each at its own angle (one sags);
  - a corrugated "media agua" awning on brackets over each window;
  - a panelled door with stiles, rails, raised panels, strap hinges and a handle on both faces.

**Numbers:**

| | |
|---|---|
| Triangles | shell 7,668 (9 meshes) + door 276 (2 meshes) = about 7.9k, 11 draw calls |
| Old house, for comparison | about 13k triangles, most of them the corrugation in the 12 roof sheets |
| Textures (Poly Haven, CC0, WebP) | thatch, bamboo and timber at 2048² (colour and normal) with 1024² roughness; hollow block, concrete, corrugated iron and painted wood at 1024²; the aqua plaster reuses the chapter's 2048² texture |
| Download | 8.0 MB of textures; the geometry is generated in code (no model file) |
| GPU memory | about 200 MB for these textures as uncompressed RGBA with mipmaps. KTX2 compression would cut this several times (it still needs your OK for the KTX-Software download) |

**Checks:**
- **Same footprint:** 6 × 4.5 m, floor 0.12 m, door hinge (0.6, 0.12, 2.25), all window openings, spawn point.
- **Collision unchanged:** the wall colliders are the original layout boxes.
- **Scroll path:** stepped from waking up to past the yard gate, the ground height stayed steady; the new eaves end at
  z = 3.05, before the first path point outside the door.
- **Door:** opens by itself on the scroll path (yaw −1.75), the new door swings with the hinge group, and the E
  prompt still appears.
- **Lighting and weather:** the new materials take the dusk lighting, weather and wetness; the new roof is part of
  the shelter map, so the interior stays dry under rain.

**Follow-ups (2026-11-24):**
- The shutters are now weathered natural timber instead of green paint.
- The stormy night is the default weather again. Dusk is `?weather=dusk` and the late afternoon `?weather=afternoon`.
- In the rain the thatch darkens but stays matte; with the usual wet sheen it read as slate tiles.

## Streetlights, dog and cat (2026-11-24)

- **Streetlights** (`Streetlights.tsx`, spots chosen in `scatter.ts`): 9 new barangay-style lamps along the walk,
  every 7 m on alternating sides, 2.6–3.4 m from the path centre, clear of the existing poles, buildings and plants.
  - Each is a tapered concrete pole, a steel arm and brace, and a lamp head with a warm sodium lens and a soft halo.
  - Instanced: 6 draw calls for all of them. Each pole has a collider.
  - A pool of 6 real point lights follows the visitor to the nearest of the 14 light sources (the 9 new lamps plus
    the gate pole, the shelter bulb and the road poles), fading out before each handover. Total point lights in the
    scene: 15 (14 before).
- **Dog** (`Animals.tsx`): a tan Labrador (I-I-love-my-dog-Dixie, CC-BY) lying in the dry under House A's front eave,
  left of the door. It cycles through four resting clips (lying, shifting, settling, dozing) with crossfades.
  38k triangles, 2.1 MB (was 48 MB with all 107 clips).
- **Cat:** a black cat (Evil_Katz, CC-BY) grooming on the sungka shelter's bench, placed by probing the bench's real
  surface. 7.4k triangles, 0.5 MB.
- **Measured:** 247–365 draw calls and 6.3–7.1 M triangles per frame at the review views (about the same as before).

## Interactive objects, guiding trail, aged plaster and lighting (2026-11-24)

All of these use the existing white-diamond indicator and the E key; no new indicator was added.
Screenshots: `docs/visual-review/interactions/`.

**Content and code:**
- Panel text lives in `src/data/chapter01.ts` and the photos in `src/data/photos.ts`. The panel component is
  `src/interface/InfoPanel.tsx`.
- To add your own photos, change the `src` paths in `photos.ts` and set `placeholder: false`.
  - The collage uses `collage-1…6-placeholder.jpg`.
  - K9's photo is `/assets/images/k9-photo-placeholder.jpg`.
- The placeholders are labelled images. No memories or photos were invented.

**Panels and controls:**
- One panel is open at a time.
- While it is open, movement and looking pause and the pointer is released.
- E, Continue, × or Esc closes it and returns control.

| # | Object | Panel | Notes |
|---|---|---|---|
| 1 | Oil lamp | "A Light That Never Went Out" | The flame light swells and a warm glow sprite blooms for about 9 s, then eases back. The panel sits at the side with no blur, so the lamp stays in view. |
| 2 | Photo wall | "Fragments of My Journey" | A new timber board on House A's east wall above the cabinet, with six framed photos. The gallery has previous/next, arrow keys and thumbnails, plus a title, date and description per photo. |
| 3 | K9 | "K9: A Loyal Companion" | Born 2020, with a replaceable photo slot. He lifts his head when greeted. He now lies in the front yard by the gate pole instead of by the door, where the open door hid him. |
| 4 | Cat | "Quiet Companionship" | Keeps its grooming loop. No name was invented. |
| 5 | Sungka | "A Game of Patience and Strategy" | A close-up rendered from the scene, plus a small animated board that sows shells around the pits. |
| 6 | Motorcycle | "The Road Forward" | A close-up rendered from the scene. |
| 7 | Portal | "Beyond the Beginning" | "Enter Chapter 02" opens the chapter-end panel. Walking into the portal no longer ends the chapter on its own. |

- In scroll mode, a slight glance chooses between the three objects at the sungka shelter. From rail s≈28:
  - glance left for the cat;
  - look straight ahead for the sungka;
  - glance right for the motorcycle.

**Guiding trail** (`Trail.tsx`):
- **Shape:** two loose lines of amber motes 5–11 cm above the ground. They follow the scroll path from the room past the photo wall, out of the door and gate, past the sungka shelter and down the road to the portal, so the trail never crosses a fence.
- **Motion:** slow pulses travel forward along it. It fades behind the visitor and into the distance, and is still with reduced motion.
- **Cost:** one draw call and no lights; bloom provides the glow.
- **Daylight:** the trail is brighter in daylight looks, scaled by the sky's environment intensity, because a faint glow disappears against bright mud.
- **Setting:** the pause menu has a "Guiding trail" On/Off option, saved with the other settings. Off fades the trail out.

**Green panel:**
- The aqua plaster on House A's front lower course is now weathered grey-green cement (Poly Haven "cracked concrete wall").
- A ragged band of dirt and rain splash reaches about 0.3–0.6 m up from the bottom.
- Geometry is unchanged.

**Lighting:**
- **New lights:**
  - A porch bulb under the eave by the door.
  - A hidden soft fill on the photo wall.
  - Both join the existing pool of 6 moving point lights, so the number of active lights is unchanged.
- **Night look:** a little more readable, with a stronger ambient and moonlight, lighter fog and slightly higher exposure. It is still the stormy night.
- **Thatch:** stays matte in the rain.

**Checks:**
- E opens every panel.
- The mode switches to `reading` and back to `playing` when the panel closes.
- `tsc` is clean.
- There are no console errors at night or in `?weather=afternoon`.

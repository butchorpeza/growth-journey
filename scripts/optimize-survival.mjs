// Chapter 01 · Survival — turns the Blender export (assets-src/survival/out, ~330 MB) into web assets.
// Usage: node scripts/optimize-survival.mjs [world|foliage|banana|ground]   (after scripts/blender/build_survival.py; no argument = all)
// Output: public/models/survival/{world.glb, foliage.glb, layout.json, ground/*.webp}
//
// world.glb
//   - scanned props simplified by meshoptimizer: rocks, stumps and clutter hard (they repeat dozens of times), any
//     other mesh above 8k vertices gently; never the terrain
//   - ~600 small meshes merged per material *within 24 m cells* (flatten, group by cell, join), so the renderer can
//     still skip cells outside the view and outside the shadow area. Nodes the game drives by name stay separate:
//     the door (A_door*), the photograph (A_photo*) and the terrain (splat shader in the game)
//   - textures: tiling building materials 2K, props 512, every ARM/roughness map 512, all WebP
//   - meshopt geometry compression (three.js ships the decoder)
// foliage.glb: one root node per plant variant (instanced in the game from layout.json); every plant mesh simplified,
//   textures 1K colour / 512 normal + ARM.
// ground/: the four terrain layers (mud, laterite, forest floor, grass) as 1K WebP colour + normal maps.
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, metalRough, meshopt, prune, simplifyPrimitive, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve('assets-src/survival/out');
const TEX = resolve('assets-src/survival/polyhaven/textures');
const OUT = resolve('public/models/survival');
mkdirSync(`${OUT}/ground`, { recursive: true });

await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const mb = (f) => (statSync(f).size / 1e6).toFixed(1) + ' MB';
const log = (...a) => console.log('·', ...a);
const only = process.argv[2];
let removedAreas = [[[-19.1, -0.3, 9.5], [-10.2, 5, 15.5]], [[11.2, -0.1, 9.3], [17.8, 3, 15.4]]];   // houses B, C (updated by the world pass)
const want = (part) => !only || only === part;

/** simplify primitives above `minVerts` (except names matching `skip`) to `ratio` within `error` (relative to the mesh size) */
function simplifyHeavy(doc, { minVerts, ratio, error, skip = /^$/, material = null, lockBorder = false }) {
  let n = 0, before = 0, after = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    if (skip.test(mesh.getName())) continue;
    for (const prim of mesh.listPrimitives()) {
      const c = prim.getAttribute('POSITION')?.getCount() ?? 0;
      if (c < minVerts) continue;
      if (material && !material.test(prim.getMaterial()?.getName() ?? '')) continue;
      simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error, lockBorder });
      before += c; after += prim.getAttribute('POSITION').getCount(); n++;
    }
  }
  log(`simplified ${n} primitives: ${before} -> ${after} vertices`);
}

/** Poly Haven plant scans keep their leaf cut-outs in a separate alpha map (assets-src/survival/polyhaven/alpha);
 *  the downloaded colour maps are JPG, so merge the alpha into each `<id>_diff_*` texture and make its material MASK */
const ALPHA = resolve('assets-src/survival/polyhaven/alpha');
async function applyAlphaMaps(doc) {
  let n = 0;
  for (const tex of doc.getRoot().listTextures()) {
    const id = tex.getName().match(/^(.+)_diff_\dk$/)?.[1];
    const file = id && `${ALPHA}/${id}_alpha_1k.jpg`;
    if (!file || !existsSync(file)) continue;
    const img = sharp(Buffer.from(tex.getImage()));
    const { width, height } = await img.metadata();
    const alpha = await sharp(file).resize(width, height).greyscale().raw().toBuffer();
    // two separate sharp passes: in one chain sharp applies removeAlpha() last, which would drop the joined alpha
    const rgb = await img.removeAlpha().png().toBuffer();
    const png = await sharp(rgb).joinChannel(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer();
    tex.setImage(new Uint8Array(png)).setMimeType('image/png');
    for (const mat of doc.getRoot().listMaterials()) {
      if (mat.getBaseColorTexture() === tex) { mat.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true); }
    }
    n++;
  }
  log(`alpha cut-outs merged into ${n} plant textures`);
}

/** WebP everything: ARM/roughness maps and pattern-matched textures at `small`, the rest at `large` */
async function compressTextures(doc, { large, small, smallPattern }) {
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [small, small], slots: /^(metallicRoughness|occlusion)/ }));
  if (smallPattern) await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [small, small], pattern: smallPattern }));
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [large, large] }));
}

// ---------------------------------------------------------------------------------------------------------------- world
if (want('world')) {
  const src = `${SRC}/survival-world.glb`, out = `${OUT}/world.glb`;
  const doc = await io.read(src);
  // houses B and C (box-modelled) are replaced by detailed Sketchfab houses in the game: drop them, and record
  // their footprints so the game also drops their colliders
  const removed = { B: [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]], C: [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]] };
  for (const node of doc.getRoot().listNodes()) {
    const k = node.getName().match(/^([BC])_/)?.[1];
    if (!k) continue;
    if (node.getMesh()) { const b = getBounds(node); for (let i = 0; i < 3; i++) { removed[k][0][i] = Math.min(removed[k][0][i], b.min[i]); removed[k][1][i] = Math.max(removed[k][1][i], b.max[i]); } }
    node.dispose();
  }
  removedAreas = Object.values(removed);
  log('removed houses B, C:', JSON.stringify(removedAreas.map((r) => r.map((v) => v.map((x) => +x.toFixed(1))))));
  await doc.transform(dedup(), weld());
  // scanned clutter repeats dozens of times across the map: simplify it hard (error is relative to each mesh's size)
  simplifyHeavy(doc, { minVerts: 1200, ratio: 0.22, error: 0.012, material: /^(boulder|rock_|stone_|tree_stump|dead_tree|plastic_crate|metal_jerrycan|metal_jug|can_rusted|cardboard|wicker|pot_enamel|plastic_bottle|watering_can|rusted_wheel|old_tyre|Barrel|hatchet|calathea|anthurium)/ });
  simplifyHeavy(doc, { minVerts: 3000, ratio: 0.4, error: 0.006, material: /electricity_poles/ });
  simplifyHeavy(doc, { minVerts: 8000, ratio: 0.5, error: 0.002, skip: /^terrain$/ });
  const KEEP = /^(A_door|A_photo|terrain)/;
  for (const node of doc.getRoot().listNodes()) {
    if (KEEP.test(node.getName())) continue;
    node.setName('');
    const mesh = node.getMesh(); if (mesh && !KEEP.test(mesh.getName())) mesh.setName('');
  }
  await doc.transform(flatten());
  // group every mesh node under a 24 m cell node (by the centre of its bounds), then join within each cell
  const CELL = 24, scene = doc.getRoot().listScenes()[0], cells = new Map();
  for (const node of scene.listChildren()) {
    if (!node.getMesh() || KEEP.test(node.getName())) continue;
    const { min, max } = getBounds(node);
    const key = `${Math.floor((min[0] + max[0]) / 2 / CELL)},${Math.floor((min[2] + max[2]) / 2 / CELL)}`;
    if (!cells.has(key)) { const c = doc.createNode(''); scene.addChild(c); cells.set(key, c); }
    scene.removeChild(node); cells.get(key).addChild(node);
  }
  log('cells:', cells.size);
  await doc.transform(join({ keepNamed: true }), prune());
  log('world meshes after join:', doc.getRoot().listMeshes().length, 'nodes:', doc.getRoot().listNodes().length);
  await applyAlphaMaps(doc);
  // tiling building surfaces fill the frame up close, so they keep 2K colour + normal; props and ARM maps 512
  await compressTextures(doc, { large: 2048, small: 512, smallPattern: /_1k/ });
  await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(out, doc);
  log(`world: ${mb(src)} -> ${mb(out)}`);
}

// -------------------------------------------------------------------------------------------------------------- foliage
if (want('foliage')) {
  const src = `${SRC}/survival-foliage.glb`, out = `${OUT}/foliage.glb`;
  const doc = await io.read(src);
  await doc.transform(dedup(), weld());
  // plants are alpha-tested leaf cards: lock the card borders (moving them stretches the leaf texture into jagged
  // triangles) and only remove interior vertices of the heavier plants
  simplifyHeavy(doc, { minVerts: 1000, ratio: 0.5, error: 0.004, lockBorder: true });
  await applyAlphaMaps(doc);
  await compressTextures(doc, { large: 1024, small: 512, smallPattern: /_nor_/ });
  await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(out, doc);
  log(`foliage: ${mb(src)} -> ${mb(out)}`);
}

// --------------------------------------------------------------------------------------------------------------- banana
// "Banana Plant" by evolveduk (Sketchfab, CC-BY 4.0 — credited in CREDITS.md): ~4.3k triangles, photo leaves with
// alpha cut-outs. banana.glb (full) for clumps near the houses, banana_lod.glb (~30%, leaf-card borders locked so
// the cut-outs keep their shape) for the groves on the hills.
if (want('banana')) {
  const src = resolve('assets-src/survival/sketchfab/banana_plant/banana_plant.glb');
  for (const [name, ratio, large] of [['banana', 1, 1024], ['banana_lod', 0.3, 512]]) {
    const doc = await io.read(src);
    await doc.transform(dedup(), weld());
    if (ratio < 1) simplifyHeavy(doc, { minVerts: 100, ratio, error: 0.02, lockBorder: true });
    await compressTextures(doc, { large, small: 512, smallPattern: /nor|normal/i });
    await doc.transform(flatten(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(`${OUT}/${name}.glb`, doc);
    log(`${name}: ${mb(`${OUT}/${name}.glb`)}`);
  }
}

// --------------------------------------------------------------------------------------------------------------- houses
// detailed weathered houses by yadrogames (Sketchfab, CC-BY 4.0 — credited in CREDITS.md) replacing houses B and C
// and lining the road. Their own ground planes are dropped; textures 1K WebP; meshopt.
if (want('houses')) {
  mkdirSync(`${OUT}/houses`, { recursive: true });
  const SK = resolve('assets-src/survival/sketchfab');
  for (const [name, file] of [['shop', 'shop_house/abandoned_shop_house.glb'], ['wooden', 'wooden_shanty/wooden_shanty.glb'], ['iron', 'iron_shanty/iron_shanty.glb']]) {
    const doc = await io.read(`${SK}/${file}`);
    for (const node of doc.getRoot().listNodes()) if (/Ground/i.test(node.getName())) node.dispose();
    // some models use the old specular-glossiness workflow (three.js no longer reads it: they render white)
    await doc.transform(metalRough(), dedup(), weld(), prune());
    await compressTextures(doc, { large: 1024, small: 512 });
    await doc.transform(flatten(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(`${OUT}/houses/${name}.glb`, doc);
    log(`house ${name}: ${mb(`${OUT}/houses/${name}.glb`)}`);
  }
}

// --------------------------------------------------------------------------------------------------------------- vehicles
// a Filipino tricycle (kotris666), a rusty motorbike (cansuaydin), a jeepney (maclinmacalindong) and the stone portal
// frame at the end of the road (soidev), all Sketchfab CC-BY 4.0, credited in CREDITS.md. Kept at full detail (they are seen up close); wireframe LINES primitives and
// ground planes dropped; textures 1K WebP; meshopt.
if (want('vehicles')) {
  mkdirSync(`${OUT}/vehicles`, { recursive: true });
  const SK = resolve('assets-src/survival/sketchfab');
  for (const [name, file] of [['tricycle', 'tricycle/gltf/scene.gltf'], ['motorbike', 'motorbike/rusty_motorbike.glb'], ['jeepney', 'jeepney/jeepney.glb'], ['portal_frame', 'portal_frame/portal_frame.glb']]) {
    const doc = await io.read(`${SK}/${file}`);
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();   // 4 = TRIANGLES
    for (const node of doc.getRoot().listNodes()) if (/Ground|Plane|Floor/i.test(node.getName())) node.dispose();
    await doc.transform(metalRough(), dedup(), weld(), prune());
    await compressTextures(doc, { large: 1024, small: 512 });
    await doc.transform(flatten(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(`${OUT}/vehicles/${name}.glb`, doc);
    log(`vehicle ${name}: ${mb(`${OUT}/vehicles/${name}.glb`)}`);
  }
}

// --------------------------------------------------------------------------------------------------------------- ground
// splat channels from build_survival.py: R = mud (road), G = laterite soil (yards), B = forest floor, rest = grass
if (want('ground')) {
const GROUND = { mud: 'muddy_tracks', soil: 'red_laterite_soil_stones', forest: 'forest_ground_04', grass: 'grass_ground' };
for (const [layer, id] of Object.entries(GROUND)) {
  for (const [map, suffix] of [['diff', 'diff_2k.jpg'], ['nor', 'nor_gl_2k.jpg']]) {
    const file = `${TEX}/${id}/textures/${id}_${suffix}`;
    await sharp(file).resize(1024, 1024).webp({ quality: map === 'nor' ? 88 : 82 }).toFile(`${OUT}/ground/${layer}_${map}.webp`);
  }
}
log('ground layers:', Object.entries(GROUND).map(([k, v]) => `${k}=${v}`).join(', '));
}

// layout: drop the colliders of the removed houses
{
  const layout = JSON.parse(readFileSync(`${SRC}/survival-layout.json`, 'utf8'));
  const inside = (p) => removedAreas.some(([mn, mx]) => p[0] > mn[0] - 0.3 && p[0] < mx[0] + 0.3 && p[2] > mn[2] - 0.3 && p[2] < mx[2] + 0.3);
  const before = layout.colliders.length;
  layout.colliders = layout.colliders.filter((c) => !inside(c.p));
  writeFileSync(`${OUT}/layout.json`, JSON.stringify(layout));
  log(`layout colliders: ${before} -> ${layout.colliders.length} (houses B, C removed)`);
}
log(`layout: ${mb(`${OUT}/layout.json`)}`);

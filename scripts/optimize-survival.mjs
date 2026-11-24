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
    const base = (tex.getURI() || '').split('/').pop().replace(/\.\w+$/, '');
    const id = tex.getName().match(/^(.+)_diff_\dk$/)?.[1] ?? base.match(/^(.+)_diff_\dk$/)?.[1];
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
  // house A's flat wall slabs, gables and band are rebuilt in the game (houseA.ts), which hides them; they are kept
  // as separate named meshes (a few triangles each) so their materials (aqua plaster, plank siding) stay in the file
  log('removed houses B, C:', JSON.stringify(removedAreas.map((r) => r.map((v) => v.map((x) => +x.toFixed(1))))));
  await doc.transform(dedup(), weld());
  // scanned clutter repeats dozens of times across the map: simplify it hard (error is relative to each mesh's size)
  simplifyHeavy(doc, { minVerts: 1200, ratio: 0.22, error: 0.012, material: /^(boulder|rock_|stone_|tree_stump|dead_tree|plastic_crate|metal_jerrycan|metal_jug|can_rusted|cardboard|wicker|pot_enamel|plastic_bottle|watering_can|rusted_wheel|old_tyre|Barrel|hatchet|calathea|anthurium)/ });
  simplifyHeavy(doc, { minVerts: 3000, ratio: 0.4, error: 0.006, material: /electricity_poles/ });
  simplifyHeavy(doc, { minVerts: 8000, ratio: 0.5, error: 0.002, skip: /^terrain$/ });
  const KEEP = /^(A_door|A_photo|A_wall|A_gable|A_band|A_roof|A_patch|A_rafter|A_purlin|A_plate|terrain)/;
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
  // tiling building surfaces fill the frame up close: 2K colour + normal; props at their 1K source; ARM maps 1K
  await compressTextures(doc, { large: 2048, small: 1024 });
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
  await compressTextures(doc, { large: 1024, small: 1024 });
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
  for (const [name, ratio, large] of [['banana', 1, 1024], ['banana_lod', 0.6, 1024]]) {
    const doc = await io.read(src);
    await doc.transform(dedup(), weld());
    if (ratio < 1) simplifyHeavy(doc, { minVerts: 100, ratio, error: 0.02, lockBorder: true });
    await compressTextures(doc, { large, small: 1024 });
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
    await compressTextures(doc, { large: 2048, small: 1024 });
    await doc.transform(flatten(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(`${OUT}/houses/${name}.glb`, doc);
    log(`house ${name}: ${mb(`${OUT}/houses/${name}.glb`)}`);
  }
}

// --------------------------------------------------------------------------------------------------------------- vehicles
// a rusty motorbike (cansuaydin) and the stone portal frame at the end of the road (soidev), both Sketchfab
// CC-BY 4.0, credited in CREDITS.md. Kept at full detail (they are seen up close); wireframe LINES primitives and
// ground planes dropped; textures 1K WebP; meshopt.
if (want('vehicles')) {
  mkdirSync(`${OUT}/vehicles`, { recursive: true });
  const SK = resolve('assets-src/survival/sketchfab');
  for (const [name, file] of [['motorbike', 'motorbike/rusty_motorbike.glb'], ['portal_frame', 'portal_frame/portal_frame.glb']]) {
    const doc = await io.read(`${SK}/${file}`);
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) prim.dispose();   // 4 = TRIANGLES
    for (const node of doc.getRoot().listNodes()) if (/Ground|Plane|Floor/i.test(node.getName())) node.dispose();
    await doc.transform(metalRough(), dedup(), weld(), prune());
    await compressTextures(doc, { large: 2048, small: 1024 });
    await doc.transform(flatten(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(`${OUT}/vehicles/${name}.glb`, doc);
    log(`vehicle ${name}: ${mb(`${OUT}/vehicles/${name}.glb`)}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------- flora
// the tropical forest mix (FLORA.md in docs/VISUAL_AUDIT.md): coconut palm (evolveduk), mango tree (stealth86), bamboo
// (JonhGillessen), taro (The_Structure_World), elephant ear (BAND_ANNA) — Sketchfab, CC-BY 4.0 — and Poly Haven's
// fern_02 and island_tree_02 (CC0; the rain tree). Leaves become alpha-tested (MASK), textures 1K WebP, meshopt.
/** thin a canopy of leaf cards: keep `keep` of the cards (connected pieces) and enlarge each kept card by `grow`
 *  about its own centre, so the crown keeps its coverage and silhouette with a fraction of the triangles */
function thinCards(prim, keep, grow, seed = 7) {
  const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), n = pos.getCount();
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const tri = idx.getCount();
  for (let t = 0; t < tri; t += 3) { const a = find(idx.getScalar(t)), b = find(idx.getScalar(t + 1)), c = find(idx.getScalar(t + 2)); parent[b] = a; parent[c] = a; }
  let r = seed; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const keepRoot = new Map(), centre = new Map(), count = new Map(), v = [0, 0, 0];
  for (let i = 0; i < n; i++) { const k = find(i); pos.getElement(i, v); const c = centre.get(k) ?? [0, 0, 0]; c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; centre.set(k, c); count.set(k, (count.get(k) ?? 0) + 1); }
  for (const k of centre.keys()) keepRoot.set(k, rnd() < keep);
  for (let i = 0; i < n; i++) { const k = find(i); if (!keepRoot.get(k)) continue; const c = centre.get(k), m = count.get(k); pos.getElement(i, v);
    pos.setElement(i, [c[0] / m + (v[0] - c[0] / m) * grow, c[1] / m + (v[1] - c[1] / m) * grow, c[2] / m + (v[2] - c[2] / m) * grow]); }
  const out = [];
  for (let t = 0; t < tri; t += 3) if (keepRoot.get(find(idx.getScalar(t)))) out.push(idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2));
  idx.setArray(n > 65535 ? new Uint32Array(out) : new Uint16Array(out));
  return { before: tri / 3, after: out.length / 3 };
}
if (want('flora')) {
  mkdirSync(`${OUT}/flora`, { recursive: true });
  const SK = resolve('assets-src/survival/sketchfab'), PH = resolve('assets-src/survival/polyhaven/models');
  const species = [
    ['coconut', `${SK}/coconut/coconut_palm.glb`],
    ['mango', `${SK}/mango/mango_tree.glb`],
    ['bamboo', `${SK}/bamboo_set/free_bamboo_set.glb`],
    ['taro', `${SK}/taro/taro.glb`],
    ['elephant', `${SK}/elephant/elephant_ear_plant.glb`],
    ['fern', `${PH}/fern_02/fern_02.gltf`],
    ['raintree', `${PH}/island_tree_02/island_tree_02.gltf`],
  ];
  for (const [name, file] of species) {
    const doc = await io.read(file);
    if (name === 'bamboo') {
      // the set lays out several clumps and single giant culms side by side: keep the one full 10 m clump (stems and
      // leaves around x = 30, z = 0)
      for (const node of doc.getRoot().listNodes()) {
        const mesh = node.getMesh(); if (!mesh) continue;
        const b = getBounds(node);
        if (b.min[0] < 26 || b.max[0] > 36 || b.min[2] < -8 || b.max[2] > 6 || b.max[1] > 12) node.dispose();
      }
    }
    await doc.transform(metalRough(), dedup(), weld(), prune());
    if (name === 'raintree') {
      for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
        const mat = prim.getMaterial()?.getName() ?? '';
        if (/leaves/.test(mat)) { const r = thinCards(prim, 0.3, 1.55); log(`raintree leaves: ${r.before} -> ${r.after} triangles`); }
        else simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0.12, error: 0.004 });
      }
    }
    if (name === 'mango') {
      simplifyHeavy(doc, { minVerts: 5000, ratio: 0.3, error: 0.004, material: /Material\.00[24]/ });     // trunk and branches
      simplifyHeavy(doc, { minVerts: 5000, ratio: 0.6, error: 0.006, material: /Material\.001/, lockBorder: true });   // leaf cards
    }
    await applyAlphaMaps(doc);
    // leaves: alpha-tested, double-sided (blended foliage sorts badly and costs more)
    for (const mat of doc.getRoot().listMaterials()) if (mat.getAlphaMode() === 'BLEND') mat.setAlphaMode('MASK').setAlphaCutoff(0.45).setDoubleSided(true);
    await compressTextures(doc, { large: 2048, small: 1024 });
    await doc.transform(flatten(), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(`${OUT}/flora/${name}.glb`, doc);
    let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    log(`flora ${name}: ${mb(`${OUT}/flora/${name}.glb`)}, ${Math.round(tris)} triangles`);
  }
}

// ---------------------------------------------------------------------------------------------------------------- house A
// textures for the rebuilt house A (houseA.ts), Poly Haven CC0: nipa/cogon thatch, woven bamboo (sawali), rough timber,
// plastered hollow block, worn concrete, rusty corrugated iron, painted weathered wood. Colour and normal at 2K for
// the large surfaces (thatch, bamboo, timber), 1K for the rest; roughness at 1K (from the ARM green channel, or the
// roughness map). WebP.
if (want('housea')) {
  mkdirSync(`${OUT}/housea`, { recursive: true });
  const SETS = { thatch: ['thatch_roof_angled', 2048], bamboo: ['bamboo_wall', 2048], timber: ['rough_wood', 2048], block: ['concrete_block_wall', 1024],
    concrete: ['worn_concrete_floor', 1024], iron: ['rusty_corrugated_iron', 1024], paint: ['wood_peeling_paint_weathered', 1024], aged: ['cracked_concrete_wall', 2048] };
  for (const [key, [id, size]] of Object.entries(SETS)) {
    const dir = `${TEX}/${id}/textures`;
    await sharp(`${dir}/${id}_diff_2k.jpg`).resize(size, size).webp({ quality: 86 }).toFile(`${OUT}/housea/${key}_diff.webp`);
    await sharp(`${dir}/${id}_nor_gl_2k.jpg`).resize(size, size).webp({ quality: 90 }).toFile(`${OUT}/housea/${key}_nor.webp`);
    const rough = existsSync(`${dir}/${id}_rough_2k.jpg`) ? sharp(`${dir}/${id}_rough_2k.jpg`).greyscale() : sharp(`${dir}/${id}_arm_2k.jpg`).extractChannel(1);
    await rough.resize(1024, 1024).webp({ quality: 86 }).toFile(`${OUT}/housea/${key}_rough.webp`);
  }
  log('house A textures:', Object.keys(SETS).join(', '));
}

// -------------------------------------------------------------------------------------------------------------- animals
// a dog and a cat: "Labrador dog" by I-I-love-my-dog-Dixie and "An Animated Cat" by Evil_Katz (Sketchfab, CC-BY 4.0,
// credited in CREDITS.md). The dog's 107 clips are cut to the four lying-down loops it uses; textures 1K WebP. Skinned
// meshes keep their hierarchy (no flatten); meshopt compresses the geometry and the animation keys.
if (want('animals')) {
  mkdirSync(`${OUT}/animals`, { recursive: true });
  const SK = resolve('assets-src/survival/sketchfab');
  const KEEP_CLIPS = { dog: /labrador_(idle_lay_one_off_0[12]|interact_bed_(lay|sleep)_exist_01)$/, cat: /./ };
  for (const [name, file] of [['dog', 'dog/labrador.glb'], ['cat', 'cat/cat.glb']]) {
    const doc = await io.read(`${SK}/${file}`);
    for (const a of doc.getRoot().listAnimations()) {
      if (KEEP_CLIPS[name].test(a.getName())) continue;
      // free the clip's keyframe data too (disposing the clip alone leaves its accessors behind)
      for (const smp of a.listSamplers()) { const i = smp.getInput(), o = smp.getOutput(); smp.dispose(); if (i && !i.listParents().some((x) => x.propertyType === 'AnimationSampler')) i.dispose(); if (o && !o.listParents().some((x) => x.propertyType === 'AnimationSampler')) o.dispose(); }
      for (const ch of a.listChannels()) ch.dispose();
      a.dispose();
    }
    await doc.transform(metalRough(), dedup(), prune());
    await compressTextures(doc, { large: 1024, small: 1024 });
    await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await io.write(`${OUT}/animals/${name}.glb`, doc);
    log(`animal ${name}: ${mb(`${OUT}/animals/${name}.glb`)}, clips: ${doc.getRoot().listAnimations().map((a) => a.getName().replace(/^.*\|/, '')).join(', ')}`);
  }
}

// --------------------------------------------------------------------------------------------------------------- ground
// splat channels from build_survival.py: R = mud (road), G = laterite soil (yards), B = forest floor, rest = grass
if (want('ground')) {
const GROUND = { mud: 'muddy_tracks', soil: 'red_laterite_soil_stones', forest: 'forest_ground_04', grass: 'grass_ground', wetmud: 'brown_mud_02' };
for (const [layer, id] of Object.entries(GROUND)) {
  for (const [map, suffix] of [['diff', 'diff_2k.jpg'], ['nor', 'nor_gl_2k.jpg']]) {
    const file = `${TEX}/${id}/textures/${id}_${suffix}`;
    await sharp(file).resize(2048, 2048).webp({ quality: map === 'nor' ? 88 : 84 }).toFile(`${OUT}/ground/${layer}_${map}.webp`);
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

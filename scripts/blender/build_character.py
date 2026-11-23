"""Builds the player character with MPFB2 (MakeHuman for Blender) and exports a GLB for the browser.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/blender/build_character.py -- \
      --packs assets-src/character/packs --out assets-src/character/out --outfit survival

Everything used here is CC0 (MPFB core + system assets, shirts01/pants01/shoes01/suits01) except Hair 02 (CC-BY,
credited in CREDITS.md). The rig is MPFB's "mixamo" rig, so Mixamo animation clips bind by bone name.
"""
import argparse, glob, json, math, os, sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--packs", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--outfit", default="survival")
ap.add_argument("--render", action="store_true")
ap.add_argument("--clothes", default="", help="comma-separated clothes folder names, overrides the outfit preset")
ap.add_argument("--hair", default="short02")
ap.add_argument("--skin", default="young_asian_male")
ap.add_argument("--eyebrows", default="eyebrow006")
ap.add_argument("--hdri", default="assets-src/survival/polyhaven/hdris/farmland_overcast/farmland_overcast_2k.hdr")
ap.add_argument("--list", action="store_true", help="only list installed assets")
args = ap.parse_args(argv)
os.makedirs(args.out, exist_ok=True)

from bl_ext.blender_org.mpfb.services.assetservice import AssetService
from bl_ext.blender_org.mpfb.services.humanservice import HumanService
from bl_ext.blender_org.mpfb.services.locationservice import LocationService
from bl_ext.blender_org.mpfb.services.targetservice import TargetService

log = lambda *a: print("@@", *a, flush=True)

# ---------- 1. install asset packs into MPFB's user data folder (idempotent) ----------
user_data = LocationService.get_user_data()
for z in sorted(glob.glob(os.path.join(args.packs, "*.zip"))):
    marker = os.path.join(user_data, "packs", os.path.basename(z).replace("_cc0.zip", ".json").replace("_ccby.zip", ".json"))
    if os.path.exists(marker):
        continue
    err = AssetService.check_asset_pack_zip(z) or AssetService.fix_and_extract_asset_pack_zip(z, user_data)
    log("installed pack", os.path.basename(z), "error:" if err else "ok", err or "")
AssetService.rescan_pack_metadata() if hasattr(AssetService, "rescan_pack_metadata") else None
for attr in ("update_all_asset_lists", "update_asset_list"):
    if hasattr(AssetService, attr):
        try:
            getattr(AssetService, attr)() if attr == "update_all_asset_lists" else None
        except Exception as e:  # noqa
            log("rescan warn", e)


def find(pattern):
    hits = sorted(glob.glob(os.path.join(user_data, "**", pattern), recursive=True))
    return hits


if args.list:
    for kind in ("skins", "eyes", "eyebrows", "eyelashes", "teeth", "tongue", "hair", "clothes"):
        files = find(f"{kind}/**/*.mh*")
        log(kind, len(files), [os.path.relpath(f, user_data) for f in files][:80])
    sys.exit(0)

# ---------- 2. clean scene ----------
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------- 3. body: adult man, realistic proportions ----------
macros = TargetService.get_default_macro_info_dict()
macros.update({"gender": 1.0, "age": 0.6, "muscle": 0.62, "weight": 0.55, "proportions": 0.72, "height": 0.55,
               "race": {"asian": 0.72, "caucasian": 0.2, "african": 0.08}})
# detailed_helpers: without MPFB's per-joint helper groups the rig can't find the arm/hand joints on the mesh and
# falls back to its T-pose bone positions — the arms then pivot around the wrong points (twisted, stretched arms).
basemesh = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True,
                                     feet_on_ground=True, scale=0.1, macro_detail_dict=macros)
basemesh.name = "Body"
log("body verts", len(basemesh.data.vertices))

# ---------- 4. rig first, so everything added later is skinned to it ----------
rig = HumanService.add_builtin_rig(basemesh, "mixamo", import_weights=True)
rig = rig or next(o for o in bpy.data.objects if o.type == "ARMATURE")
rig.name = "Armature"
log("rig bones", len(rig.data.bones))

# ---------- 5. skin, eyes, face parts ----------
def first(*patterns):
    for p in patterns:
        hits = find(p)
        if hits:
            return hits[0]
    return None

skin = first(f"skins/{args.skin}/*.mhmat")
log("skin", skin)
if skin:
    HumanService.set_character_skin(skin, basemesh, skin_type="GAMEENGINE", material_instances=False)

def add(kind, path, asset_type):
    if not path:
        log("missing", kind); return None
    obj = HumanService.add_mhclo_asset(path, basemesh, asset_type=asset_type, subdiv_levels=0, material_type="MAKESKIN")
    log("added", kind, os.path.relpath(path, user_data))
    return obj

add("eyes", first("eyes/high-poly/*.mhclo"), "Eyes")
add("eyebrows", first(f"eyebrows/{args.eyebrows}/*.mhclo"), "Eyebrows")
add("eyelashes", first("eyelashes/*eyelashes01*/*.mhclo", "eyelashes/**/*.mhclo"), "Eyelashes")
add("teeth", first("teeth/teeth_base/*.mhclo"), "Teeth")
add("tongue", first("tongue/**/*.mhclo"), "Tongue")

# ---------- 6. hair + outfit ----------
OUTFITS = {
    # chapter 01: worn, practical  ·  chapter 04: contemporary professional
    "survival": ["male_casualsuit01", "shoes06"],
    "new-era": ["male_elegantsuit01", "shoes02"],
}
add("hair", first(f"hair/{args.hair}/*.mhclo"), "Hair")
for name in ([c for c in args.clothes.split(",") if c] or OUTFITS.get(args.outfit, OUTFITS["survival"])):
    add("clothes " + name, first(f"clothes/{name}/*.mhclo"), "Clothes")

# ---------- 6b. glTF-ready materials ----------
# MakeHuman 1.x coloured its shared light skin texture with a "litsphere"; glTF can't carry that, so each material
# becomes: image -> Multiply(tint) -> Principled Base Color. Blender's glTF exporter writes the tint as
# baseColorFactor. Alpha-tested cards (hair, brows, lashes) get their image alpha wired to Alpha.
TINTS = {  # linear RGB multipliers, matched against the part after "Body." in the material name
    "body": (0.60, 0.40, 0.27), "short": (0.07, 0.055, 0.045), "eyebrow": (0.12, 0.09, 0.07), "eyelash": (0.06, 0.05, 0.045),
}
ALPHA = ("short", "eyebrow", "eyelash", "hair")

def tidy_material(mat):
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    img = next((n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image and "normal" not in n.image.name.lower() and "_ao" not in n.image.name.lower()), None)
    if not bsdf or not img:
        return
    for l in list(bsdf.inputs["Base Color"].links):
        nt.links.remove(l)
    part = mat.name.split(".", 1)[-1].lower()          # "Body.short02" -> "short02"
    key = next((k for k in TINTS if part.startswith(k)), None)
    if key:
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs[7].default_value = (*TINTS[key], 1.0)           # B (colour) input of the RGBA mix
        nt.links.new(img.outputs["Color"], mix.inputs[6])          # A
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])    # Result (RGBA)
    else:
        nt.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
    if any(part.startswith(a) for a in ALPHA):
        nt.links.new(img.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.52 if part == "body" else 0.85
    log("material", mat.name, "tint", key)

for m in bpy.data.materials:
    if m.use_nodes:
        tidy_material(m)

# ---------- 7. report + optional preview render ----------
tris = 0
for o in bpy.data.objects:
    if o.type == "MESH":
        n = sum(len(p.vertices) - 2 for p in o.data.polygons)
        tris += n
        log("mesh", o.name, "tris", n, "mats", [m.name for m in o.data.materials if m])
log("total tris", tris, "height m", round(max((rig.matrix_world @ b.tail_local).z for b in rig.data.bones), 3))

if args.render:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = 900, 1200
    world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
    scene.view_settings.view_transform = "AgX"
    if os.path.exists(args.hdri):
        env = world.node_tree.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(os.path.abspath(args.hdri))
        world.node_tree.links.new(env.outputs["Color"], world.node_tree.nodes["Background"].inputs[0])
        world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    else:
        world.node_tree.nodes["Background"].inputs[0].default_value = (0.32, 0.34, 0.37, 1)
    def light(name, loc, energy, size=3):
        d = bpy.data.lights.new(name, "AREA"); d.energy = energy; d.size = size
        o = bpy.data.objects.new(name, d); o.location = loc; scene.collection.objects.link(o)
        o.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    light("key", (2.2, -2.6, 2.6), 350); light("rim", (0.5, 2.8, 2.4), 250)
    cam_d = bpy.data.cameras.new("cam"); cam_d.lens = 70
    cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
    for tag, loc, tgt in (("front", (0.4, -5.2, 1.05), (0, 0, 0.95)), ("face", (0.25, -1.6, 1.62), (0, 0, 1.58))):
        cam.location = loc
        cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(args.out, f"preview-{args.outfit}-{tag}.png")
        bpy.ops.render.render(write_still=True)
        log("rendered", scene.render.filepath)

# ---------- 8. export GLB (modifiers applied: helper masks, armature) ----------
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(args.out, f"character-{args.outfit}.blend"))
for o in bpy.data.objects:
    o.select_set(o.type in ("MESH", "ARMATURE"))
out = os.path.join(args.out, f"character-{args.outfit}.glb")
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_apply=True,
                          export_animations=False, export_skins=True, export_yup=True,
                          export_image_format="JPEG", export_jpeg_quality=88)
log("exported", out, round(os.path.getsize(out) / 1e6, 2), "MB")

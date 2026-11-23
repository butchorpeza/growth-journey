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
macros.update({"gender": 1.0, "age": 0.52, "muscle": 0.58, "weight": 0.48, "proportions": 0.62, "height": 0.56,
               "race": {"asian": 0.72, "caucasian": 0.2, "african": 0.08}})
basemesh = HumanService.create_human(mask_helpers=True, detailed_helpers=False, extra_vertex_groups=True,
                                     feet_on_ground=True, scale=0.1, macro_detail_dict=macros)
basemesh.name = "Body"
log("body verts", len(basemesh.data.vertices))

# ---------- 4. rig first, so everything added later is skinned to it ----------
rig = HumanService.add_builtin_rig(basemesh, "standard.mixamo", import_weights=True)
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

skin = first("skins/*young*asian*male*/*.mhmat", "skins/*asian*male*/*.mhmat", "skins/*male*/*.mhmat", "skins/**/*.mhmat")
log("skin", skin)
if skin:
    HumanService.set_character_skin(skin, basemesh, skin_type="GAMEENGINE", material_instances=False)

def add(kind, path, asset_type):
    if not path:
        log("missing", kind); return None
    obj = HumanService.add_mhclo_asset(path, basemesh, asset_type=asset_type, subdiv_levels=0, material_type="MAKESKIN")
    log("added", kind, os.path.relpath(path, user_data))
    return obj

add("eyes", first("eyes/*brown*/*.mhclo", "eyes/**/*.mhclo"), "Eyes")
add("eyebrows", first("eyebrows/*eyebrow001*/*.mhclo", "eyebrows/**/*.mhclo"), "Eyebrows")
add("eyelashes", first("eyelashes/*eyelashes01*/*.mhclo", "eyelashes/**/*.mhclo"), "Eyelashes")
add("teeth", first("teeth/**/*.mhclo"), "Teeth")
add("tongue", first("tongue/**/*.mhclo"), "Tongue")

# ---------- 6. hair + outfit ----------
OUTFITS = {
    # chapter 01: worn, practical
    "survival": ["clothes/*shirt*/*.mhclo", "clothes/*pants*/*.mhclo", "clothes/*shoe*/*.mhclo"],
    # chapter 04: contemporary professional
    "new-era": ["clothes/*suit*/*.mhclo", "clothes/*shoe*/*.mhclo"],
}
hair = first("hair/*short*/*.mhclo", "hair/**/*.mhclo")
add("hair", hair, "Hair")
for pattern in OUTFITS.get(args.outfit, OUTFITS["survival"]):
    add("clothes " + pattern, first(pattern), "Clothes")

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
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.32, 0.34, 0.37, 1)
    def light(name, loc, energy, size=3):
        d = bpy.data.lights.new(name, "AREA"); d.energy = energy; d.size = size
        o = bpy.data.objects.new(name, d); o.location = loc; scene.collection.objects.link(o)
        o.rotation_euler = (Vector((0, 0, 1.0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    light("key", (2.2, -2.6, 2.6), 900); light("fill", (-2.6, -1.8, 1.6), 300); light("rim", (0.5, 2.8, 2.4), 500)
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

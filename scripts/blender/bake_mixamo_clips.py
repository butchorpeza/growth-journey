"""Bakes Mixamo clips onto the MPFB character and exports one GLB with every clip as its own action.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/blender/bake_mixamo_clips.py -- \
      --blend assets-src/character/out/character-survival.blend --clips assets-src/character/mixamo \
      --out assets-src/character/out/character-survival-anim.glb
then compress (see docs/ASSET_PIPELINE.md) into public/models/characters/player-survival.glb.

Source clips: Mixamo, downloaded on its standard "Y Bot" character ("Without Skin", FBX, 30 fps, "In Place" for
locomotion), one FBX per clip; the file stem becomes the action name (Walk.fbx -> "Walk").
(Uploading our own skeleton to Mixamo does not work: Mixamo assumes its own bone axes and the arms come out twisted.)

Retargeting, per clip:
  1. "aligned rest": pose our skeleton like the source's rest pose — each bone aimed along the source bone's rest
     direction (bone -> main child); hips, upper chest and hands also match a side axis (thighs, shoulders,
     index/pinky knuckles) so the twist is right.
  2. every frame, each bone takes the source bone's world rotation change from rest, applied to its aligned rest:
        world = source_pose · source_rest⁻¹ · aligned_rest
     so bone directions match the source exactly and twist comes through, while bone lengths stay the character's.
  3. hips height = source hips height × (our hip height / source hip height); horizontal travel removed (the
     character controller moves the body) unless --keep-travel. Airborne clips (--lock-height) keep standing hip
     height; --trim-contact clips start at the first ground contact; --ranges trims source frames.
Requires the rig to be fitted to the mesh (build_character.py uses MPFB's detailed joint helpers for that).
"""
import argparse, glob, os, re, sys

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--blend", required=True)
ap.add_argument("--clips", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--keep-travel", default="", help="comma-separated clip names that keep their horizontal hip travel")
ap.add_argument("--only", default="", help="comma-separated clip names to bake (default: all)")
ap.add_argument("--lock-height", default="JumpStart,Fall", help="clips whose hips stay at standing height (airborne: the controller moves the body)")
ap.add_argument("--trim-contact", default="Land", help="clips trimmed to start when the feet first touch the ground")
ap.add_argument("--rest-fingers", action="store_true", help="keep the character's rest finger pose instead of the clip's")
ap.add_argument("--ranges", default="Interact:15-200", help="per-clip source frame ranges, e.g. Interact:15-200,Idle:1-120")
ap.add_argument("--save-blend", default="", help="also save the baked scene as a .blend (for review renders)")
args = ap.parse_args(argv)
log = lambda *a: print("@@", *a, flush=True)

bpy.ops.wm.open_mainfile(filepath=os.path.abspath(args.blend))
scene = bpy.context.scene
scene.render.fps, scene.render.fps_base = 30, 1.0
ours = bpy.data.objects["Armature"]
ours.animation_data_create()
keep_travel = {c for c in args.keep_travel.split(",") if c}
only = {c for c in args.only.split(",") if c}
lock_height = {c for c in args.lock_height.split(",") if c}
trim_contact = {c for c in args.trim_contact.split(",") if c}
ranges = {k: tuple(int(x) for x in v.split("-")) for k, v in (r.split(":") for r in args.ranges.split(",") if r)}

P = "mixamorig:"
FINGER = re.compile(r"(Thumb|Index|Middle|Ring|Pinky)\d")
MAIN = re.compile(r"(Spine\d?|Neck|Head|HandMiddle1|Arm|ForeArm|Hand|UpLeg|Leg|Foot|ToeBase|\d)$")
# bone -> (up child, left child, right child): matched as a full frame, not just a direction
FRAMES = {
    P + "Hips": (P + "Spine", P + "LeftUpLeg", P + "RightUpLeg"),
    P + "Spine2": (P + "Neck", P + "LeftShoulder", P + "RightShoulder"),
    P + "LeftHand": (P + "LeftHandMiddle1", P + "LeftHandIndex1", P + "LeftHandPinky1"),
    P + "RightHand": (P + "RightHandMiddle1", P + "RightHandPinky1", P + "RightHandIndex1"),
}


def ordered(arm):
    out = []
    def walk(b):
        out.append(b); [walk(c) for c in b.children]
    [walk(b) for b in arm.data.bones if not b.parent]
    return out


def rot(m):
    return m.to_3x3().normalized()


def frame(up, side):
    """orthonormal basis (x, y=up, z) from an up vector and a rough side vector"""
    y = up.normalized(); x = y.cross(side).normalized(); z = x.cross(y).normalized()
    return Matrix((x, y, z)).transposed()


BONES = ordered(ours)
Rr = {b.name: rot(ours.matrix_world @ b.matrix_local) for b in BONES}           # rest world rotations
Hr = {b.name: (ours.matrix_world @ b.matrix_local).to_translation() for b in BONES}  # rest world heads
off = lambda b, c: Rr[b].inverted() @ (Hr[c] - Hr[b])                           # child head in b's rest frame
names = {b.name for b in BONES}


def bake(fbx):
    name = os.path.splitext(os.path.basename(fbx))[0]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=fbx, automatic_bone_orientation=False)
    new = [o for o in bpy.data.objects if o not in before]
    src = next(o for o in new if o.type == "ARMATURE")
    f0, f1 = (int(round(v)) for v in src.animation_data.action.frame_range)
    sb = src.data.bones
    mapped = [b for b in BONES if b.name in sb]
    Ss = {b.name: rot(src.matrix_world @ sb[b.name].matrix_local) for b in mapped}       # source rest rotations
    Hs0 = {b.name: (src.matrix_world @ sb[b.name].matrix_local).to_translation() for b in mapped}
    hips = P + "Hips"
    hip_scale = Hr[hips].z / Hs0[hips].z

    # 1. "aligned rest": our skeleton posed like the source's rest pose (bones aimed along the source rest
    #    directions, hips/chest/hands also matching a side axis). Fingers keep their relaxed rest.
    A = {}
    for b in BONES:
        n, par = b.name, (b.parent.name if b.parent else None)
        rest_rel = (Rr[par].inverted() @ Rr[n]) if par else Rr[n]
        w = (A[par] @ rest_rel) if par else rest_rel.copy()
        kids = [c.name for c in b.children if c.name in Hs0]
        main = next((c for c in kids if MAIN.search(c)), kids[0] if kids else None)
        if n not in Hs0 or (args.rest_fingers and FINGER.search(n)):
            pass
        elif n in FRAMES and all(c in Hs0 for c in FRAMES[n]):
            up, l, r = FRAMES[n]
            t = frame(w @ off(n, up), w @ off(n, l) - w @ off(n, r))
            s_ = frame(Hs0[up] - Hs0[n], Hs0[l] - Hs0[r])
            w = s_ @ t.inverted() @ w
        elif main:
            w = (w @ off(n, main)).rotation_difference(Hs0[main] - Hs0[n]).to_matrix() @ w
        A[n] = w

    # 2. optional trims: explicit frame ranges; Land starts at ground contact
    if name in ranges:
        f0, f1 = max(f0, ranges[name][0]), min(f1, ranges[name][1])
    if name in trim_contact:
        feet = [P + k for k in ("LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase") if P + k in sb]
        lows = []
        for f in range(f0, f1 + 1):
            scene.frame_set(f); lows.append(min((src.matrix_world @ src.pose.bones[k].head).z for k in feet))
        floor = min(lows)
        f0 = f0 + next(i for i, z in enumerate(lows) if z <= floor + 0.04)

    action = bpy.data.actions.new(name); action.use_fake_user = True
    ours.animation_data.action = action
    for pb in ours.pose.bones:
        pb.rotation_mode = "QUATERNION"

    # 3. per frame: each bone takes the source bone's world rotation change from rest, applied to the aligned rest
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        W = {}
        for b in BONES:
            n, par = b.name, (b.parent.name if b.parent else None)
            rest_rel = (Rr[par].inverted() @ Rr[n]) if par else Rr[n]
            if n in Ss and not (args.rest_fingers and FINGER.search(n)):
                w = rot(src.matrix_world @ src.pose.bones[n].matrix) @ Ss[n].inverted() @ A[n]
            else:
                w = (W[par] @ rest_rel) if par else rest_rel.copy()
            W[n] = w
            basis = rest_rel.inverted() @ (W[par].inverted() if par else Matrix.Identity(3)) @ w
            pb = ours.pose.bones[n]
            pb.rotation_quaternion = basis.to_quaternion()
            pb.keyframe_insert("rotation_quaternion", frame=f - f0 + 1)
            if n == hips:
                p = src.matrix_world @ src.pose.bones[hips].head
                pos = Vector((Hr[hips].x, Hr[hips].y, Hr[hips].z if name in lock_height else p.z * hip_scale))
                if name in keep_travel:
                    pos.x, pos.y = p.x * hip_scale, p.y * hip_scale
                pb.location = Rr[hips].inverted() @ (pos - Hr[hips])
                pb.keyframe_insert("location", frame=f - f0 + 1)

    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    ours.animation_data.action = None
    track = ours.animation_data.nla_tracks.new(); track.name = name
    track.strips.new(name, 1, action)
    log("baked", name, "frames", f1 - f0 + 1, "hip scale", round(hip_scale, 3))
    return name


files = sorted(glob.glob(os.path.join(args.clips, "*.fbx")))
baked = [bake(f) for f in files if not only or os.path.splitext(os.path.basename(f))[0] in only]
for pb in ours.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
scene.frame_set(1)

if args.save_blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.save_blend), copy=True)
if args.out.endswith(".blend"):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.out))
else:
    for o in bpy.data.objects:
        o.select_set(o.type in ("MESH", "ARMATURE"))
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.out), export_format="GLB", use_selection=True, export_apply=True,
                              export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
                              export_frame_step=1, export_optimize_animation_size=True, export_skins=True, export_yup=True,
                              export_image_format="JPEG", export_jpeg_quality=88)
log("wrote", args.out, round(os.path.getsize(args.out) / 1e6, 2), "MB", "clips", baked)

"""Chapter 01 · Survival — builds the rural village in Blender from CC0 Poly Haven scans and exports it for the web.

Run headless (after scripts/fetch-polyhaven.mjs has fetched the assets listed in docs/ASSET_MANIFEST.md):
  /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/blender/build_survival.py -- \
      --src assets-src/survival/polyhaven --out assets-src/survival/out [--render]

Outputs (in --out):
  survival-world.glb    terrain + architecture + placed props (Blender Z-up -> glTF Y-up)
  survival-foliage.glb  one node per vegetation variant, at the origin (instanced at run time)
  survival-layout.json  colliders, interactables, door, spawn, exit, foliage instances — all in three.js coordinates
  survival.blend        the composed scene, for review

Everything is modelled from real scanned materials (hollow block, weathered planks, galvanised/rusted corrugated
iron, bamboo sawali, thatch, laterite and mud) or placed Poly Haven scans. No primitive stand-ins: walls, sheets,
rafters, slats, posts and cloth are built at real dimensions with world-scale UVs.
Coordinates here: X east, Y north, Z up (metres). House A (where the player wakes up) is at the origin.
"""
import argparse, glob, json, math, os, random, sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--render", action="store_true")
ap.add_argument("--no-export", action="store_true")
args = ap.parse_args(argv)
SRC, OUT = os.path.abspath(args.src), os.path.abspath(args.out)
os.makedirs(OUT, exist_ok=True)
log = lambda *a: print("@@", *a, flush=True)
rng = random.Random(1987)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
WORLD = bpy.data.collections.new("world"); scene.collection.children.link(WORLD)
LIB = bpy.data.collections.new("library"); scene.collection.children.link(LIB)
FOL = bpy.data.collections.new("foliage"); scene.collection.children.link(FOL)

LAYOUT = {"colliders": [], "interactables": [], "doors": [], "foliage": {}, "lights": [], "spawn": None, "exit": None,
          "terrain": "terrain", "boundary": []}


def T(v):  # Blender (x, y, z) -> three.js (x, z, -y)
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def TQ(q):  # Blender quaternion -> three.js quaternion [x, y, z, w]
    return [round(q.x, 5), round(q.z, 5), round(-q.y, 5), round(q.w, 5)]


# =====================================================================================================================
# materials (Poly Haven texture sets: <id>_diff / _nor_gl / _arm (AO, rough, metal) or _rough)
# =====================================================================================================================
TEX_SIZE = {  # physical size of one texture tile in metres (Poly Haven "dimensions")
    "bamboo_wall": 2.0, "brown_mud_02": 1.3, "concrete_block_wall": 2.0, "corrugated_iron_02": 2.7, "cotton_jersey": 0.26,
    "cracked_concrete_wall": 1.0, "damaged_plaster": 1.85, "denim_fabric": 0.1, "fabric_pattern_05": 0.5,
    "fabric_pattern_07": 0.4, "forest_ground_04": 3.15, "grass_ground": 2.51, "muddy_tracks": 2.25,
    "old_wooden_floor_02": 2.03, "red_laterite_soil_stones": 2.0, "rough_linen": 0.27, "rough_wood": 0.5,
    "rusty_corrugated_iron": 2.0, "rusty_metal_02": 1.0, "sparse_grass": 2.0, "thatch_roof_angled": 0.54,
    "weathered_plank_siding": 1.57, "weathered_planks": 2.0, "wood_peeling_paint_weathered": 0.76,
    "worn_concrete_floor": 2.0, "worn_corrugated_iron": 1.8, "worn_plaster_wall": 1.8, "peeling_painted_wall": 1.8,
    "blue_plaster_weathered": 2.0, "concrete_wall_006": 2.0, "concrete_block_wall_02": 2.01,
}
MATS = {}


def tex_file(tid, kind):
    kinds = (kind, "col") if kind == "diff" else (kind,)      # some fabric sets name the colour map "col_<variant>"
    for k in kinds:
        hits = sorted(glob.glob(f"{SRC}/textures/{tid}/textures/{tid}_{k}_*.jpg") + glob.glob(f"{SRC}/textures/{tid}/textures/{tid}_{k}_*.png"))
        if hits:
            return hits[0]
    return None


def pbr(name, tid, tint=None, rough_add=0.0, double=False):
    """Principled material from a Poly Haven set; tint multiplies the base colour (exported as baseColorFactor)."""
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]

    def img(path, data=False):
        n = nt.nodes.new("ShaderNodeTexImage"); n.image = bpy.data.images.load(path, check_existing=True)
        if data:
            n.image.colorspace_settings.name = "Non-Color"
        return n
    d = img(tex_file(tid, "diff"))
    if tint:
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0; mix.inputs[7].default_value = (*tint, 1.0)
        nt.links.new(d.outputs["Color"], mix.inputs[6]); nt.links.new(mix.outputs[2], b.inputs["Base Color"])
    else:
        nt.links.new(d.outputs["Color"], b.inputs["Base Color"])
    arm, rough, nor = tex_file(tid, "arm"), tex_file(tid, "rough"), tex_file(tid, "nor_gl")
    if arm:
        a = img(arm, True); sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(a.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], b.inputs["Roughness"]); nt.links.new(sep.outputs["Blue"], b.inputs["Metallic"])
    elif rough:
        r = img(rough, True); nt.links.new(r.outputs["Color"], b.inputs["Roughness"])
    else:
        b.inputs["Roughness"].default_value = min(1.0, 0.85 + rough_add)
    if nor:
        n = img(nor, True); nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(n.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    m.use_backface_culling = not double
    m["tex_size"] = TEX_SIZE.get(tid, 2.0)
    MATS[name] = m
    return m


M = {}
def mats():
    M["block"] = pbr("hollow_block", "concrete_block_wall", tint=(0.92, 0.9, 0.86))
    M["plaster"] = pbr("worn_plaster", "worn_plaster_wall", tint=(0.95, 0.93, 0.88))
    M["painted"] = pbr("painted_plaster_aqua", "blue_plaster_weathered", tint=(0.92, 0.95, 0.93))
    M["concrete"] = pbr("peeling_paint_wall", "peeling_painted_wall", tint=(0.95, 0.9, 0.86))
    M["floor"] = pbr("concrete_floor", "worn_concrete_floor", tint=(0.78, 0.74, 0.68))
    M["planks"] = pbr("weathered_planks", "weathered_planks")
    M["siding"] = pbr("plank_siding", "weathered_plank_siding", tint=(0.95, 0.9, 0.82))
    M["peeling"] = pbr("peeling_paint", "wood_peeling_paint_weathered")
    M["timber"] = pbr("rough_timber", "rough_wood", tint=(0.72, 0.62, 0.52))
    M["woodfloor"] = pbr("wood_floor", "old_wooden_floor_02", tint=(0.8, 0.74, 0.66))
    M["sawali"] = pbr("bamboo_sawali", "bamboo_wall", tint=(0.9, 0.84, 0.72))
    M["thatch"] = pbr("nipa_thatch", "thatch_roof_angled", tint=(0.82, 0.74, 0.6), double=True)
    M["gi"] = pbr("galvanised_iron", "worn_corrugated_iron", double=True)
    M["gi_rust"] = pbr("rusted_iron", "rusty_corrugated_iron", tint=(0.62, 0.5, 0.44), double=True)
    M["gi_grey"] = pbr("corrugated_grey", "corrugated_iron_02", double=True)
    M["metal"] = pbr("rusty_metal", "rusty_metal_02")
    M["linen"] = pbr("cloth_linen", "rough_linen", tint=(0.86, 0.82, 0.74), double=True)
    M["jersey"] = pbr("cloth_jersey", "cotton_jersey", tint=(0.55, 0.62, 0.7), double=True)
    M["denim"] = pbr("cloth_denim", "denim_fabric", double=True)
    M["pattern7"] = pbr("cloth_pattern", "fabric_pattern_07", double=True)
    M["pattern5"] = pbr("cloth_floral", "fabric_pattern_05", double=True)
    M["mattress"] = pbr("mattress_ticking", "fabric_pattern_07", tint=(0.78, 0.74, 0.66))
    M["soil"] = pbr("garden_soil", "brown_mud_02", tint=(0.8, 0.74, 0.68))
    # terrain: a placeholder material; the browser swaps in a 4-layer splat shader (mud / laterite / forest floor / grass)
    t = bpy.data.materials.new("terrain_splat"); t.use_nodes = True
    t.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.32, 0.3, 0.22, 1)
    M["terrain"] = t
    # glass and wire are plain (no texture exists for a thin wire); glass has a slight grime tint
    g = bpy.data.materials.new("window_glass"); g.use_nodes = True
    gb = g.node_tree.nodes["Principled BSDF"]; gb.inputs["Base Color"].default_value = (0.55, 0.6, 0.58, 1)
    gb.inputs["Roughness"].default_value = 0.12; gb.inputs["Alpha"].default_value = 0.35; g.blend_method = "BLEND"
    M["glass"] = g
    w = bpy.data.materials.new("cable_rubber"); w.use_nodes = True
    wb = w.node_tree.nodes["Principled BSDF"]; wb.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
    wb.inputs["Roughness"].default_value = 0.55
    M["wire"] = w


# =====================================================================================================================
# geometry helpers
# =====================================================================================================================
def uv_local(me, size, offset=(0.0, 0.0)):
    """box-projected UVs from local coordinates (meshes are built at real size, unscaled), 1 UV unit = one tile"""
    uv = me.uv_layers.new(name="UVMap") if not me.uv_layers else me.uv_layers[0]
    for p in me.polygons:
        n = p.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 2:
                u, v = co.x, co.y
            elif ax == 0:
                u, v = co.y * (1 if n.x > 0 else -1), co.z
            else:
                u, v = co.x * (-1 if n.y > 0 else 1), co.z
            uv.data[li].uv = (u / size + offset[0], v / size + offset[1])


def link(o, coll=None):
    (coll or WORLD).objects.link(o)
    return o


def mesh_obj(name, bm, mat, loc=(0, 0, 0), rot=(0, 0, 0), uv=True, uv_size=None, coll=None, uv_offset=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if uv:
        uv_local(me, uv_size or (mat.get("tex_size", 2.0) if mat else 2.0), uv_offset or (rng.random(), rng.random()))
    if mat:
        me.materials.append(mat)
    o = bpy.data.objects.new(name, me); o.location = loc; o.rotation_euler = rot
    return link(o, coll)


def collider(center, size, rot=(0, 0, 0), kind="env"):
    q = Euler(rot).to_quaternion()
    LAYOUT["colliders"].append({"p": T(center), "q": TQ(q), "h": [round(size[0] / 2, 4), round(size[2] / 2, 4), round(size[1] / 2, 4)], "k": kind})


def box(name, center, size, mat, rot=(0, 0, 0), col=False, bevel=0.0, uv_size=None):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES")
    o = mesh_obj(name, bm, mat, center, rot, uv_size=uv_size)
    if col:
        collider(center, size, rot)
    return o


def beam(name, a, b, w, h, mat, roll=0.0):
    """timber between two points (w across, h vertical-ish)"""
    a, b = Vector(a), Vector(b); d = b - a
    q = d.to_track_quat("X", "Z") @ Quaternion((1, 0, 0), roll)
    o = box(name, (a + b) / 2, (d.length, w, h), mat)
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = q
    return o


def prism(name, pts, depth_axis, depth, mat, loc=(0, 0, 0)):
    """extrude a 2D polygon (pts in the plane perpendicular to depth_axis 'x' or 'y') by depth"""
    bm = bmesh.new()
    vs = []
    for (u, z) in pts:
        vs.append(bm.verts.new((0, u, z) if depth_axis == "x" else (u, 0, z)))
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    off = Vector((depth, 0, 0) if depth_axis == "x" else (0, depth, 0))
    bmesh.ops.translate(bm, vec=off, verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, mat, loc)


def join(objs, name):
    objs = [o for o in objs if o]
    if not objs:
        return None
    ctx = {"active_object": objs[0], "selected_editable_objects": objs, "object": objs[0]}
    with bpy.context.temp_override(**ctx):
        bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def wall(name, a, b, z0, z1, t, mat, openings=(), inner_mat=None, inner_side=None, col=True):
    """straight wall from a to b (2D), z0..z1, thickness t; openings: (offset, width, sill, top) along the wall.
    Built from solid pieces around each opening (no booleans) — the pieces are also the colliders."""
    a, b = Vector((*a, 0)), Vector((*b, 0)); d = b - a; L = d.length; yaw = math.atan2(d.y, d.x)
    ux = d.normalized()
    pieces = []
    cuts = sorted(openings)
    spans, x = [], 0.0
    for (off, w, sill, top) in cuts:
        spans.append((x, off, z0, z1))                     # full-height before the opening
        if sill > z0 + 0.01:
            spans.append((off, off + w, z0, sill))          # below a window
        if top < z1 - 0.01:
            spans.append((off, off + w, top, z1))           # lintel
        x = off + w
    spans.append((x, L, z0, z1))
    for i, (s0, s1, h0, h1) in enumerate(spans):
        if s1 - s0 < 0.01 or h1 - h0 < 0.01:
            continue
        c = a + ux * ((s0 + s1) / 2); c.z = (h0 + h1) / 2
        o = box(f"{name}_{i}", c, (s1 - s0, t, h1 - h0), mat, (0, 0, yaw), col=col)
        if inner_mat and inner_side is not None:
            # faces pointing to the house interior get the plaster material
            o.data.materials.append(inner_mat)
            n_in = Vector(inner_side) - c; n_in.z = 0
            for p in o.data.polygons:
                nw = (o.rotation_euler.to_matrix() @ p.normal)
                if nw.dot(n_in) > 0.5 * n_in.length and abs(nw.z) < 0.5:
                    p.material_index = 1
        pieces.append(o)
    return pieces


def corrugated_sheet(name, length, width, period, amp, mat, sag=0.0):
    """one sheet: corrugations run along local X (downslope); width across Y"""
    bm = bmesh.new()
    ny = max(4, int(round(width / period * 6)))
    nx = max(2, int(length / 0.6) + 1)
    grid = []
    for i in range(nx + 1):
        row = []
        x = length * i / nx
        for j in range(ny + 1):
            y = width * j / ny
            z = amp * math.sin(2 * math.pi * y / period) - sag * math.sin(math.pi * i / nx)
            row.append(bm.verts.new((x, y - width / 2, z)))
        grid.append(row)
    for i in range(nx):
        for j in range(ny):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    # UV: corrugations of the texture run along V -> map local X to V, Y to U
    uv = me.uv_layers.new(name="UVMap"); s = mat.get("tex_size", 1.8); ou, ov = rng.random(), rng.random()
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co.y / s + ou, co.x / s + ov)
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))


def roof(name, origin, yaw, pitch, length, width, mat, period, amp=0.014, sheet_w=0.82, missing=(), lifted=(), overlap=0.07):
    """a pitched sheet roof: sheets laid side by side across `width`, each `length` long down the slope.
    origin = the high edge centre; yaw = direction the roof faces (downslope), pitch = slope angle (rad)."""
    objs, n = [], int(math.ceil(width / (sheet_w - overlap)))
    R = Euler((0, pitch, yaw)).to_matrix().to_4x4()
    for k in range(n):
        if k in missing:
            continue
        y = -width / 2 + (k + 0.5) * (sheet_w - overlap)
        s = corrugated_sheet(f"{name}_sheet{k}", length + rng.uniform(-0.04, 0.06), sheet_w, period, amp, mat, sag=rng.uniform(0, 0.02))
        lift = 0.06 if k in lifted else 0.0
        local = Matrix.Translation((rng.uniform(-0.03, 0.03), y, 0.006 * (k % 2) + lift))
        tw = Euler((rng.uniform(-0.01, 0.01) + (0.05 if k in lifted else 0), rng.uniform(-0.006, 0.006), rng.uniform(-0.01, 0.01))).to_matrix().to_4x4()
        s.matrix_world = Matrix.Translation(origin) @ R @ local @ tw
        objs.append(s)
    return objs


def catenary(name, a, b, sag, radius=0.006, mat=None):
    a, b = Vector(a), Vector(b)
    cd = bpy.data.curves.new(name, "CURVE"); cd.dimensions = "3D"; cd.bevel_depth = radius; cd.bevel_resolution = 1
    sp = cd.splines.new("POLY"); n = 14; sp.points.add(n)
    for i in range(n + 1):
        t = i / n; p = a.lerp(b, t); p.z -= sag * 4 * t * (1 - t)
        sp.points[i].co = (*p, 1)
    o = link(bpy.data.objects.new(name, cd))
    cd.materials.append(mat or M["wire"])
    return o


def cloth(name, center, w, h, yaw, mat, fold=True, wave=0.03):
    """a piece of fabric folded over a line: hangs h on each side, slight wave and gravity curve"""
    bm = bmesh.new(); nx, nz = 10, 8
    grid = []
    for i in range(nx + 1):
        row = []
        x = -w / 2 + w * i / nx
        for j in range(nz * 2 + 1):
            t = j / (nz * 2)                    # 0 = bottom front, 0.5 = over the line, 1 = bottom back
            side = -1 if t < 0.5 else 1
            zt = abs(t - 0.5) * 2               # 1 at bottoms, 0 at the line
            z = -h * zt
            y = side * (0.015 + 0.05 * zt * zt) + wave * math.sin(x * 9 + j) * zt
            row.append(bm.verts.new((x, y, z - 0.02 * math.sin(math.pi * i / nx) * (1 - zt))))
        grid.append(row)
    for i in range(nx):
        for j in range(nz * 2):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    return mesh_obj(name, bm, mat, center, (0, 0, yaw))


# =====================================================================================================================
# terrain
# =====================================================================================================================
ROAD = [(0.6, -2.6), (0.8, -8), (1.8, -14), (4.5, -19.5), (9, -23.5), (15, -28.5), (21, -35), (26, -44), (30.5, -54),
        (34.5, -64), (39, -76), (45, -92), (52, -110)]
PATH_B = [(0.9, -11), (-5, -11.5), (-10.5, -11.2)]
PATH_C = [(6.5, -21.5), (9.5, -17.5), (10.8, -14.5)]
EXIT = Vector((34.0, -62.0))
PADS = []          # (cx, cy, hx, hy, z) flattened house pads


def seg_dist(p, a, b):
    a, b, p = Vector(a), Vector(b), Vector(p)
    ab = b - a; t = max(0, min(1, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length, t


def path_dist(p, pts):
    best, along, acc = 1e9, 0, 0
    for i in range(len(pts) - 1):
        d, t = seg_dist(p, pts[i], pts[i + 1])
        L = (Vector(pts[i + 1]) - Vector(pts[i])).length
        if d < best:
            best, along = d, acc + t * L
        acc += L
    return best, along


def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def bowl(x, y):
    """0 inside the village, rising to 1 on the surrounding hills (an ellipse around the settlement)"""
    dx, dy = (x - 6) / 46.0, (y + 18) / 40.0
    r = math.sqrt(dx * dx + dy * dy)
    return smooth(0.85, 1.6, r)


def height(x, y):
    p = Vector((x, y, 0))
    h = 0.22 * noise.noise(p * 0.06) + 0.06 * noise.noise(p * 0.31 + Vector((5, 1, 0)))
    dr, along = path_dist((x, y), ROAD)
    hill = bowl(x, y) * (11 + 9 * noise.noise(p * 0.025 + Vector((3, 7, 0))) + 4 * noise.noise(p * 0.08))
    hill *= smooth(3.0, 16.0 + max(0, along - 60) * 0.25, dr) if along > 40 else 1.0   # the road cuts a narrow valley
    h += max(0.0, hill)
    # the road beyond the village climbs gently through its valley
    h += max(0.0, along - 55) * 0.045 * (1 - smooth(4, 14, dr))
    # ruts and a slight crown on roads and paths
    for pts, wdt, depth in ((ROAD, 2.2, 0.08), (PATH_B, 0.9, 0.04), (PATH_C, 0.9, 0.04)):
        d, _ = path_dist((x, y), pts)
        if d < wdt + 1.2:
            h -= depth * (1 - smooth(0, wdt + 1.2, d))
            if pts is ROAD and 0.45 < d < 1.0:
                h -= 0.025
    for (cx, cy, hx, hy, z) in PADS:
        k = 1 - smooth(0.0, 1.4, max(abs(x - cx) - hx, abs(y - cy) - hy))
        h = h * (1 - k) + z * k
    return h


def splat(x, y, z):
    """vertex colour weights: R mud road, G laterite yard soil, B forest floor (grass = remainder)"""
    p = Vector((x, y, 0))
    dr, _ = path_dist((x, y), ROAD)
    mud = 1 - smooth(1.4, 2.9, dr + 0.6 * noise.noise(p * 0.4))
    for pts in (PATH_B, PATH_C):
        d, _ = path_dist((x, y), pts)
        mud = max(mud, 0.8 * (1 - smooth(0.5, 1.4, d + 0.3 * noise.noise(p * 0.5))))
    soil = 0.0
    for (cx, cy, hx, hy, _) in PADS:
        dd = max(abs(x - cx) - hx, abs(y - cy) - hy)
        soil = max(soil, 1 - smooth(0.5, 3.2, dd + 0.8 * noise.noise(p * 0.3)))
    soil = max(soil, 0.55 * (1 - smooth(5, 9, math.hypot(x - 1, y + 1))))      # the trodden yard of house A
    forest = smooth(0.25, 0.8, bowl(x, y) + 0.15 * noise.noise(p * 0.07))
    soil *= 1 - mud; forest *= (1 - mud) * (1 - soil)
    return (mud, soil, forest)


def build_terrain():
    size, n = 240.0, 192
    bm = bmesh.new(); verts = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            # denser in the middle: warp the grid so the village gets ~0.6 m spacing
            u, v = -1 + 2 * i / n, -1 + 2 * j / n
            wu, wv = u * (0.35 + 0.65 * u * u), v * (0.35 + 0.65 * v * v)
            x, y = 6 + wu * size / 2, -18 + wv * size / 2
            row.append(bm.verts.new((x, y, height(x, y))))
        verts.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
    me = bpy.data.meshes.new("terrain"); bm.to_mesh(me); bm.free()
    col = me.color_attributes.new("Splat", "FLOAT_COLOR", "POINT")
    for v in me.vertices:
        r, g, b = splat(v.co.x, v.co.y, v.co.z)
        col.data[v.index].color = (r, g, b, 1.0)
    me.color_attributes.active_color = col
    uv = me.uv_layers.new(name="UVMap")
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co.x / 2.0, co.y / 2.0)
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(M["terrain"])
    o = link(bpy.data.objects.new("terrain", me))
    log("terrain tris", len(me.polygons) * 2)
    return o


def ground(x, y):
    return height(x, y)


# =====================================================================================================================
# Poly Haven props: import once into a hidden library, place linked copies
# =====================================================================================================================
LIBRARY = {}


def load(pid):
    if pid in LIBRARY:
        return LIBRARY[pid]
    g = glob.glob(f"{SRC}/models/{pid}/*.gltf")
    if not g:
        log("MISSING model", pid); LIBRARY[pid] = []; return []
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=g[0])
    new = [o for o in bpy.data.objects if o not in before]
    meshes = []
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        LIB.objects.link(o)
    # bake transforms, recentre each mesh on its footprint (bottom centre at the origin)
    for o in sorted([o for o in new if o.type == "MESH"], key=lambda o: (o.matrix_world.translation.x, o.name)):
        mw = o.matrix_world.copy(); o.parent = None; o.data = o.data.copy(); o.data.transform(mw); o.matrix_world = Matrix.Identity(4)
        xs = [v.co for v in o.data.vertices]
        mn = Vector((min(c.x for c in xs), min(c.y for c in xs), min(c.z for c in xs)))
        mx = Vector((max(c.x for c in xs), max(c.y for c in xs), max(c.z for c in xs)))
        o.data.transform(Matrix.Translation(-Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))))
        o["size"] = list(mx - mn)
        meshes.append(o)
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    LIBRARY[pid] = meshes
    return meshes


def joined_variant(pid, prefix, name):
    """join every mesh whose name starts with prefix (Poly Haven 'preset' assemblies) into one library mesh"""
    key = f"{pid}:{prefix}"
    if key in LIBRARY:
        return LIBRARY[key]
    g = glob.glob(f"{SRC}/models/{pid}/*.gltf")[0]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=g)
    new = [o for o in bpy.data.objects if o not in before]
    keep = [o for o in new if o.type == "MESH" and o.name.startswith(prefix)]
    for o in new:
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    axis = Vector((0, 0, 0))
    for o in keep:
        mw = o.matrix_world.copy(); o.parent = None; o.data = o.data.copy(); o.data.transform(mw); o.matrix_world = Matrix.Identity(4)
        if o.name == prefix + "pole":
            vs = [v.co for v in o.data.vertices]; axis = Vector((sum(c.x for c in vs) / len(vs), sum(c.y for c in vs) / len(vs), 0))
    for o in keep:
        o.data.transform(Matrix.Translation(-axis))
    j = join(keep, name)
    for c in list(j.users_collection):
        c.objects.unlink(j)
    LIB.objects.link(j)
    xs = [v.co for v in j.data.vertices]
    mn = Vector((min(c.x for c in xs), min(c.y for c in xs), min(c.z for c in xs))); mx = Vector((max(c.x for c in xs), max(c.y for c in xs), max(c.z for c in xs)))
    j.data.transform(Matrix.Translation(-Vector((0, 0, mn.z))))
    # the pole's own axis is at (x, y) of the "pole" part; centre on it
    j["size"] = list(mx - mn)
    LIBRARY[key] = [j]
    return [j]


def place(pid, loc, yaw=0.0, scale=1.0, variant=0, z=None, col=False, tilt=(0, 0), name=None):
    lib = load(pid) if ":" not in pid else LIBRARY[pid]
    if not lib:
        return None
    src = lib[variant % len(lib)]
    o = bpy.data.objects.new(name or f"{pid}_{len(WORLD.objects)}", src.data)
    gz = ground(loc[0], loc[1]) if z is None else z
    o.location = (loc[0], loc[1], gz); o.rotation_euler = (tilt[0], tilt[1], yaw); o.scale = (scale,) * 3
    link(o)
    if col:
        s = Vector(src["size"]) * scale
        collider((loc[0], loc[1], gz + s.z / 2), (s.x, s.y, s.z), (0, 0, yaw))
    return o


def interactable(iid, label, verb, pos, narrative=None, radius=1.5, action=None):
    LAYOUT["interactables"].append({"id": iid, "label": label, "verb": verb, "p": T(pos), "r": radius,
                                    **({"narrativeId": narrative} if narrative else {}), **({"action": action} if action else {})})


# =====================================================================================================================
# house A — hollow-block house with a mono-pitch GI roof (the player wakes up here)
# =====================================================================================================================
def house_a():
    F = 0.12                       # floor level
    PADS.append((0, 0, 3.6, 3.0, 0.0))
    box("A_floor", (0, 0, F / 2 - 0.02), (6.3, 4.8, F + 0.04), M["floor"], col=False, uv_size=2.0)
    collider((0, 0, F / 2 - 0.02), (6.3, 4.8, F + 0.04))
    x0, x1, y0, y1, top, t = -3.0, 3.0, -2.25, 2.25, 2.75, 0.15
    inside = (0, 0, 1.2)
    parts = []
    # south (front) wall: window left, door right
    parts += wall("A_wall_s", (x0, y0), (x1, y0), F, top, t, M["painted"], [(0.8, 1.0, F + 0.95, F + 1.9), (3.6, 0.86, F, F + 2.02)], M["plaster"], inside)
    parts += wall("A_wall_n", (x1, y1), (x0, y1), F, top, t, M["block"], [(4.1, 0.7, F + 1.15, F + 1.75)], M["plaster"], inside)
    parts += wall("A_wall_e", (x1, y0), (x1, y1), F, top, t, M["block"], [(1.75, 1.0, F + 0.95, F + 1.85)], M["plaster"], inside)
    parts += wall("A_wall_w", (x0, y1), (x0, y0), F, top, t, M["block"], [(0.9, 0.6, F + 1.2, F + 1.8)], M["plaster"], inside)
    # timber gable infill on the side walls (the roof rises to the north) + a plank band on the north wall
    hi = 3.32
    for sx in (x0 - 0.075, x1 - 0.075):
        prism(f"A_gable_{sx:.0f}", [(y0 - 0.05, top), (y1 + 0.05, top), (y1 + 0.05, hi)], "x", 0.15, M["siding"], (sx, 0, 0))
    box("A_band_n", (0, y1, (top + hi) / 2), (6.15, 0.15, hi - top), M["siding"])
    collider((0, y1, (top + hi) / 2), (6.15, 0.15, hi - top))
    # wall plates, rafters, purlins
    for (yy, zz) in ((y0, top + 0.04), (y1, hi + 0.04)):
        box(f"A_plate_{yy}", (0, yy, zz), (6.3, 0.12, 0.08), M["timber"])
    pitch = math.atan2(hi - top, (y1 + 0.6) - (y0 - 0.6))
    for i, xx in enumerate((-2.95, -1.5, 0.0, 1.5, 2.95)):
        beam(f"A_rafter{i}", (xx, y1 + 0.6, hi + 0.12), (xx, y0 - 0.6, top + 0.06), 0.05, 0.10, M["timber"])
    for i, f in enumerate((0.05, 0.37, 0.68, 0.95)):
        yy = (y1 + 0.6) + ((y0 - 0.6) - (y1 + 0.6)) * f; zz = (hi + 0.19) + ((top + 0.13) - (hi + 0.19)) * f
        box(f"A_purlin{i}", (0, yy, zz), (7.0, 0.05, 0.05), M["timber"])
    slope_len = math.hypot((y1 + 0.6) - (y0 - 0.6), hi - top) + 0.1
    roof("A_roof", Vector((0, y1 + 0.65, hi + 0.25)), -math.pi / 2, pitch, slope_len, 7.2, M["gi"], 1.8 / 16, lifted={3})
    # a few rusted replacement sheets and a rock holding one down (common practice)
    for o in roof("A_patch", Vector((-1.9, y1 + 0.66, hi + 0.285)), -math.pi / 2, pitch, slope_len * 0.55, 0.8, M["gi_rust"], 2.0 / 61):
        pass
    # door: planks on a hinge (pivot = hinge), opens inwards
    door = box("A_door", (0.43, 0, 1.0), (0.86, 0.045, 2.0), M["peeling"], uv_size=0.76)
    door.data.transform(Matrix.Translation((0, 0, 0)))
    hinge = Vector((x0 + 3.6, y0, F))
    piv = link(bpy.data.objects.new("A_door_pivot", None)); piv.location = hinge
    door.parent = piv; door.location = (0.43, 0.0, 1.01)
    for zz in (0.35, 1.65):  # cross battens
        b = box(f"A_door_batten{zz}", (0.43, 0.035, zz), (0.8, 0.03, 0.09), M["timber"]); b.parent = piv
    LAYOUT["doors"].append({"id": "survival-door", "node": "A_door_pivot", "hinge": T(hinge), "width": 0.86, "height": 2.0,
                            "thickness": 0.05, "closedYaw": 0.0, "openYaw": -1.75})
    interactable("survival-door", "the door", "open", (x0 + 3.6 + 0.43, y0, 1.1), radius=1.3, action="door:survival-door")
    # window frames, shutters
    def window(cx, cy, yaw, w, sill, top, shutters=True, broken=False):
        R = Euler((0, 0, yaw)).to_matrix()
        def at(dx, dy, dz):
            return Vector((cx, cy, 0)) + R @ Vector((dx, dy, 0)) + Vector((0, 0, dz))
        for s in (-1, 1):
            box("win_jamb", at(s * (w / 2 - 0.03), 0, (sill + top) / 2), (0.06, 0.17, top - sill), M["timber"], (0, 0, yaw))
        box("win_sill", at(0, -0.02, sill - 0.02), (w + 0.1, 0.22, 0.05), M["timber"], (0, 0, yaw))
        box("win_head", at(0, 0, top + 0.02), (w + 0.06, 0.17, 0.05), M["timber"], (0, 0, yaw))
        if shutters:
            for s, ang in ((-1, 1.9), (1, -1.25)):
                hingep = at(s * w / 2, -0.11, (sill + top) / 2)
                sh = box("win_shutter", hingep, (w / 2, 0.03, top - sill - 0.04), M["planks"], (0, 0, yaw), uv_size=2.0)
                sh.data.transform(Matrix.Translation((-s * w / 4, 0, 0)))
                sh.rotation_euler = (0, 0, yaw + ang * (-1 if s < 0 else 1) * 0.5)
    window(x0 + 1.3, y0, 0, 1.0, F + 0.95, F + 1.9)
    window(x1, y0 + 2.25, math.pi / 2, 1.0, F + 0.95, F + 1.85)
    window(x0, y1 - 1.2, -math.pi / 2, 0.6, F + 1.2, F + 1.8, shutters=False)
    window(x1 - 4.45, y1, math.pi, 0.7, F + 1.15, F + 1.75, shutters=False)
    # front step
    box("A_step", (1.03, y0 - 0.32, 0.06), (1.1, 0.45, 0.14), M["floor"], col=True, uv_size=2.0)

    # ---------------- interior ----------------
    place("WoodenTable_01", (-0.5, 0.35), 0.08, z=F, col=True)
    TH = F + LIBRARY["WoodenTable_01"][0]["size"][2]
    place("plastic_monobloc_chair_01", (-0.55, -0.45), 0.2, z=F)
    place("plastic_monobloc_chair_01", (0.5, 0.55), -1.75, z=F)
    lamp = place("vintage_oil_lamp", (-0.75, 0.42), 0.4, z=TH)
    interactable("survival-lamp", "an oil lamp", "examine", (-0.75, 0.42, F + 0.9), "survival-lamp", radius=1.4)
    LAYOUT["lights"].append({"p": T((-0.75, 0.42, F + 1.05)), "color": "#ffb46b", "intensity": 1.6, "distance": 5.5})
    place("pot_enamel_01", (-0.2, 0.25), 1.0, z=TH)
    # mattress on the floor in the north-west corner, pillow, folded blanket
    mat_o = box("A_mattress", (-1.95, 1.45, F + 0.065), (1.9, 0.95, 0.13), M["mattress"], (0, 0, 0.03), bevel=0.04, uv_size=0.5)
    box("A_pillow", (-2.65, 1.45, F + 0.17), (0.32, 0.55, 0.1), M["linen"], (0, 0, 0.08), bevel=0.04, uv_size=0.27)
    box("A_blanket", (-1.35, 1.5, F + 0.16), (0.42, 0.85, 0.07), M["pattern5"], (0, 0, 0.06), bevel=0.03, uv_size=0.5)
    # cabinet with the photograph on top; shelf items
    place("painted_wooden_cabinet", (2.45, 1.85), math.pi, z=F, col=True)
    photo = box("A_photo_frame", (2.35, 1.75, F + 0.0), (0.2, 0.26, 0.012), M["timber"], (0, 0, 0.3), uv_size=0.5)
    place("ceramic_pot", (2.7, 1.9), 0.3, z=F + 0.0)
    interactable("survival-photograph", "an old photograph", "inspect", (2.35, 1.75, F + 1.0), "survival-photograph", radius=1.4)
    LAYOUT["_photo"] = "A_photo_frame"
    place("wooden_bucket_01", (2.55, -1.75), 0.0, z=F)
    place("plastic_jerrycan", (2.1, -1.85), 0.6, z=F)
    place("wicker_basket_01", (-2.6, -1.7), 0.3, z=F)
    place("wooden_broom", (-2.85, -0.55), 1.3, z=F, tilt=(0.0, 0.32))
    # a curtain on a wire screens the sleeping corner
    catenary("A_curtain_wire", (-0.9, 0.35, F + 1.9), (-0.9, y1 - 0.08, F + 1.9), 0.02, 0.003)
    for i in range(3):
        c = cloth(f"A_curtain{i}", (-0.9, 0.6 + i * 0.55, F + 1.9), 0.58, 0.85, math.pi / 2, M["pattern5"], wave=0.05)
        c.scale = (1, 1, 1.25 if i != 1 else 1.1)
    # snap the cabinet-top props to the cabinet height
    cab = LIBRARY["painted_wooden_cabinet"][0]["size"][2]
    for o in WORLD.objects:
        if o.name.startswith(("A_photo_frame", "ceramic_pot")) and abs(o.location.x - 2.5) < 0.5 and o.location.y > 1.5:
            o.location.z = F + cab
    LAYOUT["spawn"] = {"p": T((-1.7, -0.75, F + 0.02)), "lookAt": T((1.03, -2.25, 1.2))}


def dirty_kitchen():
    """open lean-to cooking area on the east side of house A (a 'dirty kitchen')"""
    for i, (x, y) in enumerate(((5.7, -1.6), (5.7, 1.6))):
        box(f"K_post{i}", (x, y, 1.1), (0.1, 0.1, 2.2), M["timber"], col=True)
    box("K_beam", (5.7, 0, 2.2), (0.1, 3.4, 0.12), M["timber"])
    for i, y in enumerate((-1.55, 0, 1.55)):
        beam(f"K_rafter{i}", (3.05, y, 2.62), (6.0, y, 2.18), 0.05, 0.08, M["timber"])
    roof("K_roof", Vector((3.1, 0, 2.72)), 0.0, math.atan2(0.44, 2.95), 3.2, 3.6, M["gi_rust"], 2.0 / 61, missing={3})
    place("stone_fire_pit", (4.4, 0.4), 0.3, col=True)
    place("pot_enamel_01", (4.45, 0.4), 0.0, z=ground(4.4, 0.4) + 0.3)
    place("barrel_stove", (4.3, -1.15), 0.6, col=True)
    place("wooden_table_02", (5.1, 1.0), math.pi / 2, col=True)
    tz = ground(5.1, 1.0) + 0.75
    for pid, dx, dy in (("ceramic_pot", -0.2, 0.0), ("metal_jug", 0.15, 0.1), ("can_rusted", 0.25, -0.2)):
        place(pid, (5.1 + dx, 1.0 + dy), rng.uniform(0, 6), z=tz)
    place("plastic_container", (5.5, -0.9), 0.4)
    # firewood: split logs and offcuts stacked against a post
    for i in range(18):
        L = rng.uniform(0.45, 0.7)
        box(f"K_firewood{i}", (5.95 + rng.uniform(-0.05, 0.05), -1.2 + (i % 6) * 0.11, ground(5.9, -1.0) + 0.05 + (i // 6) * 0.09),
            (0.08, L, 0.08), M["timber"], (rng.uniform(-0.05, 0.05), 0, math.pi / 2 + rng.uniform(-0.15, 0.15)), bevel=0.012)
    collider((5.95, -0.95, 0.15), (0.3, 0.75, 0.3))


def yard():
    # fence: posts every ~2 m, two rails, uneven slats; a gap with an open gate to the road
    run = [(-7.0, -6.5), (0.15, -6.5), None, (1.75, -6.5), (8.2, -6.5), (8.2, 7.0), (-7.0, 7.0), (-7.0, -6.5)]
    segs = []
    for i in range(len(run) - 1):
        if run[i] is None or run[i + 1] is None:
            continue
        segs.append((run[i], run[i + 1]))
    for si, (a, b) in enumerate(segs):
        a, b = Vector((*a, 0)), Vector((*b, 0)); d = b - a; L = d.length; u = d.normalized(); yaw = math.atan2(d.y, d.x)
        nposts = max(1, int(L / 2.0))
        slats = []
        for k in range(nposts + 1):
            p = a + u * (L * k / nposts)
            slats.append(box(f"F{si}_post{k}", (p.x, p.y, ground(p.x, p.y) + 0.55), (0.09, 0.09, 1.25), M["timber"],
                             (rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03), yaw + rng.uniform(-0.2, 0.2))))
        for zr in (0.35, 0.95):
            c = (a + b) / 2
            slats.append(box(f"F{si}_rail{zr}", (c.x, c.y, ground(c.x, c.y) + zr), (L, 0.04, 0.07), M["timber"], (0, rng.uniform(-0.01, 0.01), yaw)))
        broken = rng.randrange(len(segs) + 2)
        s = 0.06
        while s < L - 0.05:
            if si == broken and 0.3 < s / L < 0.55:
                s += 0.12; continue
            p = a + u * s; h = rng.uniform(1.0, 1.22)
            slats.append(box(f"F{si}_slat", (p.x, p.y, ground(p.x, p.y) + h / 2 - 0.02), (rng.uniform(0.06, 0.1), 0.018, h), M["planks"],
                             (0, rng.uniform(-0.04, 0.04), yaw), uv_size=2.0))
            s += rng.uniform(0.1, 0.16)
        join(slats, f"fence_{si}")
        c = (a + b) / 2
        collider((c.x, c.y, ground(c.x, c.y) + 0.6), (L, 0.12, 1.3), (0, 0, yaw))
    # the gate: a slatted leaf standing open
    gate = []
    for k in range(9):
        gate.append(box("G_slat", (0.15 + 0.06 + k * 0.17, 0, 0.6), (0.08, 0.02, 1.15), M["planks"], uv_size=2.0))
    for zr in (0.3, 0.95):
        gate.append(box("G_rail", (0.15 + 0.75, 0.02, zr), (1.5, 0.03, 0.07), M["timber"]))
    g = join(gate, "gate"); g.data.transform(Matrix.Translation((-0.15, 0, 0)))
    g.location = (0.15, -6.5, ground(0.15, -6.5)); g.rotation_euler = (0, 0, -2.1)
    place("gate_latch_01", (1.72, -6.5), math.pi / 2, z=ground(1.7, -6.5) + 0.75)
    # clothes line between two posts, fabrics hung over it
    a, b = Vector((-5.4, -4.6, ground(-5.4, -4.6) + 1.95)), Vector((-5.0, 3.6, ground(-5.0, 3.6) + 1.95))
    for i, p in enumerate((a, b)):
        box(f"CL_post{i}", (p.x, p.y, p.z / 2 + 0.05), (0.08, 0.08, p.z + 0.1), M["timber"], col=True)
    catenary("CL_line", a, b, 0.18, 0.004, M["wire"])
    for i, (t, w, h, m) in enumerate(((0.12, 0.7, 0.5, "jersey"), (0.26, 0.9, 0.65, "pattern5"), (0.42, 0.55, 0.45, "denim"),
                                      (0.56, 1.1, 0.7, "linen"), (0.74, 0.6, 0.5, "pattern7"), (0.86, 0.5, 0.42, "jersey"))):
        p = a.lerp(b, t); p.z -= 0.18 * 4 * t * (1 - t)
        yaw = math.atan2(b.y - a.y, b.x - a.x)
        cloth(f"CL_cloth{i}", p, w, h, yaw, M[m])
    # garden bed with seedlings beside the kitchen
    for i, (c, s) in enumerate((((5.5, 4.3), (3.2, 0.06)), ((5.5, 5.6), (3.2, 0.06)), ((3.95, 4.95), (0.06, 1.36)), ((7.05, 4.95), (0.06, 1.36)))):
        box(f"bed_edge{i}", (c[0], c[1], ground(*c) + 0.08), (s[0], s[1], 0.2), M["timber"])
    box("bed_soil", (5.5, 4.95, ground(5.5, 4.95) + 0.06), (3.0, 1.25, 0.12), M["soil"], uv_size=1.3)
    for i in range(10):
        place("calathea_orbifolia_01" if i % 3 else "anthurium_botany_01", (4.2 + (i % 5) * 0.62, 4.6 + (i // 5) * 0.65),
              rng.uniform(0, 6), scale=rng.uniform(0.7, 1.0), variant=i, z=ground(5.5, 4.95) + 0.12)
    place("seeding_tray_01", (7.5, 4.2), 0.2)
    place("watering_can_metal_01", (7.55, 5.3), 2.1)
    for i in range(3):
        place("planter_pot_clay", (3.6 - i * 0.45, 6.4), rng.uniform(0, 6))
    # storage shed behind the house: timber frame clad in rusted sheets, open at the front
    sx, sy = -4.4, 4.9
    PADS.append((sx, sy, 1.7, 1.3, 0.0))
    for i, (x, y) in enumerate(((sx - 1.5, sy - 1.1), (sx + 1.5, sy - 1.1), (sx - 1.5, sy + 1.1), (sx + 1.5, sy + 1.1))):
        box(f"S_post{i}", (x, y, 1.15 if y < sy else 1.35), (0.09, 0.09, 2.3 if y < sy else 2.7), M["timber"], col=True)
    for name, a2, b2 in (("S_back", (sx - 1.55, sy + 1.12), (sx + 1.55, sy + 1.12)), ("S_left", (sx - 1.52, sy + 1.12), (sx - 1.52, sy - 1.12)),
                         ("S_right", (sx + 1.52, sy - 1.12), (sx + 1.52, sy + 1.12))):
        a2, b2 = Vector(a2), Vector(b2); L = (b2 - a2).length; yaw = math.atan2(b2.y - a2.y, b2.x - a2.x)
        n = int(L / 0.75) + 1
        for k in range(n):
            p = a2.lerp(b2, (k + 0.5) / n)
            sh = corrugated_sheet(f"{name}{k}", 2.25, 0.8, 1.8 / 16, 0.012, M["gi"] if (k + len(name)) % 3 else M["gi_rust"])
            sh.matrix_world = Matrix.Translation((p.x, p.y, 0.05)) @ Euler((0, -math.pi / 2, yaw - math.pi / 2)).to_matrix().to_4x4()
        c = (a2 + b2) / 2
        collider((c.x, c.y, 1.2), (L, 0.1, 2.4), (0, 0, yaw))
    roof("S_roof", Vector((sx, sy + 1.4, 2.75)), -math.pi / 2, math.atan2(0.45, 2.8), 2.9, 3.6, M["gi_rust"], 2.0 / 61, missing={2})
    for i, (pid, dx, dy, yaw) in enumerate((("Barrel_01", -0.9, 0.5, 0.2), ("old_tyre", 0.8, 0.6, 0.0), ("cardboard_box_01", 0.2, 0.75, 0.4),
                                            ("rusted_wheel_rim_01", 1.05, -0.2, 1.2), ("plastic_crate_01", -0.2, 0.1, 0.1), ("metal_jerrycan", -1.1, -0.4, 2.2))):
        place(pid, (sx + dx, sy + dy), yaw, variant=i)
    place("wooden_ladder", (sx - 1.65, sy - 0.2), math.pi / 2, tilt=(0.25, 0, 0))
    # chopping stump with the hatchet, offcuts
    place("tree_stump_01", (-3.2, -4.8), 0.4, scale=0.5)
    place("hatchet", (-3.15, -4.75), 1.1, z=ground(-3.2, -4.8) + 0.42, tilt=(0.35, 0, 0))
    for i in range(10):
        box(f"chips{i}", (-3.2 + rng.uniform(-0.9, 0.9), -4.8 + rng.uniform(-0.9, 0.9), ground(-3.2, -4.8) + 0.02),
            (rng.uniform(0.1, 0.3), rng.uniform(0.04, 0.08), 0.03), M["timber"], (0, 0, rng.uniform(0, 6)))
    # scattered timber against the house
    for i in range(7):
        box(f"A_planks{i}", (-3.35, -1.2 + i * 0.12, 1.0), (0.025, rng.uniform(0.14, 0.22), 2.0 + rng.uniform(-0.3, 0.2)), M["planks"],
            (0, -0.18 + rng.uniform(-0.03, 0.03), 0), uv_size=2.0)


# =====================================================================================================================
# house B — a raised wooden house with bamboo (sawali) walls, plank floor, exterior stairs, GI gable roof
# =====================================================================================================================
def house_b():
    cx, cy, yaw = -15.0, -12.5, math.radians(8)
    PADS.append((cx, cy, 3.2, 2.8, 0.05))
    R = Euler((0, 0, yaw)).to_matrix()
    at = lambda dx, dy, z: Vector((cx, cy, 0)) + R @ Vector((dx, dy, 0)) + Vector((0, 0, z))
    FL = 1.15; W, D = 5.0, 4.0
    for i, (dx, dy) in enumerate(((-2.4, -1.9), (0, -1.9), (2.4, -1.9), (-2.4, 1.9), (0, 1.9), (2.4, 1.9), (-2.4, 0), (2.4, 0))):
        p = at(dx, dy, 0); box(f"B_post{i}", (p.x, p.y, ground(p.x, p.y) + FL / 2 - 0.1), (0.14, 0.14, FL + 0.2), M["timber"], (0, 0, yaw), col=True)
    for i, dy in enumerate((-1.9, 0, 1.9)):
        p = at(0, dy, FL - 0.12); box(f"B_joist{i}", p, (5.2, 0.1, 0.16), M["timber"], (0, 0, yaw))
    p = at(0, 0, FL); box("B_floor", p, (5.0, 4.0, 0.05), M["woodfloor"], (0, 0, yaw), col=True, uv_size=2.03)
    top = FL + 2.3
    walls = []
    for name, a, b, ops in (("s", (-2.5, -2.0), (2.5, -2.0), [(0.8, 1.0, FL + 0.9, FL + 1.8)]), ("n", (2.5, 2.0), (-2.5, 2.0), [(1.5, 1.2, FL + 0.9, FL + 1.8)]),
                            ("e", (2.5, -2.0), (2.5, 2.0), [(1.4, 0.85, FL, FL + 2.0)]), ("w", (-2.5, 2.0), (-2.5, -2.0), [])):
        A, B = at(*a, 0), at(*b, 0)
        walls += wall(f"B_wall_{name}", (A.x, A.y), (B.x, B.y), FL, top, 0.05, M["sawali"], ops)
    for i, (dx, dy) in enumerate(((-2.5, -2.0), (2.5, -2.0), (2.5, 2.0), (-2.5, 2.0))):
        p = at(dx, dy, (FL + top) / 2); box(f"B_corner{i}", p, (0.1, 0.1, top - FL), M["timber"], (0, 0, yaw))
    for z in (FL + 0.06, top - 0.05):
        for name, dx, dy, sx, sy in (("s", 0, -2.03, 5.1, 0.06), ("n", 0, 2.03, 5.1, 0.06), ("e", 2.53, 0, 0.06, 4.1), ("w", -2.53, 0, 0.06, 4.1)):
            p = at(dx, dy, z); box(f"B_band_{name}", p, (sx, sy, 0.08), M["timber"], (0, 0, yaw))
    # door (closed) and gable ends in plank siding
    p = at(2.53, -0.175, FL + 1.0); box("B_door", p, (0.04, 0.85, 2.0), M["siding"], (0, 0, yaw))
    for s in (-1, 1):
        A = at(s * 2.53, 0, 0)
        o = prism(f"B_gable{s}", [(-2.05, top), (2.05, top), (0, top + 1.25)], "x", 0.05, M["siding"])
        o.location = (A.x - 0.025, A.y, 0); o.rotation_euler = (0, 0, yaw)
    pitch = math.atan2(1.25, 2.05)
    for s in (-1, 1):
        roof(f"B_roof{s}", at(0, 0, top + 1.32), yaw + (math.pi / 2 if s > 0 else -math.pi / 2), pitch, 2.95, 6.2, M["gi"], 1.8 / 16,
             lifted={2} if s > 0 else set())
    box("B_ridge", at(0, 0, top + 1.36), (6.2, 0.22, 0.04), M["gi_rust"], (0, 0, yaw))
    # stairs down from the door on the east side
    for k in range(6):
        p = at(2.85 + k * 0.28, -0.175, FL - 0.19 * (k + 1) + 0.06)
        box(f"B_step{k}", (p.x, p.y, p.z), (0.3, 1.0, 0.05), M["planks"], (0, 0, yaw), col=True, uv_size=2.0)
    for s in (-1, 1):
        p0, p1 = at(2.6, -0.175 + s * 0.52, FL), at(4.6, -0.175 + s * 0.52, 0.0)
        beam(f"B_stringer{s}", (p0.x, p0.y, p0.z), (p1.x, p1.y, ground(p1.x, p1.y)), 0.05, 0.2, M["timber"])
    # under the house: crates, an old tyre, the ladder
    for i, (pid, dx, dy) in enumerate((("wooden_crate_01", -1.4, 0.6), ("wooden_crate_01", -1.0, 1.1), ("old_tyre", 0.8, 0.9), ("plastic_crate_01", -0.3, -1.0),
                                       ("Barrel_01", 1.6, -1.2))):
        p = at(dx, dy, 0); place(pid, (p.x, p.y), rng.uniform(0, 6), variant=i)
    p = at(-2.75, -0.6, 0); place("wooden_ladder_02", (p.x, p.y), yaw + math.pi / 2, tilt=(0.3, 0, 0))
    p = at(0, 0, 0); collider((p.x, p.y, FL + 1.2), (5.0, 4.0, 2.4), (0, 0, yaw))   # the walls (the house isn't entered)


# =====================================================================================================================
# house C — small concrete house with a broken window and a boarded one
# =====================================================================================================================
def house_c():
    cx, cy, yaw = 14.5, -12.5, math.radians(-6)
    PADS.append((cx, cy, 3.0, 2.8, 0.0))
    R = Euler((0, 0, yaw)).to_matrix()
    at = lambda dx, dy, z: Vector((cx, cy, 0)) + R @ Vector((dx, dy, 0)) + Vector((0, 0, z))
    F, top, W, D = 0.1, 2.6, 4.6, 4.0
    p = at(0, 0, F / 2); box("C_floor", p, (W + 0.3, D + 0.3, F + 0.04), M["floor"], (0, 0, yaw), col=True, uv_size=2.0)
    inside = at(0, 0, 1.2)
    for name, a, b, ops in (("w", (-W / 2, D / 2), (-W / 2, -D / 2), [(0.6, 0.9, F + 0.9, F + 1.8), (2.4, 0.85, F, F + 2.0)]),
                            ("s", (-W / 2, -D / 2), (W / 2, -D / 2), [(1.6, 1.1, F + 0.95, F + 1.8)]),
                            ("e", (W / 2, -D / 2), (W / 2, D / 2), []), ("n", (W / 2, D / 2), (-W / 2, D / 2), [(1.8, 0.8, F + 1.0, F + 1.7)])):
        A, B = at(*a, 0), at(*b, 0)
        wall(f"C_wall_{name}", (A.x, A.y), (B.x, B.y), F, top, 0.16, M["concrete"], ops, M["plaster"], inside)
    # door (closed), weathered paint
    p = at(-W / 2 - 0.01, -D / 2 + 2.4 + 0.425, F + 1.0); box("C_door", p, (0.05, 0.85, 2.0), M["peeling"], (0, 0, yaw), uv_size=0.76)
    # west window: glass with a broken corner (two shards left in the frame)
    p = at(-W / 2, D / 2 - 0.6 - 0.45, F + 1.35)
    bm = bmesh.new()
    for tri in (((0, -0.45, -0.45), (0, 0.45, -0.45), (0, 0.45, 0.45)), ((0, -0.45, -0.45), (0, -0.45, 0.2), (0, 0.05, -0.1))):
        bm.faces.new([bm.verts.new(v) for v in tri])
    mesh_obj("C_glass", bm, M["glass"], p, (0, 0, yaw), uv=False)
    for k in range(4):
        q = at(-W / 2 - 0.4 - rng.uniform(0, 0.6), D / 2 - 1.05 + rng.uniform(-0.4, 0.4), 0)
        b2 = bmesh.new(); b2.faces.new([b2.verts.new(v) for v in ((0, 0, 0), (rng.uniform(0.05, 0.12), 0, 0), (0, rng.uniform(0.05, 0.1), 0))])
        mesh_obj(f"C_shard{k}", b2, M["glass"], (q.x, q.y, ground(q.x, q.y) + 0.01), (0, 0, rng.uniform(0, 6)), uv=False)
    # north window boarded with planks
    for k in range(3):
        p = at(-W / 2 + 1.8 + 0.4, D / 2 + 0.1, F + 1.12 + k * 0.22)
        box(f"C_board{k}", p, (1.0, 0.03, 0.18), M["planks"], (rng.uniform(-0.05, 0.05), 0, yaw + rng.uniform(-0.06, 0.06)), uv_size=2.0)
    # mono roof
    roof("C_roof", at(-W / 2 - 0.5, 0, top + 0.17), yaw, math.atan2(0.32, W + 1.0), W + 1.1, D + 0.9, M["gi_grey"], 2.7 / 28, missing={5}, lifted={1})
    for i, dy in enumerate((-1.6, 0, 1.6)):
        a2, b2 = at(-W / 2 - 0.45, dy, top + 0.1), at(W / 2 + 0.45, dy, top - 0.2)
        beam(f"C_rafter{i}", a2, b2, 0.05, 0.08, M["timber"])
    # outside: barrels, crates, a broom, a plastic container
    for i, (pid, dx, dy) in enumerate((("Barrel_01", W / 2 + 0.5, 1.3), ("plastic_crate_01", W / 2 + 0.45, 0.5), ("plastic_bottle_gallon", -W / 2 - 0.45, 0.9),
                                       ("metal_jerrycan", W / 2 + 0.6, -0.4))):
        p = at(dx, dy, 0); place(pid, (p.x, p.y), rng.uniform(0, 6), variant=i, col=pid == "Barrel_01")


# =====================================================================================================================
# the damaged shelter by the road (sungka board on the bench) and the utility poles
# =====================================================================================================================
def shelter():
    cx, cy, yaw = 3.2, -26.5, math.radians(30)
    PADS.append((cx, cy, 2.2, 1.9, ground(cx, cy)))
    R = Euler((0, 0, yaw)).to_matrix(); g0 = ground(cx, cy)
    at = lambda dx, dy, z: Vector((cx, cy, 0)) + R @ Vector((dx, dy, 0)) + Vector((0, 0, g0 + z))
    lean = {3: 0.06}
    for i, (dx, dy) in enumerate(((-1.5, -1.2), (1.5, -1.2), (1.5, 1.2), (-1.5, 1.2))):
        p = at(dx, dy, 1.15); box(f"SH_post{i}", p, (0.12, 0.12, 2.3), M["timber"], (lean.get(i, 0), 0, yaw), col=True)
    for i, (a, b) in enumerate((((-1.6, -1.2), (1.6, -1.2)), ((-1.6, 1.2), (1.6, 1.2)))):
        A, B = at(*a, 2.3), at(*b, 2.3 - (0.12 if i else 0)); beam(f"SH_beam{i}", A, B, 0.1, 0.12, M["timber"])
    # thatch roof: two slopes, one corner collapsed and a patch missing
    for s in (-1, 1):
        for k in range(5):
            if s > 0 and k == 3:
                continue
            p = at(-1.75 + k * 0.85, 0, 3.05)
            o = box(f"SH_thatch{s}{k}", (0, 0, 0), (0.9, 1.75, 0.09), M["thatch"], uv_size=0.54, bevel=0.02)
            sag = 0.18 if (s < 0 and k == 4) else 0.0
            o.matrix_world = Matrix.Translation(p) @ Euler((0, 0, yaw)).to_matrix().to_4x4() @ Matrix.Translation((0, s * 0.82, -0.38 - sag)) @ Euler((s * -0.42 - sag * 0.8, 0, 0)).to_matrix().to_4x4()
    beam("SH_ridge", at(-1.8, 0, 3.08), at(1.8, 0, 3.08), 0.08, 0.08, M["timber"])
    place("painted_wooden_bench", (at(0, -0.65, 0).x, at(0, -0.65, 0).y), yaw, col=True)
    bh = LIBRARY["painted_wooden_bench"][0]["size"][2]
    p = at(0.2, -0.65, bh); place("sungka_board", (p.x, p.y), yaw + 0.1, z=p.z)
    interactable("survival-sungka", "a sungka board", "examine", p + Vector((0, 0, 0.1)), "survival-sungka", radius=1.6)
    p = at(-1.2, 0.6, 0); place("wicker_basket_02", (p.x, p.y), 0.3)


def poles():
    pts = [(3.4, -4.2), (5.2, -16.5), (12.5, -26.2), (22.5, -36.0), (28.2, -47.5), (32.6, -58.5)]
    lib = joined_variant("modular_electricity_poles", "preset_02_", "pole_preset")
    tops = []
    for i, (x, y) in enumerate(pts):
        nxt = pts[min(i + 1, len(pts) - 1)]; prv = pts[max(i - 1, 0)]
        yaw = math.atan2(nxt[1] - prv[1], nxt[0] - prv[0]) + math.pi / 2
        o = place("modular_electricity_poles:preset_02_", (x, y), yaw, tilt=(rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03)), name=f"pole{i}")
        collider((x, y, ground(x, y) + 3.0), (0.2, 0.2, 6.0))
        tops.append((Vector((x, y, ground(x, y))), yaw))
    for i in range(len(tops) - 1):
        (a, ya), (b, yb) = tops[i], tops[i + 1]
        for k, (off, h) in enumerate(((-0.45, 5.55), (0.0, 5.6), (0.45, 5.55))):
            pa = a + Euler((0, 0, ya)).to_matrix() @ Vector((off, 0, 0)) + Vector((0, 0, h))
            pb = b + Euler((0, 0, yb)).to_matrix() @ Vector((off, 0, 0)) + Vector((0, 0, h))
            catenary(f"wire{i}_{k}", pa, pb, 0.45 + 0.05 * k)
    # the service drop to house A — an old wire to the roof edge
    a, _ = tops[0]
    catenary("service_drop", a + Vector((0, 0, 4.0)), Vector((2.6, -2.9, 2.78)), 0.35, 0.005)
    catenary("service_drop2", Vector((2.6, -2.9, 2.78)), Vector((2.4, -2.3, 2.5)), 0.03, 0.005)


# =====================================================================================================================
# the road out, rocks, scattered objects, boundary
# =====================================================================================================================
def surroundings():
    for i in range(16):
        _, along = 0, 0
        t = rng.uniform(0.1, 0.98); k = int(t * (len(ROAD) - 1)); f = t * (len(ROAD) - 1) - k
        a, b = Vector(ROAD[k]), Vector(ROAD[min(k + 1, len(ROAD) - 1)]); p = a.lerp(b, f)
        side = Vector((-(b - a).y, (b - a).x)).normalized() * rng.choice((-1, 1)) * rng.uniform(2.6, 5.0)
        q = p + side
        if abs(q.x) < 8.5 and -7 < q.y < 7.5:
            continue
        pid = rng.choice(("rock_07", "rock_09", "stone_01", "rock_07"))
        place(pid, (q.x, q.y), rng.uniform(0, 6), scale=rng.uniform(0.7, 1.5), variant=i, z=ground(q.x, q.y) - 0.03)
    for i, (x, y, s) in enumerate(((-9.5, -21.0, 1.2), (24.0, -18.0, 1.6), (17.5, -40.0, 1.3), (38.5, -56.0, 1.5), (27.5, -63.0, 1.8))):
        place("boulder_01", (x, y), rng.uniform(0, 6), scale=s, col=True, z=ground(x, y) - 0.25 * s)
    place("old_tyre", (2.8, -15.5), 0.4, tilt=(1.4, 0, 0), z=ground(2.8, -15.5) + 0.05)
    place("dead_tree_trunk_02", (-7.5, -18.5), 1.2, scale=1.0)
    place("tree_stump_01", (19.0, -22.0), 2.0)
    # exit: the narrow road between the hills
    LAYOUT["exit"] = {"p": T((EXIT.x, EXIT.y, ground(EXIT.x, EXIT.y) + 1.0)), "r": 3.5, "narrativeId": "survival-road"}
    # invisible boundary: a ring of walls around the walkable area, open only along the road (which ends at the exit)
    ring = []
    for k in range(48):
        a = 2 * math.pi * k / 48
        ring.append(Vector((6 + math.cos(a) * 46 * 1.22, -18 + math.sin(a) * 40 * 1.22)))
    for k in range(48):
        a, b = ring[k], ring[(k + 1) % 48]; c = (a + b) / 2
        d, _ = path_dist(c, ROAD)
        if d < 7:
            continue
        L = (b - a).length; yaw = math.atan2(b.y - a.y, b.x - a.x)
        collider((c.x, c.y, ground(c.x, c.y) + 3), (L + 0.5, 0.6, 12.0), (0, 0, yaw))
    # the road valley beyond the ring: walls along both sides up to the exit, and a stop past it
    for s in (-1, 1):
        for i in range(len(ROAD) - 1):
            a, b = Vector(ROAD[i]), Vector(ROAD[i + 1])
            if path_dist(a, ROAD)[1] < 45:
                continue
            nrm = Vector((-(b - a).y, (b - a).x)).normalized() * s * 5.5
            c = (a + b) / 2 + nrm; L = (b - a).length; yaw = math.atan2(b.y - a.y, b.x - a.x)
            collider((c.x, c.y, ground(c.x, c.y) + 3), (L + 1, 0.6, 12), (0, 0, yaw))
    e2 = Vector((38.0, -71.0)); collider((e2.x, e2.y, ground(e2.x, e2.y) + 3), (14, 0.6, 12), (0, 0, math.atan2(ROAD[10][1] - ROAD[9][1], ROAD[10][0] - ROAD[9][0]) + math.pi / 2))


# =====================================================================================================================
# foliage: library variants exported once; instances scattered here and stored in the layout
# =====================================================================================================================
FOLIAGE_SRC = {
    "grass": ("grass_bermuda_01", None), "weed": ("weed_plant_02", None), "nettle": ("nettle_plant", None),
    "shrub": ("shrub_02", None), "shrub_small": ("shrub_03", None), "calathea": ("calathea_orbifolia_01", None),
    "anthurium": ("anthurium_botany_01", None), "sapling": ("pachira_aquatica_01", None),
}


def foliage():
    keys = {}
    for key, (pid, _) in FOLIAGE_SRC.items():
        lib = load(pid)
        names = []
        for i, src in enumerate(lib):
            o = bpy.data.objects.new(f"{key}__{i}", src.data); FOL.objects.link(o); names.append(o.name)
        keys[key] = names
    inst = {n: [] for names in keys.values() for n in names}

    def add(key, x, y, yaw, s, zoff=0.0):
        names = keys[key]; n = names[rng.randrange(len(names))]
        z = ground(x, y) + zoff
        inst[n].append([round(x, 3), round(z, 3), round(-y, 3), round(yaw, 3), round(s, 3)])

    def blocked(x, y, pad=0.4):
        for (cx, cy, hx, hy, _) in PADS:
            if abs(x - cx) < hx + pad - 0.6 and abs(y - cy) < hy + pad - 0.6:
                return True
        return False
    # grass where the splat is mostly grass
    tries = 0
    while tries < 26000:
        tries += 1
        x, y = rng.uniform(-45, 60), rng.uniform(-75, 30)
        if bowl(x, y) > 0.85 or blocked(x, y):
            continue
        mud, soil, forest = splat(x, y, 0)
        gw = 1 - mud - soil - forest
        if rng.random() > gw * gw * 0.95:
            continue
        add("grass", x, y, rng.uniform(0, 6.28), rng.uniform(0.8, 1.5))
    # weeds and nettles along fences, walls, road edges
    for i in range(900):
        x, y = rng.uniform(-40, 50), rng.uniform(-70, 25)
        mud, soil, forest = splat(x, y, 0)
        if blocked(x, y) or mud > 0.3 or bowl(x, y) > 0.9:
            continue
        near_fence = min(abs(x + 7), abs(x - 8.2), abs(y + 6.5), abs(y - 7)) < 0.6 and -7.5 < x < 8.7 and -7 < y < 7.5
        if near_fence or rng.random() < 0.35:
            add("weed" if rng.random() < 0.6 else "nettle", x, y, rng.uniform(0, 6.28), rng.uniform(0.9, 1.6))
    # shrubs and tropical leaves at the edge of the village and on the lower hills
    for i in range(420):
        x, y = rng.uniform(-45, 60), rng.uniform(-80, 32)
        b = bowl(x, y)
        if blocked(x, y, 1.2) or splat(x, y, 0)[0] > 0.2 or b > 0.95:
            continue
        if b > 0.05 or rng.random() < 0.25:
            add(rng.choice(("shrub", "shrub", "shrub_small", "calathea", "anthurium")), x, y, rng.uniform(0, 6.28), rng.uniform(0.9, 1.8))
    # young trees (Pachira / Malabar chestnut, common in Philippine yards) scaled to small-tree size
    for (x, y) in ((-8.6, 2.0), (9.6, -3.8), (-11.5, -6.0), (-19.0, -17.5), (19.5, -9.0), (10.0, -33.0), (-3.5, -21.5), (25.5, -27.0)):
        add("sapling", x, y, rng.uniform(0, 6.28), rng.uniform(2.2, 3.0))
    LAYOUT["foliage"] = {k: v for k, v in inst.items() if v}
    log("foliage", {k: len(v) for k, v in LAYOUT["foliage"].items()})


# =====================================================================================================================
mats()
house_a()
dirty_kitchen()
yard()
house_b()
house_c()
shelter()
build_terrain()  # after PADS are registered
poles()
surroundings()
foliage()

# re-snap placed props that were positioned before the pads flattened the ground (all `place` calls use ground())
log("world objects", len(WORLD.objects))

# =====================================================================================================================
# export
# =====================================================================================================================
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "survival.blend"))
with open(os.path.join(OUT, "survival-layout.json"), "w") as f:
    json.dump(LAYOUT, f, separators=(",", ":"))
log("layout", {k: (len(v) if isinstance(v, (list, dict)) else v) for k, v in LAYOUT.items()})

if not args.no_export:
    def export(coll, path):
        for o in bpy.data.objects:
            o.select_set(False)
        for o in coll.all_objects:
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=False, export_yup=True,
                                  export_animations=False, export_vertex_color="ACTIVE", export_image_format="AUTO", export_lights=False, export_cameras=False)
        log("exported", path, round(os.path.getsize(path) / 1e6, 2), "MB")
    export(WORLD, os.path.join(OUT, "survival-world.glb"))
    export(FOL, os.path.join(OUT, "survival-foliage.glb"))

if args.render:
    sc = scene
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    env = w.node_tree.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(SRC, "hdris/farmland_overcast/farmland_overcast_2k.hdr"))
    w.node_tree.links.new(env.outputs[0], w.node_tree.nodes["Background"].inputs[0])
    sc.view_settings.view_transform = "AgX"
    LIB.hide_render = True; FOL.hide_render = True
    cd = bpy.data.cameras.new("c"); cd.lens = 28; cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
    for tag, loc, tgt in (("overview", (22, -32, 16), (2, -8, 0)), ("houseA", (5, -10, 2.2), (0, 0, 1.6)), ("road", (6, -30, 2.0), (22, -42, 2.5)),
                          ("interior", (2.3, -1.7, 1.75), (-1.5, 1.2, 0.6)), ("houseB", (-8.5, -18, 2.4), (-15, -12, 2.0)), ("houseC", (7.5, -16.5, 2.0), (14, -12, 1.5))):
        cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(OUT, f"render-{tag}.png"); bpy.ops.render.render(write_still=True)
        log("rendered", tag)

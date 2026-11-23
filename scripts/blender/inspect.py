"""Prints a quick technical report of a .blend file (scale, meshes, polycounts, rigs, actions, textures).
Usage: /Applications/Blender.app/Contents/MacOS/Blender -b file.blend --python scripts/blender/inspect.py | grep "^@@"
"""
import bpy, sys
out=[]
scene=bpy.context.scene
out.append(f"FILE {bpy.data.filepath}")
out.append(f"unit scale {scene.unit_settings.scale_length} system {scene.unit_settings.system}")
arms=[o for o in bpy.data.objects if o.type=='ARMATURE']
meshes=[o for o in bpy.data.objects if o.type=='MESH']
out.append(f"objects {len(bpy.data.objects)} meshes {len(meshes)} armatures {len(arms)} actions {len(bpy.data.actions)} materials {len(bpy.data.materials)} images {len(bpy.data.images)}")
for a in arms:
    bones=[b.name for b in a.data.bones]
    out.append(f"ARMATURE {a.name} bones={len(bones)} sample={bones[:12]} dims={tuple(round(v,2) for v in a.dimensions)}")
tot=0
for m in sorted(meshes,key=lambda o:-len(o.data.polygons))[:25]:
    n=len(m.data.polygons); tot+=n
    mods=[md.type for md in m.modifiers]
    out.append(f"MESH {m.name} polys={n} dims={tuple(round(v,2) for v in m.dimensions)} parent={m.parent.name if m.parent else '-'} mods={mods} mats={[s.material.name for s in m.material_slots if s.material][:4]}")
out.append(f"total polys (all meshes) {sum(len(m.data.polygons) for m in meshes)}")
out.append("actions: "+", ".join(a.name for a in bpy.data.actions[:20]))
imgs=sorted([(i.name, i.size[0], i.size[1]) for i in bpy.data.images if i.size[0]], key=lambda x:-x[1])[:12]
out.append("images: "+"; ".join(f"{n} {w}x{h}" for n,w,h in imgs))
# custom props / asset info that might carry licence/author
for k in ('author','license','asset_data'):
    pass
for o in bpy.data.objects[:3]:
    if o.keys(): out.append(f"props {o.name}: {list(o.keys())[:8]}")
print("\n".join("@@ "+l for l in out))

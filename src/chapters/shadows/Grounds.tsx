/* The island's ground: the terrain (a walkable mesh from layout.ts groundHeight, with its collider), the overgrown
   avenue (a worn earth track whose edges break up into the grass), dry dead grass in tufts that lean in the wind,
   and an invisible ring along the cliff tops so nobody walks into the sea.
   Ground textures are the CC0 ones Chapter 01 already ships (forest floor, soil), tinted cold and desaturated. */
import { useFrame, useLoader } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useMemo } from 'react';
import {
  CanvasTexture, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D, PlaneGeometry,
  RepeatWrapping, SRGBColorSpace, TextureLoader, BufferGeometry, Vector2, type Texture,
} from 'three';
import { GROUPS } from '../../physics/CollisionLayers';
import { SURVIVAL_BASE } from '../survival/layout';
import { AVENUE, FOUNTAIN, TERRAIN_HOLES, TUNNEL, avenueDistance, groundHeight, islandRn, outlinePoint } from './layout';

const SIZE = { x: 120, z: 180, cz: -12, seg: [150, 225] as [number, number] };

function tile(t: Texture, r: number, srgb = false) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(r, r); t.anisotropy = 8; if (srgb) t.colorSpace = SRGBColorSpace; return t; }

export function Terrain() {
  const [fd, fn, sd, sn] = useLoader(TextureLoader, [
    `${SURVIVAL_BASE}/ground/forest_diff.webp`, `${SURVIVAL_BASE}/ground/forest_nor.webp`,
    `${SURVIVAL_BASE}/ground/soil_diff.webp`, `${SURVIVAL_BASE}/ground/soil_nor.webp`,
  ]);
  const geo = useMemo(() => {
    const g = new PlaneGeometry(SIZE.x, SIZE.z, ...SIZE.seg); g.rotateX(-Math.PI / 2); g.translate(0, 0, SIZE.cz);
    const p = g.attributes.position, col: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = groundHeight(x, z);
      p.setY(i, y);
      // damp, darker earth by the sea and in the hollows; a little lighter on the rises
      const shore = Math.min(1, Math.max(0, (islandRn(x, z) - 0.9) / 0.12));
      const k = 0.85 + 0.25 * Math.max(-0.4, Math.min(0.4, y)) - 0.35 * shore;
      col.push(k, k, k);
    }
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    // holes where the stairs to the passage go down through the ground
    const idx = g.index!, keep: number[] = [];
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      const cx = (p.getX(a) + p.getX(b) + p.getX(c)) / 3, cz = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
      if (TERRAIN_HOLES.some(([x0, x1, z0, z1]) => cx > x0 && cx < x1 && cz > z0 && cz < z1)) continue;
      keep.push(a, b, c);
    }
    g.setIndex(keep);
    return g;
  }, []);
  const mat = useMemo(() => new MeshStandardMaterial({
    map: tile(fd, 55, true), normalMap: tile(fn, 55), normalScale: new Vector2(0.9, 0.9), vertexColors: true,
    color: new Color('#6d7466'), roughness: 0.96,
  }), [fd, fn]);
  const path = useMemo(() => avenueGeometry(), []);
  const pathMat = useMemo(() => {
    const m = new MeshStandardMaterial({
      map: tile(sd, 1, true), normalMap: tile(sn, 1), color: new Color('#6a675f'), roughness: 0.92, transparent: true,
      alphaMap: edgeTexture(), polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false,
    });
    m.map!.repeat.set(1, 1); return m;
  }, [sd, sn]);
  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" collisionGroups={GROUPS.environment}>
        <mesh geometry={geo} material={mat} receiveShadow />
      </RigidBody>
      <mesh geometry={path} material={pathMat} receiveShadow renderOrder={1} />
      <CliffRing />
    </>
  );
}

/** the avenue as a ribbon 3.2 m wide, laid on the ground; u across (0…1), v along (one texture tile per 3 m) */
function avenueGeometry() {
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < AVENUE.length; i++) {
    const [ax, az] = AVENUE[i], [bx, bz] = AVENUE[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.8);
    for (let k = 0; k < n; k++) pts.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  pts.push(AVENUE[AVENUE.length - 1]);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let along = 0;
  const ACROSS = 6;
  pts.forEach(([x, z], i) => {
    const [nx, nz] = pts[Math.min(i + 1, pts.length - 1)], [px, pz] = pts[Math.max(i - 1, 0)];
    let dx = nx - px, dz = nz - pz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (i > 0) along += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    const w = 1.6 + 0.25 * Math.sin(along * 0.37) + 0.15 * Math.sin(along * 1.3);
    for (let j = 0; j <= ACROSS; j++) {
      const u = j / ACROSS, off = (u - 0.5) * 2 * w, X = x - dz * off, Z = z + dx * off;
      pos.push(X, groundHeight(X, Z) + 0.02, Z); uv.push(u, along / 3);
    }
    if (i > 0) for (let j = 0; j < ACROSS; j++) {
      const a = (i - 1) * (ACROSS + 1) + j, b = a + ACROSS + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** the avenue's edges: solid in the middle, breaking up into ragged patches at the sides (grass growing over it) */
function edgeTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512;
  const x = c.getContext('2d')!, img = x.createImageData(128, 512);
  for (let j = 0; j < 512; j++) for (let i = 0; i < 128; i++) {
    const u = Math.abs(i / 127 - 0.5) * 2;
    const n = 0.5 * Math.sin(j * 0.09 + i * 0.05) + 0.3 * Math.sin(j * 0.31 - i * 0.2) + 0.2 * Math.sin(j * 1.7 + i * 0.9);
    const grassy = 0.18 * (0.5 + 0.5 * Math.sin(j * 0.045) * Math.sin(i * 0.11 + j * 0.02));   // patches in the middle too
    const a = Math.max(0, Math.min(1, (0.78 + 0.16 * n - u) / 0.22)) * (1 - grassy);
    const o = (j * 128 + i) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = a * 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new CanvasTexture(c); t.wrapT = RepeatWrapping; return t;
}

/** invisible walls along the cliff tops */
function CliffRing() {
  const segs = useMemo(() => {
    const out: { p: [number, number, number]; len: number; yaw: number }[] = [];
    const N = 72;
    for (let i = 0; i < N; i++) {
      const [ax, az] = outlinePoint(0.955, (i / N) * Math.PI * 2), [bx, bz] = outlinePoint(0.955, ((i + 1) / N) * Math.PI * 2);
      // (no wall where the tunnel comes out of the cliff: it is under the ground there and must stay open)
      if (Math.hypot((ax + bx) / 2 - TUNNEL.x1, (az + bz) / 2 - (TUNNEL.z0 + TUNNEL.z1) / 2) < 7) continue;
      out.push({ p: [(ax + bx) / 2, groundHeight((ax + bx) / 2, (az + bz) / 2) + 1.5, (az + bz) / 2], len: Math.hypot(bx - ax, bz - az) / 2 + 0.3, yaw: Math.atan2(-(bz - az), bx - ax) });
    }
    return out;
  }, []);
  return (
    <RigidBody type="fixed" collisionGroups={GROUPS.environment}>
      {segs.map((s, i) => <CuboidCollider key={i} args={[s.len, 2.5, 0.25]} position={s.p} rotation={[0, s.yaw, 0]} />)}
    </RigidBody>
  );
}

// ------------------------------------------------------------------------------------------------- dead grass
/** a tuft of dry grass blades, drawn once to a canvas (pale straw and grey-brown, darker at the roots) */
function bladeTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 46; i++) {
    const bx = 20 + Math.random() * 216, lean = (Math.random() - 0.5) * 90, h = 120 + Math.random() * 130, w = 2 + Math.random() * 3.5;
    const g = x.createLinearGradient(0, 256, 0, 256 - h);
    const tone = 70 + Math.random() * 60;
    g.addColorStop(0, `rgb(${tone * 0.5},${tone * 0.48},${tone * 0.4})`);
    g.addColorStop(1, `rgb(${tone * 1.3},${tone * 1.2},${tone * 0.95})`);
    x.fillStyle = g; x.beginPath();
    x.moveTo(bx - w, 256); x.quadraticCurveTo(bx + lean * 0.3, 256 - h * 0.6, bx + lean, 256 - h); x.quadraticCurveTo(bx + lean * 0.3 + w * 0.5, 256 - h * 0.6, bx + w, 256);
    x.fill();
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}

export function DeadGrass({ count = 7000 }: { count?: number }) {
  const { mesh, mat } = useMemo(() => {
    // two crossed cards, pivot at the root
    const a = new PlaneGeometry(1, 1); a.translate(0, 0.5, 0);
    const b = a.clone(); b.rotateY(Math.PI / 2);
    const geo = new BufferGeometry();
    const pos = [...a.attributes.position.array, ...b.attributes.position.array];
    const uv = [...a.attributes.uv.array, ...b.attributes.uv.array];
    const nor: number[] = []; for (let i = 0; i < pos.length / 3; i++) nor.push(0, 1, 0);   // lit like the ground below
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new Float32BufferAttribute(uv, 2)); geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
    geo.setIndex([0, 2, 1, 2, 3, 1, 4, 6, 5, 6, 7, 5]);
    const mat = new MeshStandardMaterial({ map: bladeTexture(), alphaTest: 0.45, side: DoubleSide, color: new Color('#8d8a78'), roughness: 1 });
    const uTime = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sway = sin(uTime * 1.3 + ip.x * 0.35 + ip.z * 0.2) * 0.6 + sin(uTime * 2.9 + ip.x * 1.1) * 0.25;
          transformed.x += sway * 0.12 * position.y * position.y;
          transformed.z += sway * 0.05 * position.y * position.y;`);
    };
    mat.customProgramCacheKey = () => 'shadows_grass';
    (mat.userData as { uTime: typeof uTime }).uTime = uTime;
    const mesh = new InstancedMesh(geo, mat, count);
    const d = new Object3D(); let n = 0, tries = 0;
    while (n < count && tries++ < count * 6) {
      const x = (Math.random() - 0.5) * 84, z = -80 + Math.random() * 130;
      if (islandRn(x, z) > 0.93) continue;
      const av = avenueDistance(x, z); if (av < 1.3 || (av < 2.2 && Math.random() < 0.6)) continue;
      if (z < -48 && Math.abs(x) < 30) continue;                       // the mansion's footprint
      if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < FOUNTAIN.paved - 0.8) continue;   // the paved courtyard
      if (Math.abs(z - 24) < 0.5 && Math.abs(x) < 26) continue;        // the wall line
      const s = 0.35 + Math.random() * 0.55;
      d.position.set(x, groundHeight(x, z) - 0.03, z); d.rotation.set(0, Math.random() * Math.PI, 0); d.scale.set(s * (0.8 + Math.random() * 0.6), s, s);
      d.updateMatrix(); mesh.setMatrixAt(n++, d.matrix);
    }
    mesh.count = n; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.raycast = () => {};
    return { mesh, mat };
  }, [count]);
  useFrame((st) => { (mat.userData as { uTime: { value: number } }).uTime.value = st.clock.elapsedTime; });
  return <primitive object={mesh} />;
}

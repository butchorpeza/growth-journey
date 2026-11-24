/* Streetlights for Chapter 01, and the village's other electric lights.
   - New lamps along the walk (positions from scatter.ts): a Filipino barangay streetlight, a tapered concrete pole
     with a steel arm reaching over the path and a lamp head with a warm sodium lens. Every part is instanced, so all
     the lamps together cost a handful of draw calls. Each lens has a soft halo that blooms in the rain.
   - The existing bulbs (the gate pole, the sungka shelter, the road poles) keep their bulbs.
   - Light: real point lights are expensive (each one shades every lit pixel), so a fixed pool of POOL lights moves
     to the light sources nearest the visitor every frame. A light fades out as its source is about to drop out of
     the nearest set, so the handover is invisible; far lamps still read through their glowing lens and halo. */
import { useFrame, useLoader } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending, BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute, InstancedMesh, Matrix4,
  MeshBasicMaterial, MeshStandardMaterial, PointLight, Quaternion, RepeatWrapping, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector3,
  type Material,
} from 'three';
import { GROUPS } from '../../physics/CollisionLayers';
import { playerState } from '../../player/playerState';
import { ignoreRaycast } from '../../rendering/bvh';
import { applyWeather } from '../../rendering/weather';
import { SURVIVAL_BASE } from './layout';

export type Lamp = [number, number, number, number];   // x, ground y, z, yaw (towards the path)

/** the village's existing lights: the bulb on the pole by the gate, one in the sungka shelter, the road poles */
const BULBS: { p: [number, number, number]; intensity: number; distance: number; hidden?: boolean }[] = [
  { p: [1.03, 2.55, 2.98], intensity: 9, distance: 9 },                      // porch bulb under house A's eave, by the door
  { p: [2.3, 2.3, -1.42], intensity: 2.6, distance: 4.2, hidden: true },     // soft fill on the photo wall (no bulb)
  { p: [3.1, 4.4, 4.2], intensity: 16, distance: 16 },
  { p: [3.4, 2.25, 26.5], intensity: 7, distance: 9 },
  { p: [22.2, 5.2, 36.0], intensity: 18, distance: 17 },
  { p: [27.9, 5.2, 47.5], intensity: 18, distance: 17 },
  { p: [32.3, 5.2, 58.5], intensity: 18, distance: 17 },
];
const POOL = 6;                 // real point lights shared by all the light sources
const POLE_H = 6.4, ARM = 1.5;
const SODIUM = new Color('#ffb06a');

const BULB_MAT = new MeshBasicMaterial({ color: new Color('#ffb46a').multiplyScalar(30), toneMapped: false, fog: false });

export function Streetlights({ lamps, strength }: { lamps: Lamp[]; strength: number }) {
  const tex = useLoader(TextureLoader, ['concrete', 'iron'].flatMap((k) => [`${SURVIVAL_BASE}/housea/${k}_diff.webp`, `${SURVIVAL_BASE}/housea/${k}_nor.webp`, `${SURVIVAL_BASE}/housea/${k}_rough.webp`]));

  // ---- the lamps' geometry, one instanced mesh per part
  const parts = useMemo(() => {
    const mat = (i: number, opts: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}) => {
      const [map, normalMap, roughnessMap] = [tex[i], tex[i + 1], tex[i + 2]];
      for (const t of [map, normalMap, roughnessMap]) { t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 16; }
      map.colorSpace = SRGBColorSpace;
      const m = new MeshStandardMaterial({ map, normalMap, roughnessMap, roughness: 1, ...opts }); applyWeather(m); return m;
    };
    const concrete = mat(0, { color: 0xbdb8b0 }), steel = mat(3, { color: 0x4a4845, metalness: 0.7 });
    const lens = new MeshBasicMaterial({ color: SODIUM.clone().multiplyScalar(24), toneMapped: false, fog: false });
    // local frame: pole at the origin, the arm reaching along +z (towards the path)
    const tilt = 0.2;                                                     // the arm rises a little toward its tip
    const armMid = new Vector3(0, POLE_H - 0.35 + Math.sin(tilt) * ARM / 2, ARM / 2);
    const tip = new Vector3(0, POLE_H - 0.35 + Math.sin(tilt) * ARM, ARM * Math.cos(tilt));
    const place = (g: BufferGeometry, pos: Vector3, rot = new Euler()) => g.applyMatrix4(new Matrix4().compose(pos, new Quaternion().setFromEuler(rot), new Vector3(1, 1, 1)));
    const pole = place(new CylinderGeometry(0.085, 0.13, POLE_H, 14), new Vector3(0, POLE_H / 2, 0));
    const arm = place(new CylinderGeometry(0.03, 0.035, ARM, 10), armMid, new Euler(Math.PI / 2 - tilt, 0, 0));
    const brace = place(new CylinderGeometry(0.02, 0.02, 0.75, 8), new Vector3(0, POLE_H - 0.75, 0.32), new Euler(0.75, 0, 0));
    const clamp = place(new CylinderGeometry(0.1, 0.1, 0.16, 12), new Vector3(0, POLE_H - 0.35, 0));
    const head = place(new BoxGeometry(0.2, 0.1, 0.52), tip.clone().add(new Vector3(0, -0.02, 0.18)), new Euler(-tilt, 0, 0));
    const lensG = place(new BoxGeometry(0.15, 0.02, 0.36), tip.clone().add(new Vector3(0, -0.075, 0.2)), new Euler(-tilt, 0, 0));
    const defs: [BufferGeometry, Material][] = [[pole, concrete], [arm, steel], [brace, steel], [clamp, steel], [head, steel], [lensG, lens]];
    const matrices = lamps.map(([x, y, z, yaw]) => new Matrix4().compose(new Vector3(x, y - 0.05, z), new Quaternion().setFromEuler(new Euler(0, yaw, 0)), new Vector3(1, 1, 1)));
    const meshes = defs.map(([g, m]) => {
      const im = new InstancedMesh(g, m, Math.max(1, lamps.length));
      matrices.forEach((mx, i) => im.setMatrixAt(i, mx));
      im.count = lamps.length; im.castShadow = m !== lens; im.receiveShadow = true; im.computeBoundingSphere(); ignoreRaycast(im);
      return im;
    });
    // where each lamp's light sits: just under its lens
    const lensAt = matrices.map((mx) => tip.clone().add(new Vector3(0, -0.35, 0.2)).applyMatrix4(mx));
    return { meshes, lensAt };
  }, [tex, lamps]);

  // ---- soft halos around every lens and bulb (additive points; bloom does the rest)
  const sources = useMemo(() => [
    ...parts.lensAt.map((p) => ({ p, intensity: 22, distance: 19 })),
    ...BULBS.map((b) => ({ p: new Vector3(...b.p), intensity: b.intensity, distance: b.distance, hidden: b.hidden })),
  ], [parts]);
  const halo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(sources.filter((s) => !('hidden' in s && s.hidden)).flatMap((s) => [s.p.x, s.p.y + 0.3, s.p.z]), 3));
    const m = new ShaderMaterial({
      uniforms: { uColor: { value: SODIUM.clone().multiplyScalar(1.6) }, uStrength: { value: strength } },
      vertexShader: 'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 900.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uStrength; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = exp(-d * d * 5.0) * 0.35 * uStrength; if (a < 0.003) discard; gl_FragColor = vec4(uColor * a, a); }',
      transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
    });
    return { g, m };
  }, [sources, strength]);

  // ---- the light pool: POOL real lights on the sources nearest the visitor
  const pool = useRef<(PointLight | null)[]>([]);
  useFrame(() => {
    const p = playerState.position;
    const ranked = sources.map((s, i) => ({ i, d: s.p.distanceTo(p) })).sort((a, b) => a.d - b.d);
    const cut = ranked[POOL]?.d ?? Infinity;                             // the first source that has no light
    for (let k = 0; k < POOL; k++) {
      const L = pool.current[k], r = ranked[k]; if (!L) continue;
      if (!r) { L.intensity = 0; continue; }
      const s = sources[r.i];
      L.position.copy(s.p); L.distance = s.distance;
      L.intensity = s.intensity * strength * Math.min(1, Math.max(0, (cut - r.d) / 4));   // fade before handing over
    }
  });

  return (
    <>
      {parts.meshes.map((m) => <primitive key={m.uuid} object={m} />)}
      {BULBS.filter((b) => !b.hidden).map((b, i) => <mesh key={i} position={b.p} material={BULB_MAT} raycast={() => {}}><sphereGeometry args={[0.07, 12, 8]} /></mesh>)}
      <points geometry={halo.g} material={halo.m} frustumCulled={false} raycast={() => {}} />
      {Array.from({ length: POOL }, (_, k) => (
        <pointLight key={k} ref={(l) => { pool.current[k] = l; }} color={SODIUM} intensity={0} distance={18} decay={2} />
      ))}
      <RigidBody type="fixed" colliders={false} collisionGroups={GROUPS.environment}>
        {lamps.map(([x, y, z], i) => <CuboidCollider key={i} args={[0.14, POLE_H / 2, 0.14]} position={[x, y + POLE_H / 2, z]} collisionGroups={GROUPS.environment} />)}
      </RigidBody>
    </>
  );
}

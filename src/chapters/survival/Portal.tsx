/* The end of Chapter 01: a demonic portal where the road leaves the village, the threshold to Chapter 02 (The
   Shadows). A cut-stone gate on stepped blocks ("Portal Frame" by soidev, Sketchfab, CC-BY 4.0, credited in
   CREDITS.md) whose carved runes burn red; its doorway is filled by a vortex (black centre bleeding to crimson, a
   burning red-orange rim, slowly swirling fbm noise). A pulsing red light colours the wet stone, the ground, the
   banana leaves and the puddles; embers drift up; and a demonic sound (AudioEngine.setPortal: drone, growl,
   whispers, groans) grows as the visitor approaches and sits where the portal is. Emissive values are HDR so the
   bloom makes it burn. */
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial, PointLight, Points, ShaderMaterial, Vector3, type Mesh as MeshT, type Object3D } from 'three';
import { audio } from '../../audio/AudioEngine';
import { GROUPS } from '../../physics/CollisionLayers';
import { playerState } from '../../player/playerState';
import { placeModel, terrainHeight, type PlacedHouse } from './Houses';
import { SURVIVAL_BASE } from './layout';
import { PORTAL } from './path';

// the frame model is 321 × 383 units with a doorway 160 wide from 76 to 340 up (measured from its geometry);
// at this scale: a 5.2 × 6.2 m gate, a 2.6 × 4.3 m doorway standing on 1.2 m of steps
const FRAME_SCALE = 0.01625;
const DOOR = { bottom: (76 - 0.33) * FRAME_SCALE, height: 264 * FRAME_SCALE, width: 160 * FRAME_SCALE };

/** load and place the stone gate (its box goes to the physics and the scatter, so plants keep clear) */
export function usePortalFrame(terrain: MeshT | null): PlacedHouse {
  const src = useGLTF(`${SURVIVAL_BASE}/vehicles/portal_frame.glb`, false, true).scene;
  return useMemo(() => {
    const [ax, az] = PORTAL.at, yaw = Math.atan2(PORTAL.facing[0] - ax, PORTAL.facing[1] - az);
    const placed = placeModel(src, { at: PORTAL.at, yaw, scale: FRAME_SCALE, sink: 0.25 }, terrainHeight(terrain), 'portal-frame', 'portal');
    placed.object.traverse((o: Object3D) => {
      const m = (o as MeshT).material as MeshStandardMaterial | undefined;
      if (m?.emissiveMap) { m.emissive = new Color('#ff2a0a'); m.emissiveIntensity = 6; }   // the carved runes burn
    });
    return placed;
  }, [src, terrain]);
}

const VORTEX_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  // the quad fills the doorway; its edges run into the stone, so it needs no outline of its own
  vec2 p = vUv * 2.0 - 1.0;
  vec2 e = p * vec2(1.0, 1.65);                                  // the doorway is 1.65× taller than wide
  float r = length(e) / 1.65;
  float ang = atan(e.y, e.x);
  // swirl: the angle twists more toward the centre and turns with time
  float sw = ang + 2.6 / (r * 1.6 + 0.25) - uTime * 0.55;
  vec2 q = vec2(cos(sw), sin(sw)) * r * 4.0;
  float n = fbm(q + vec2(uTime * 0.15, -uTime * 0.1));
  float bands = smoothstep(0.35, 0.85, n);
  vec3 black = vec3(0.01, 0.0, 0.0), crimson = vec3(1.6, 0.05, 0.02), ember = vec3(3.2, 0.55, 0.08);
  vec3 c = mix(black, crimson, smoothstep(0.05, 0.75, r) * (0.35 + bands));
  float edge = max(abs(p.x), abs(p.y));                          // the burning rim against the stone
  float rim = smoothstep(0.72, 0.98, edge) * (0.7 + 0.6 * n);
  c = mix(c, ember, rim);
  c += crimson * 0.35 * smoothstep(0.5, 0.0, r) * bands;          // veins of red deep inside
  gl_FragColor = vec4(c, 1.0);
}`;

const EMBERS = 90;

export function Portal({ frame }: { frame: PlacedHouse }) {
  const light = useRef<PointLight>(null);
  const vortex = useRef<Mesh>(null);
  const embers = useRef<Points>(null);
  const camera = useThree((st) => st.camera);
  const tmp = useMemo(() => new Vector3(), []);
  const at = PORTAL.at;
  useEffect(() => () => audio.setPortal(0), []);           // silence it when the chapter goes away

  const vortexMat = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, side: DoubleSide, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: VORTEX_FRAG,
  }), []);

  const emberGeo = useMemo(() => {
    const g = new BufferGeometry(), pos = new Float32Array(EMBERS * 3), seed = new Float32Array(EMBERS);
    for (let i = 0; i < EMBERS; i++) { pos.set([(Math.random() - 0.5) * DOOR.width * 0.9, 0, (Math.random() - 0.5) * 0.9], i * 3); seed[i] = Math.random(); }
    g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
    return g;
  }, []);
  const emberMat = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
    vertexShader: /* glsl */ `attribute float aSeed; uniform float uTime; varying float vA;
      void main() { vec3 p = position; float t = mod(uTime * (0.25 + aSeed * 0.35) + aSeed * 7.0, 1.0);
        p.y = t * 5.2; p.x += sin(uTime * 1.3 + aSeed * 20.0) * 0.35 * t; vA = sin(t * 3.14159);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (2.0 + aSeed * 3.0) * (12.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `varying float vA; void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
      gl_FragColor = vec4(vec3(3.0, 0.5, 0.08) * vA * (1.0 - d * 2.0), vA); }`,
  }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    vortexMat.uniforms.uTime.value = t; emberMat.uniforms.uTime.value = t;
    if (light.current) light.current.intensity = 60 * (0.82 + 0.12 * Math.sin(t * 2.3) + 0.06 * Math.sin(t * 7.1 + 1.3));
    if (vortex.current) vortex.current.scale.setScalar(1 + 0.01 * Math.sin(t * 1.7));
    // the sound: louder as you come closer, and heard from where the portal is in the view
    const d = Math.hypot(playerState.position.x - at[0], playerState.position.z - at[1]);
    tmp.set(at[0], frame.box.p[1], at[1]).applyMatrix4(camera.matrixWorldInverse);
    audio.setPortal(Math.max(0, 1 - d / 45), tmp.x / Math.max(1, Math.hypot(tmp.x, tmp.z)));
  });

  const base = frame.object.position;
  return (
    <>
      <primitive object={frame.object} />
      <RigidBody type="fixed" colliders={false} collisionGroups={GROUPS.environment}>
        <CuboidCollider args={frame.box.h} position={frame.box.p} quaternion={frame.box.q} collisionGroups={GROUPS.environment} />
      </RigidBody>
      <group position={base} quaternion={frame.object.quaternion}>
        {/* the vortex fills the doorway, set in the middle of the wall's thickness */}
        <mesh ref={vortex} material={vortexMat} position={[0, DOOR.bottom + DOOR.height / 2, 0]} raycast={() => {}}>
          <planeGeometry args={[DOOR.width + 0.25, DOOR.height + 0.2]} />
        </mesh>
        <points ref={embers} geometry={emberGeo} material={emberMat} position={[0, DOOR.bottom, 0.3]} raycast={() => {}} />
        {/* red light spilling out of the doorway onto the steps, the ground and the plants around it */}
        <pointLight ref={light} position={[0, DOOR.bottom + 1.8, 1.6]} color={new Color('#ff1a0a')} intensity={60} distance={26} decay={2} />
        <pointLight position={[0, DOOR.bottom + 0.4, -1.4]} color="#ff2a10" intensity={14} distance={10} decay={2} />
      </group>
    </>
  );
}

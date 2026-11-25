/* The village's animals: "Labrador dog" by I-I-love-my-dog-Dixie and "An Animated Cat" by Evil_Katz (Sketchfab,
   CC-BY 4.0, credited in CREDITS.md).
   - The dog (K9) lies in the front yard beside the walk from the door to the gate, under the gate pole's light. It drifts between
     four resting clips (lying, shifting, settling, dozing), crossfading from one to the next.
   - The cat sits on the bench of the sungka shelter, grooming (its one clip, looped). The bench top is found by
     probing the scene, so the cat sits on the real seat.
   Both are scaled to real size from their skinned bounds and set on the surface below them; they cast shadows, take
   the weather, and never block interaction raycasts. */
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { getGame } from '../../game/GameState';
import { Quaternion as Q } from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, CanvasTexture, Group, LoopOnce, LoopRepeat, MathUtils, MeshBasicMaterial, Raycaster, SRGBColorSpace, Vector3, type AnimationAction, type Mesh, type MeshStandardMaterial, type Object3D, type Texture } from 'three';
import { Interactable } from '../../interactions/Interactable';
import { openDiscovery } from './Discoveries';

const HIT = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ignoreRaycast } from '../../rendering/bvh';
import { applyWeather } from '../../rendering/weather';
import { SURVIVAL_BASE } from './layout';

/* While its panel is open an animal notices the visitor: its head turns toward the camera (shared over the neck and
   head bones, about the world's vertical axis, so it works whatever the bones' own axes), lifts a little, and the
   dog wags its tail. It is added on top of the playing animation every frame and eases in and out; a bone the clip
   doesn't drive gets its previous addition undone first, so nothing accumulates. */
type Attention = { id: string; neck: string[]; tail: string[]; lift: number; wag: number };
function useAttention(model: Object3D, a: Attention) {
  const st = useRef({ k: 0, t: 0, last: new Map<Object3D, { base: Q; out: Q }>() });
  const bones = useMemo(() => {
    const find = (n: string) => { let b: Object3D | null = null; model.traverse((o) => { if (!b && o.name === n) b = o; }); return b as Object3D | null; };
    return { neck: a.neck.map(find).filter(Boolean) as Object3D[], tail: a.tail.map(find).filter(Boolean) as Object3D[] };
  }, [model, a.neck, a.tail]);
  const tmp = useMemo(() => ({ up: new Vector3(0, 1, 0), axis: new Vector3(), pq: new Q(), r: new Q(), p0: new Vector3(), p1: new Vector3(), cam: new Vector3() }), []);
  useFrame(({ camera }, rawDt) => {
    const s = st.current, dt = Math.min(Math.max(rawDt, 0), 0.1);
    const want = getGame().reading === a.id ? 1 : 0;
    s.k += (want - s.k) * (1 - Math.exp(-(want ? 2.5 : 1.5) * dt)); s.t += dt;
    if (s.k < 0.002 || bones.neck.length < 2) return;
    // undo last frame's addition on bones the animation didn't overwrite
    for (const [b, q] of s.last) if (b.quaternion.equals(q.out)) b.quaternion.copy(q.base);
    s.last.clear();
    // the head's facing (neck → head) and the direction to the camera, both flat: the yaw between them
    const [n0, head] = [bones.neck[0], bones.neck[bones.neck.length - 1]];
    n0.getWorldPosition(tmp.p0); head.getWorldPosition(tmp.p1); camera.getWorldPosition(tmp.cam);
    const f = Math.atan2(tmp.p1.x - tmp.p0.x, tmp.p1.z - tmp.p0.z), c = Math.atan2(tmp.cam.x - tmp.p1.x, tmp.cam.z - tmp.p1.z);
    const yaw = MathUtils.clamp(Math.atan2(Math.sin(c - f), Math.cos(c - f)), -0.9, 0.9) * s.k;
    const add = (b: Object3D, axisWorld: Vector3, angle: number) => {
      b.parent!.getWorldQuaternion(tmp.pq);
      tmp.axis.copy(axisWorld).applyQuaternion(tmp.pq.invert()).normalize();
      const base = b.quaternion.clone();
      b.quaternion.premultiply(tmp.r.setFromAxisAngle(tmp.axis, angle));
      s.last.set(b, { base, out: b.quaternion.clone() });
    };
    for (const b of bones.neck) add(b, tmp.up, yaw / bones.neck.length);
    if (a.lift) { const side = new Vector3(Math.cos(c), 0, -Math.sin(c)); add(head, side, -a.lift * s.k); }
    bones.tail.forEach((b, i) => add(b, tmp.up, Math.sin(s.t * 9 - i * 0.6) * a.wag * s.k));
  });
}
const DOG_ATTENTION: Attention = { id: 'survival-k9', neck: ['Neck02_041_48', 'Head_043_50'], tail: ['Tail01_09_15', 'Tail02_00_16', 'Tail03_010_17'], lift: 0.18, wag: 0.28 };
const CAT_ATTENTION: Attention = { id: 'survival-cat', neck: ['j_neck_1_07_18', 'j_head_08_19'], tail: [], lift: 0.12, wag: 0 };

/** height of the first visible upward-facing surface below (x, z), searched from `from` metres down */
function surfaceBelow(root: Object3D, x: number, z: number, from: number) {
  const ray = new Raycaster(); (ray as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = false; ray.far = from + 5;
  ray.set(new Vector3(x, from, z), new Vector3(0, -1, 0));
  const hit = ray.intersectObject(root, true).find((h) => h.object.visible && h.face && h.face.normal.y > 0.5);
  return hit ? hit.point.y : null;
}

/** a skinned model clone, scaled so its longest horizontal side is `length` metres, its base at y = 0 */
function useCreature(url: string, length: number) {
  const gltf = useGLTF(url, false, true);
  const model = useMemo(() => {
    const inner = cloneSkinned(gltf.scene);
    inner.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => applyWeather(mm));
      ignoreRaycast(m);
    });
    inner.updateMatrixWorld(true);
    const box = new Box3().setFromObject(inner, true), size = box.getSize(new Vector3());
    const k = length / Math.max(size.x, size.z);
    inner.scale.multiplyScalar(k);
    inner.updateMatrixWorld(true);
    const b2 = new Box3().setFromObject(inner, true), c = b2.getCenter(new Vector3());
    inner.position.sub(new Vector3(c.x, b2.min.y, c.z));
    const outer = new Group(); outer.add(inner);
    return outer;
  }, [gltf.scene, length]);
  return { model, animations: gltf.animations };
}

export function Animals({ world }: { world: Object3D }) {
  return (
    <>
      <Dog world={world} />
      <Cat world={world} />
    </>
  );
}

function Dog({ world }: { world: Object3D }) {
  const { model, animations } = useCreature(`${SURVIVAL_BASE}/animals/dog.glb`, 0.95);
  useMemo(() => model.traverse((o) => { const m = (o as Mesh).material as MeshStandardMaterial | undefined; if ((o as Mesh).isMesh && m?.map) m.map = recolour(m.map, 'k9-coat', k9Coat); }), [model]);
  const group = useRef<Group>(null);
  const { actions, names, mixer } = useAnimations(animations, group);
  useAttention(model, DOG_ATTENTION);                 // looks up at the visitor and wags while his panel is open
  // in the front yard, right of the walk from the door to the gate, under the gate pole's light, facing the path:
  // in view as the visitor walks out (beside the door, the open door hid him)
  const spot = useMemo(() => ({ x: 2.1, z: 5.9, y: surfaceBelow(world, 2.1, 5.9, 1.5) ?? 0 }), [world]);
  const react = useRef<() => void>(() => {});
  useEffect(() => {
    if (!names.length) return;
    let i = 0, current: AnimationAction | null = null;
    // E at K9: he shifts and lifts his head (the lying one-off clip) straight away, then carries on resting
    react.current = () => {
      const a = actions[names.find((n) => /lay_one_off_01/.test(n)) ?? names[0]];
      if (!a || a === current) return;
      a.reset(); a.setLoop(LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 1;
      if (current) a.crossFadeFrom(current, 0.5, false); a.play(); current = a;
    };
    const next = () => {
      const a = actions[names[i % names.length]]; i++;
      if (!a) return;
      a.reset(); a.setLoop(LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 0.9 + Math.random() * 0.2;
      if (current) a.crossFadeFrom(current, 0.8, false); a.play();
      current = a;
    };
    const onFinish = () => next();
    mixer.addEventListener('finished', onFinish);
    next();
    return () => { mixer.removeEventListener('finished', onFinish); mixer.stopAllAction(); };
  }, [actions, names, mixer]);
  return (
    <>
      <group ref={group} position={[spot.x, spot.y, spot.z]} rotation-y={-2.3}><primitive object={model} /></group>
      <Interactable id="survival-k9" label="K9" verb="greet" reach={4.2} onInteract={() => { react.current(); openDiscovery('survival-k9'); }} position={[spot.x, spot.y + 0.3, spot.z]}>
        <mesh material={HIT}><boxGeometry args={[0.95, 0.55, 0.45]} /></mesh>
      </Interactable>
    </>
  );
}

/* Butch's own animals: K9 is a red-brown dog with a cream chest, the cat a ginger tabby. The models are a pale tan
   Labrador and a dark grey cat, so their fur is recoloured once, when they load: each texel's brightness is mapped
   onto the animal's own palette, so the fur's shading and stripes carry over, while the eyes, nose, mouth, tongue,
   pads and teeth (the strongly coloured, very dark or very bright parts) are left as they are. The model files are
   unchanged. */
type Pixel = { r: number; g: number; b: number; lum: number; sat: number; hue: number; x: number; y: number };
const recoloured = new WeakMap<Texture, Map<string, Texture>>();
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
function recolour(src: Texture, key: string, paint: (p: Pixel) => number[] | null): Texture {
  const byKey = recoloured.get(src) ?? new Map<string, Texture>(); recoloured.set(src, byKey);
  const done = byKey.get(key); if (done) return done;
  const img = src.image as CanvasImageSource & { width: number; height: number };
  if (!img?.width) return src;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height), d = data.data, w = c.width, h = c.height;
  const p = { r: 0, g: 0, b: 0, lum: 0, sat: 0, hue: 0, x: 0, y: 0 };
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2], max = Math.max(r, gg, b), min = Math.min(r, gg, b), span = max - min;
    let hue = 0;
    if (span) hue = max === r ? ((gg - b) / span + 6) % 6 : max === gg ? (b - r) / span + 2 : (r - gg) / span + 4;
    p.r = r; p.g = gg; p.b = b; p.lum = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255; p.sat = max ? span / max : 0; p.hue = hue * 60;
    p.x = ((i / 4) % w) / w; p.y = Math.floor(i / 4 / w) / h;
    const col = paint(p);
    if (col) { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; }
  }
  g.putImageData(data, 0, 0);
  const t = new CanvasTexture(c);
  t.flipY = src.flipY; t.wrapS = src.wrapS; t.wrapT = src.wrapT; t.colorSpace = SRGBColorSpace; t.anisotropy = src.anisotropy; t.channel = src.channel;
  byKey.set(key, t);
  return t;
}

// the cat: ginger tabby (deep orange stripes → ginger → cream); whiskers white
const STRIPE = [122, 52, 16], GINGER = [217, 138, 61], CREAM = [242, 210, 160], WHISKER = [244, 239, 230];
const gingerCoat = (p: Pixel) => {
  if (p.sat >= 0.18 || p.lum <= 0.006 || p.lum >= 0.6) return null;              // eyes, nose, tongue, teeth; pupils
  const t = Math.pow(Math.min(1, Math.max(0, (p.lum - 0.03) / 0.3)), 0.8);
  return t < 0.75 ? mix(STRIPE, GINGER, t / 0.75) : mix(GINGER, CREAM, (t - 0.75) / 0.25);
};
const gingerTufts = (p: Pixel) => (p.x > 0.6 && p.y < 0.62 ? WHISKER : mix(STRIPE, GINGER, p.lum * 1.3));
// K9: red-brown (deep brown shade → rust → light tan → cream on the chest)
const K9_SHADE = [80, 40, 18], K9_RUST = [176, 98, 50], K9_TAN = [216, 152, 96], K9_CREAM = [236, 208, 166];
const k9Coat = (p: Pixel) => {
  const pink = p.sat > 0.25 && (p.hue > 320 || p.hue < 18);                        // mouth, tongue, gums
  if (pink || p.lum < 0.13) return null;                                         // ... and eyes, nose, pads
  const t = Math.min(1, Math.max(0, (p.lum - 0.25) / 0.62));
  return t < 0.55 ? mix(K9_SHADE, K9_RUST, t / 0.55) : t < 0.85 ? mix(K9_RUST, K9_TAN, (t - 0.55) / 0.3) : mix(K9_TAN, K9_CREAM, (t - 0.85) / 0.15);
};

function Cat({ world }: { world: Object3D }) {
  const { model, animations } = useCreature(`${SURVIVAL_BASE}/animals/cat.glb`, 0.46);
  useMemo(() => model.traverse((o) => { const m = (o as Mesh).material as MeshStandardMaterial | undefined; if ((o as Mesh).isMesh && m?.map) m.map = m.transparent ? recolour(m.map, 'cat-tufts', gingerTufts) : recolour(m.map, 'cat-coat', gingerCoat); }), [model]);
  const group = useRef<Group>(null);
  const { actions, names } = useAnimations(animations, group);
  useAttention(model, CAT_ATTENTION);                 // glances up at the visitor while its panel is open
  // on the sungka shelter's bench seat, at the end away from the sungka board: the probe maps the bench's surfaces,
  // takes the seat's height (the commonest one in seat range; the armrests and backrest stand higher), keeps only
  // points with seat all round them (never an edge or an armrest top), and picks the one furthest from the board
  const spot = useMemo(() => {
    const ground = surfaceBelow(world, 3.4, 27.6, 0.25) ?? 0;
    let board: Vector3 | null = null;
    world.traverse((o) => { const m = o as Mesh; if (m.isMesh && (m.material as { name?: string })?.name === 'sungka_board') board = m.getWorldPosition(new Vector3()); });
    const step = 0.05, cells = new Map<string, number>(), key = (i: number, j: number) => `${i},${j}`;
    const heights: number[] = [];
    for (let i = -28; i <= 28; i++) for (let j = -16; j <= 16; j++) {
      const y = surfaceBelow(world, 3.4 + i * step, 27.0 + j * step, 1.6);
      if (y === null || y - ground < 0.4 || y - ground > 0.7) continue;
      cells.set(key(i, j), y); heights.push(Math.round(y * 50) / 50);
    }
    const counts = new Map<number, number>(); heights.forEach((h) => counts.set(h, (counts.get(h) ?? 0) + 1));
    const seatY = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    let best: { x: number; z: number; y: number } | null = null, bestD = -1;
    if (seatY !== undefined) for (const [k, y] of cells) {
      if (Math.abs(y - seatY) > 0.015) continue;
      const [i, j] = k.split(',').map(Number);
      if (![[2, 0], [-2, 0], [0, 2], [0, -2]].every(([a, b]) => Math.abs((cells.get(key(i + a, j + b)) ?? -9) - seatY) < 0.015)) continue;   // 10 cm of seat all round
      const x = 3.4 + i * step, z = 27.0 + j * step, b = board as Vector3 | null;
      const d = b ? Math.hypot(x - b.x, z - b.z) : -Math.hypot(x - 2.8, z - 27.2);
      if (d > bestD) { bestD = d; best = { x, z, y }; }
    }
    // facing the board, so it sits lengthwise on the seat (across it, its tail hung through the backrest). The model
    // faces +1.69 rad (atan2 x, z) at rotation 0, measured from its head and tail bones.
    const b = board as Vector3 | null, at = best ?? { x: 2.2, z: 27.6, y: ground };
    // its body is ~0.46 m long: centred 17 cm in from the seat's end, its hindquarters stay on the bench
    if (b && best) { const dx = b.x - at.x, dz = b.z - at.z, len = Math.hypot(dx, dz) || 1; at.x += (dx / len) * 0.17; at.z += (dz / len) * 0.17; }
    const yaw = b ? Math.atan2(b.x - at.x, b.z - at.z) - 1.69 : -0.4;
    return { ...at, yaw };
  }, [world]);
  useEffect(() => {
    const a = actions[names[0]]; if (!a) return;
    a.setLoop(LoopRepeat, Infinity); a.play();
    return () => { a.stop(); };
  }, [actions, names]);
  return (
    <>
      <group ref={group} position={[spot.x, spot.y, spot.z]} rotation-y={spot.yaw}><primitive object={model} /></group>
      <Interactable id="survival-cat" label="the cat" verb="watch" reach={5} onInteract={() => openDiscovery('survival-cat')} position={[spot.x, spot.y + 0.2, spot.z]}>
        <mesh material={HIT}><boxGeometry args={[0.5, 0.4, 0.5]} /></mesh>
      </Interactable>
    </>
  );
}

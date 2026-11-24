/* The golden guiding trail: small warm motes hovering just above the ground along the walk (the same route as the
   scroll path: past the oil lamp and the photo wall, out of the door and the yard gate, past the sungka shelter and
   along the road to the portal), so it never leads into a fence or a wall. Slow pulses of light travel forward along
   it; it is brighter ahead of the visitor, fades away behind them and in the distance, and is gone entirely with the
   "Guiding trail: Off" setting. With reduced motion it is still. One draw call, no lights (bloom does the glow). */
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { AdditiveBlending, BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Raycaster, ShaderMaterial, Vector3, type Object3D } from 'three';
import { getGame, useGame } from '../../game/GameState';
import { lookFor } from '../../rendering/looks';
import { playerState } from '../../player/playerState';
import { SURVIVAL_PATH } from './path';

const SPACING = 0.2;                 // metres between motes along the path

export function Trail({ world }: { world: Object3D }) {
  const on = useGame((s) => s.settings.guide);
  const dpr = useThree((s) => s.viewport.dpr);
  const data = useMemo(() => {
    const curve = new CatmullRomCurve3(SURVIVAL_PATH.map((w) => new Vector3(w.at[0], 0, w.at[1])), false, 'centripetal');
    const len = curve.getLength(), n = Math.floor(len / SPACING);
    const pts = curve.getSpacedPoints(n);
    const ray = new Raycaster(); ray.far = 10; const down = new Vector3(0, -1, 0), o = new Vector3();
    const groundAt = (x: number, z: number) => {
      ray.set(o.set(x, 2.6, z), down);                                // from below the roofs, like the scroll path
      const hit = ray.intersectObject(world, true).find((h) => h.object.visible && h.face && h.face.normal.y > 0.3);
      return hit ? hit.point.y : 0;
    };
    const pos: number[] = [], along: number[] = [], seed: number[] = [];
    let r = 9;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], d = pts[i + 1].clone().sub(p).normalize(), side = new Vector3(-d.z, 0, d.x);
      for (let k = 0; k < 2; k++) {                                     // two loose lines of motes, a little apart
        const off = (k === 0 ? -1 : 1) * (0.14 + rnd() * 0.12), x = p.x + side.x * off + (rnd() - 0.5) * 0.08, z = p.z + side.z * off + (rnd() - 0.5) * 0.08;
        pos.push(x, groundAt(x, z) + 0.05 + rnd() * 0.06, z); along.push(i * SPACING); seed.push(rnd());
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aS', new Float32BufferAttribute(along, 1));
    g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
    g.computeBoundingSphere();
    // in daylight a faint additive glow vanishes against the bright mud: stronger the brighter the sky
    const gain = 1 + 4 * Math.max(0, lookFor('survival').sky.envIntensity - 0.12);
    const mat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOn: { value: 1 }, uPlayerS: { value: 0 }, uColor: { value: new Color('#e3a04e').multiplyScalar(2.8 * gain) }, uPx: { value: dpr } },
      vertexShader: /* glsl */ `
        attribute float aS; attribute float aSeed;
        uniform float uTime, uOn, uPlayerS, uPx;
        varying float vA;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          float d = distance(cameraPosition, world.xyz);
          // a pulse every 9 m, travelling forward at 1.6 m/s: a bright head with a soft tail
          float w = fract((aS - uTime * 1.6) / 9.0);
          float pulse = smoothstep(0.0, 0.03, w) * (1.0 - smoothstep(0.03, 0.22, w));
          float twinkle = 0.85 + 0.15 * sin(uTime * 2.3 + aSeed * 31.0);
          float ahead = smoothstep(-4.0, 2.0, aS - uPlayerS);            // fades away behind the visitor
          vA = (0.32 + 1.0 * pulse) * twinkle * ahead * (1.0 - smoothstep(14.0, 30.0, d)) * smoothstep(0.5, 1.4, d) * uOn;
          vec4 mv = viewMatrix * world;
          gl_PointSize = min((5.0 + aSeed * 5.0) * uPx * (6.0 / max(-mv.z, 0.5)) * (1.0 + pulse * 0.7), 40.0 * uPx);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = exp(-r * r * 3.5) * vA;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor * a, a);
        }`,
      transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
    });
    return { g, mat, pts };
  }, [world, dpr]);

  let frame = 0;
  useFrame((_, dt) => {
    const u = data.mat.uniforms, reduced = getGame().settings.reducedMotion;
    if (!reduced) u.uTime.value += Math.min(Math.max(dt, 0), 0.1);
    u.uOn.value += ((on ? 1 : 0) - u.uOn.value) * Math.min(1, dt * 3);
    // the visitor's position along the trail (nearest sample), refreshed a few times a second
    if (frame++ % 10 === 0) {
      const p = playerState.position; let best = 0, bd = Infinity;
      data.pts.forEach((q, i) => { const dd = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (dd < bd) { bd = dd; best = i; } });
      u.uPlayerS.value = best * SPACING;
    }
  });
  return <points geometry={data.g} material={data.mat} frustumCulled={false} raycast={() => {}} visible={on || data.mat.uniforms.uOn.value > 0.01} />;
}

/* Rain: thin streaks animated entirely on the GPU (one instanced quad per drop). The drops live in a box that wraps
   around the camera, so it always rains all around the visitor without ever spawning or killing particles; they fall
   at ~9 m/s with a little speed variation, slant with the wind, and fade with distance. Anything below the
   shelter map's height (a roof, an eave) hides the drop, so no rain falls inside the houses. Streak length stands in
   for a camera's motion blur; streaks are alpha-blended (not additive) so they also read against a bright overcast
   sky. Count: high 9000, medium 5000, low 2500. */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { NormalBlending, Color, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, Vector3 } from 'three';
import { weather } from './weather';

const RADIUS = 13, HEIGHT = 12;   // a tighter box = denser rain where it is actually seen

export function Rain({ intensity, quality, color = '#e9eef0' }: { intensity: number; quality: 'high' | 'medium' | 'low'; color?: string }) {
  const camera = useThree((s) => s.camera);
  const count = Math.round((quality === 'high' ? 9000 : quality === 'medium' ? 5000 : 2500) * intensity);

  const mesh = useMemo(() => {
    const g = new InstancedBufferGeometry();
    // a unit streak: x across (-0.5…0.5), y along (0 = bottom … 1 = top)
    g.setAttribute('position', new Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    g.setAttribute('aSeed', new InstancedBufferAttribute(seed, 4));
    g.instanceCount = count;
    const mat = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: NormalBlending,   // normal blend: visible against a bright sky too
      uniforms: {
        uTime: { value: 0 }, uCam: { value: new Vector3() }, uColor: { value: new Color(color) }, uWind: { value: new Vector3(1.2, 0, 0.5) },
        uShelter: weather.shelterMap, uRect: weather.shelterRect, uOpacity: { value: 0.5 * intensity },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime; uniform vec3 uCam, uWind; uniform sampler2D uShelter; uniform vec3 uRect;
        varying float vFade; varying float vAlong;
        const float R = ${RADIUS.toFixed(1)}, H = ${HEIGHT.toFixed(1)};
        float shelterY(vec2 xz) {
          vec2 uv = vec2(xz.x - uRect.x, uRect.y - xz.y) / uRect.z;
          if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return -1e4;
          return texture2D(uShelter, uv).r;
        }
        void main() {
          float speed = 8.5 + aSeed.w * 2.0;
          // world-fixed drop positions, wrapped into a box around the camera
          vec3 p = vec3(aSeed.x * 2.0 * R, mod(aSeed.y * H - uTime * speed, H), aSeed.z * 2.0 * R);
          p.x = mod(p.x - uCam.x + R, 2.0 * R) + uCam.x - R;
          p.z = mod(p.z - uCam.z + R, 2.0 * R) + uCam.z - R;
          p.y += uCam.y - H * 0.45;
          vec3 fall = normalize(vec3(uWind.x, -speed, uWind.z));
          float len = 0.6 + aSeed.w * 0.4, width = 0.024;
          // billboard the streak around its fall direction, facing the camera
          vec3 toCam = normalize(uCam - p);
          vec3 side = normalize(cross(fall, toCam)) * width;
          vec3 world = p + side * position.x - fall * len * position.y;
          float sheltered = step(p.y, shelterY(p.xz) + 0.05);                   // under a roof: no rain
          float dist = length(uCam - p);
          vFade = (1.0 - sheltered) * smoothstep(R, R * 0.4, dist) * smoothstep(0.3, 1.2, dist);
          vAlong = position.y;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity;
        varying float vFade; varying float vAlong;
        void main() {
          float a = uOpacity * vFade * smoothstep(0.0, 0.35, vAlong) * smoothstep(1.0, 0.6, vAlong);
          if (a < 0.002) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    const m = new Mesh(g, mat);
    m.frustumCulled = false; m.renderOrder = 10; m.raycast = () => {};
    return m;
  }, [count, color, intensity]);
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as ShaderMaterial).dispose(); }, [mesh]);

  useFrame((_, dt) => {
    const u = (mesh.material as ShaderMaterial).uniforms;
    u.uTime.value += Math.min(Math.max(dt, 0), 0.1);
    u.uCam.value.copy(camera.position);
  });
  return <primitive object={mesh} />;
}

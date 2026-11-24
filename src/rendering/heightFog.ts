/* Height fog for every material: replaces three.js's FogExp2 maths (patched into the shared shader chunks once,
   before any material compiles). Real haze sits in the valleys and thins with altitude, so the fog density
   falls off exponentially with height and is integrated exactly along each view ray:
     density(y) = fogDensity · exp(-FALLOFF · (y - BASE))
     opticalDepth = ∫ density along the ray = density(camera.y) · distance · (1 - e^(-k·Δy)) / (k·Δy)
   Distant hills rise out of the haze, the ground stays softly veiled, and looking down stays clear.
   `scene.fog = new FogExp2(colour, density)` drives it (density = per metre at ground level); linear Fog is
   unchanged. */
import { ShaderChunk } from 'three';

const FALLOFF = 0.085;   // 1/m: the haze halves every ~8 m of altitude
const BASE = 0.0;        // m: ground level

let installed = false;

export function installHeightFog() {
  if (installed) return;
  installed = true;

  ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;

  ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  // world position from view space (every shader has mvPosition; sprites have no 'transformed'):
  // the view matrix is a rigid transform, so its inverse is the transposed rotation
  vFogWorld = transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz );
#endif`;

  ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;

  ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    vec3 fogRay = vFogWorld - cameraPosition;
    float fogDist = length( fogRay );
    float fogK = ${FALLOFF.toFixed(4)} * fogRay.y;
    float fogIntegral = abs( fogK ) > 1e-4 ? ( 1.0 - exp( - fogK ) ) / fogK : 1.0;
    float fogBaseDensity = fogDensity * exp( - ${FALLOFF.toFixed(4)} * ( cameraPosition.y - ${BASE.toFixed(2)} ) );
    float fogFactor = 1.0 - exp( - fogBaseDensity * fogDist * fogIntegral );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
}

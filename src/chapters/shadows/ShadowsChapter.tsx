/* Chapter 02 · The Shadows. An abandoned estate on an isolated island at night: overcast, cold moonlight, fog on the
   ground and on the sea, lightning now and then far off. Section 01 (the Entrance of Isolation) is built; the plan
   for the courtyard, the house, the pursuit, the descent and the exit is docs/CHAPTER_02_PLAN.md.
   The light is kept readable: the moon (the Look's sun) outlines everything, a faint cold sky fill keeps the
   shadows from going black, and the only warm light is a few failing lamps and windows. */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { HemisphereLight } from 'three';
import { playerState } from '../../player/playerState';
import { lightningState } from '../../rendering/Lightning';
import { useBudget } from '../../rendering/adaptive';
import { lookFor } from '../../rendering/looks';
import { Courtyard } from './Courtyard';
import { EntrancePortrait } from './Portrait';
import { Grove } from './Grove';
import { Crows } from './Crows';
import { Descent } from './Descent';
import { Trail } from '../survival/Trail';
import { FogExp2, Object3D } from 'three';
import { useThree } from '@react-three/fiber';
import { Creature } from './Creature';
import { Estate, Figure, GroundFog } from './Estate';
import { House } from './House';
import { FY, SHADOWS_PATH, groundHeight } from './layout';
import { Pursuit } from './Pursuit';
import { DeadGrass, Terrain } from './Grounds';
import { ShadowsIntro } from './Intro';
import { Sea, Sky } from './Seascape';

const MathUtilsClamp = (v: number) => Math.min(1, Math.max(0, v));

export function ShadowsChapter() {
  const moon = lookFor('shadows').sun.direction;
  const figure = useRef(false);
  const half = useBudget().cover === 'half';
  // indoors (and underground) the sky's fill light and reflections fade right down, so the rooms are dark and the
  // windows, lamps and moonlight do the lighting
  const hemi = useRef<HemisphereLight>(null), inside = useRef(0);
  useFrame((_, dt) => {
    const p = playerState.position;
    const inHouse = (p.z < -55.9 && p.z > -77 && p.x > -16.5 && p.x < 26 && p.y > FY - 0.6) || p.y < FY - 1.2;
    inside.current += ((inHouse ? 1 : 0) - inside.current) * (1 - Math.exp(-2.5 * Math.min(dt, 0.1)));
    if (hemi.current) hemi.current.intensity = 1.5 * (1 - 0.6 * inside.current);
    lightningState.envScale = 1 - 0.6 * inside.current;
    // underground the air thickens: denser fog, thickest in the cistern
    const fog = scene.fog as FogExp2 | null;
    if (fog?.isFogExp2) {
      const deep = MathUtilsClamp((FY - 1 - p.y) / 5);
      fog.density = baseFog.current * (1 + 2.6 * deep);
    }
  });
  const scene = useThree((st) => st.scene);
  const baseFog = useRef(lookFor('shadows').fog?.density ?? 0.02);
  const trailWorld = useRef(new Object3D()).current;
  // the guiding trail: on the ground outside, on the floors indoors and underground
  const trailHeight = useRef((x: number, z: number, y: number) => ((z < -50 && Math.abs(x) < 26) || y < -0.5 ? y : groundHeight(x, z))).current;
  useEffect(() => () => { lightningState.envScale = 1; }, []);
  return (
    <>
      <hemisphereLight ref={hemi} args={['#5a6c94', '#151a22', 1.5]} />
      <Sky moon={moon} />
      <Sea moon={moon} />
      <Terrain />
      <DeadGrass count={half ? 3500 : 7000} />
      <Estate />
      <EntrancePortrait />
      <Grove half={half} />
      <Courtyard />
      <House />
      <Creature />
      <Descent />
      <Crows />
      <Trail world={trailWorld} path={SHADOWS_PATH} heightAt={trailHeight} chapter="shadows" />
      <Pursuit />
      <GroundFog />
      <Figure show={figure} />
      <ShadowsIntro figure={figure} />
    </>
  );
}

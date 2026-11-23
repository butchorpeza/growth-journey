/* The five chapters: copy, where each world sits, how the camera moves through it, and its light.
   3D values live here (not inside components) so timing and framing can be tuned without touching scene code. */

export type Vec3 = [number, number, number];

export interface CameraKey { position: Vec3; target: Vec3 }

export interface Atmosphere {
  skyTop: string;      // zenith colour of the sky dome
  skyHorizon: string;  // horizon band
  fog: string;         // fog + scene background
  fogDensity: number;  // FogExp2 density while the chapter is settled
  sun: string;         // key light colour
  sunIntensity: number;
  ambient: number;     // hemisphere light intensity
}

export interface Chapter {
  id: 'beginning' | 'discovery' | 'system' | 'results' | 'frontier';
  index: number;
  number: string;       // "01"
  title: string;        // "The Beginning"
  narrative: string;    // the line that opens the chapter
  anchor: Vec3;         // world position of the chapter's environment
  camera: { from: CameraKey; to: CameraKey };   // relative to the anchor; scrolling moves from -> to
  atmosphere: Atmosphere;
}

export const PALETTE = {
  charcoal: '#101820',
  navy: '#172D45',
  blue: '#244E76',
  white: '#F1F3F5',
  gold: '#D5A46C',
} as const;

const SPACING = 900;   // distance between worlds: far enough that fog hides one from the next

export const chapters: Chapter[] = [
  {
    id: 'beginning', index: 0, number: '01', title: 'The Beginning',
    narrative: 'Every business has a starting point. Every growth journey begins with a vision.',
    anchor: [0, 0, 0],
    camera: {
      // wide establishing shot with the island right of the headline -> the avatar at the temple door
      // (island ~55 units across; avatar ~4 units tall, hips at 9.7, 2.0, -1.3). Phase 03 refines this move.
      from: { position: [58, 30, 86], target: [-16, 4, -4] },
      to: { position: [17, 5.2, 7.5], target: [6.5, 3.6, -1.4] },
    },
    atmosphere: { skyTop: '#101820', skyHorizon: '#8f7a64', fog: '#2b3a4c', fogDensity: 0.0042, sun: '#f3d1a6', sunIntensity: 2.4, ambient: 0.9 },
  },
  {
    id: 'discovery', index: 1, number: '02', title: 'The Discovery',
    narrative: 'Growth begins with understanding the problem.',
    anchor: [0, 0, -SPACING],
    camera: {
      from: { position: [0, 90, 150], target: [0, 10, 0] },
      to: { position: [26, 22, 40], target: [0, 18, -10] },
    },
    atmosphere: { skyTop: '#101820', skyHorizon: '#172D45', fog: '#172D45', fogDensity: 0.006, sun: '#c9d8ea', sunIntensity: 1.2, ambient: 0.6 },
  },
  {
    id: 'system', index: 2, number: '03', title: 'The System',
    narrative: 'Strategy becomes powerful when every element works together.',
    anchor: [0, 0, -SPACING * 2],
    camera: {
      from: { position: [0, 46, 92], target: [0, 6, 0] },
      to: { position: [0, 22, 52], target: [0, 8, 0] },
    },
    atmosphere: { skyTop: '#101820', skyHorizon: '#244E76', fog: '#16283c', fogDensity: 0.005, sun: '#D5A46C', sunIntensity: 1.6, ambient: 0.7 },
  },
  {
    id: 'results', index: 3, number: '04', title: 'The Results',
    narrative: 'Strategy matters when it creates meaningful progress.',
    anchor: [0, 0, -SPACING * 3],
    camera: {
      from: { position: [-40, 30, 90], target: [0, 10, 0] },
      to: { position: [30, 16, 46], target: [0, 10, -6] },
    },
    atmosphere: { skyTop: '#172D45', skyHorizon: '#244E76', fog: '#1d3650', fogDensity: 0.0045, sun: '#F1F3F5', sunIntensity: 1.5, ambient: 0.8 },
  },
  {
    id: 'frontier', index: 4, number: '05', title: 'The Next Frontier',
    narrative: 'Growth never stands still.',
    anchor: [0, 0, -SPACING * 4],
    camera: {
      from: { position: [0, 40, 120], target: [0, 18, -80] },
      to: { position: [6, 9, 22], target: [0, 10, -60] },
    },
    atmosphere: { skyTop: '#244E76', skyHorizon: '#D5A46C', fog: '#8a6f58', fogDensity: 0.0032, sun: '#ffd7a0', sunIntensity: 3, ambient: 1 },
  },
];

export const CHAPTER_COUNT = chapters.length;

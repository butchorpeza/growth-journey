/* The four chapters of the playable journey. Narrative lines are from the brief; personal details are NOT invented:
   anything marked `placeholder: true` is editable text waiting for Butch's own words. */

export type ChapterId = 'prototype' | 'survival' | 'shadows' | 'rebirth' | 'new-era';

export interface GameChapter {
  id: ChapterId;
  number: string;
  title: string;
  narrative: string;
  theme: string;
  mood: string;            // lighting identity
  status: 'prototype' | 'planned' | 'in-production' | 'ready';
}

export const gameChapters: GameChapter[] = [
  { id: 'survival', number: '01', title: 'Survival', narrative: 'Every journey begins somewhere. Not every beginning is easy.',
    theme: 'Poverty, difficult beginnings, survival and limited opportunities.', mood: 'Overcast daylight, soft shadows, muted natural colours.', status: 'planned' },
  { id: 'shadows', number: '02', title: 'The Shadows', narrative: 'Some experiences leave places within us that are difficult to revisit.',
    theme: 'Fear, difficult experiences and psychological struggle, told through atmosphere.', mood: 'Moonlight, low-key lighting, cold tones, local warm lights.', status: 'planned' },
  { id: 'rebirth', number: '03', title: 'Rebirth', narrative: 'Somewhere along the way, I began to understand where I was going.',
    theme: 'Rediscovery, rebuilding, learning and finding direction.', mood: 'Golden-hour sunlight, lush greens, warm atmosphere.', status: 'planned' },
  { id: 'new-era', number: '04', title: 'The New Era', narrative: 'The world changed. So did the possibilities.',
    theme: 'Digital transformation and becoming a Digital Growth Strategist.', mood: 'Cool architectural light, glass reflections, cinematic skyline.', status: 'planned' },
];

/** the technical test range used while the first-person controller is built (Phase 02) */
export const prototypeChapter: GameChapter = {
  id: 'prototype', number: '00', title: 'Test Range', narrative: 'Technical prototype: movement, camera and physics.',
  theme: 'Temporary blockout for testing only.', mood: 'Neutral overcast HDRI.', status: 'prototype',
};

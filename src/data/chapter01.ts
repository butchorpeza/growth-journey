/* CONTENT for Chapter 01's discoveries: what the information panel shows when the visitor presses E at a white
   diamond. Edit freely; the interaction code only reads this. Photographs live in photos.ts.

   Fields: title · intro (one line, shown first) · body (paragraphs) · date (optional) · image (optional, a path, or
   "render:<view>" for a view rendered from the scene) · gallery (optional, a list of photos) · demo (optional, a small
   animated explanation) · action (optional, a button that does something, e.g. entering the next chapter). */
import { COLLAGE, K9, type Photo } from './photos';

export interface Discovery {
  id: string;
  title: string;
  kicker?: string;              // small line above the title (a category or a date)
  intro: string;
  body: string[];
  date?: string;
  image?: string;
  imageCaption?: string;
  imagePlaceholder?: boolean;
  gallery?: Photo[];
  demo?: 'sungka';
  action?: { label: string; kind: 'enter-next-chapter' };
}

export const DISCOVERIES: Record<string, Discovery> = {
  'survival-lamp': {
    id: 'survival-lamp', kicker: 'The beginning', title: 'A Light That Never Went Out',
    intro: 'The oil lamp represents a time when life was not always easy and the road ahead was not always clear.',
    body: [
      'Sometimes, progress begins with very little. You learn to make use of what you have, adapt to what surrounds you, and keep moving even when the possibilities seem limited.',
      'For me, the light represents resilience, resourcefulness, and the determination to build something better from humble beginnings.',
      'It reminds me that even a small light can make a difference in the darkest surroundings.',
    ],
  },
  'survival-photograph': {
    id: 'survival-photograph', kicker: 'Memories', title: 'Fragments of My Journey',
    intro: 'Every journey is made up of moments, people, places, and experiences.',
    body: [
      'Some memories remind us where we started. Others show us how much we have changed.',
      'This collection represents the different chapters of my life, preserving the moments that contributed to the person I am becoming.',
    ],
    gallery: COLLAGE,
  },
  'survival-k9': {
    id: 'survival-k9', kicker: `Born ${K9.birthYear}`, title: `${K9.name}: A Loyal Companion`,
    intro: 'Some companions become part of our journey without needing words.',
    body: [`${K9.name} has been part of my life since ${K9.birthYear}. This little corner is dedicated to a companion whose presence deserves a place in my story.`],
    date: String(K9.birthYear),
    image: K9.image, imageCaption: K9.caption, imagePlaceholder: K9.placeholder,
  },
  'survival-cat': {
    id: 'survival-cat', kicker: 'Home', title: 'Quiet Companionship',
    intro: 'Not every meaningful part of life is defined by major achievements.',
    body: [
      'Sometimes, it is the small and quiet moments that make an ordinary day memorable.',
      'This interaction represents the simple companionship and everyday moments that make a place feel like home.',
    ],
  },
  'survival-sungka': {
    id: 'survival-sungka', kicker: 'Filipino culture', title: 'A Game of Patience and Strategy',
    intro: 'Sungka is a traditional Filipino board game played using small shells, stones, or seeds.',
    body: [
      'Beyond the game itself, it represents the simple moments of gathering, thinking ahead, and spending time together.',
      'It is a small reminder of the culture and everyday traditions that are part of Filipino life.',
      'How it is played: each player scoops all the shells from one of their small holes and sows them one by one into the following holes, around the board, dropping one into their own store along the way.',
    ],
    image: 'render:sungka', imageCaption: 'The sungka board under the shelter.',
    demo: 'sungka',
  },
  'survival-motorbike': {
    id: 'survival-motorbike', kicker: 'Everyday life', title: 'The Road Forward',
    intro: 'Transportation is more than simply getting from one place to another.',
    body: [
      'In rural communities, motorcycles are part of everyday life. They represent mobility, independence, and the ability to reach places that might otherwise feel far away.',
      "This motorcycle is part of the environment's story of movement, opportunity, and the journey ahead.",
    ],
    image: 'render:motorbike', imageCaption: 'Parked by the sungka shelter.',
  },
  'survival-portal': {
    id: 'survival-portal', kicker: 'Chapter 01 → Chapter 02', title: 'Beyond the Beginning',
    intro: 'Every journey eventually reaches a moment when the past becomes a foundation for something new.',
    body: [
      'The portal represents the transition from survival into the next chapter of the journey.',
      'The experiences that shaped the beginning do not define the limits of what comes next. They become part of the foundation for growth.',
    ],
    action: { label: 'Enter Chapter 02', kind: 'enter-next-chapter' },
  },
};

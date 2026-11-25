/* CONTENT for Chapter 02, "The things that shaped me, even when I didn't understand them": the panels (E) and the
   lines shown as subtitles along the way. Butch's own story, in his own words; edit it here, and only here.
   Source of truth: the biography Butch gave. Nothing is invented: no incidents, people or events beyond it. The places
   are representations (an empty portrait, a statue, a drawing desk), never accounts of something that happened. */
import type { Discovery } from './chapter01';

export const SHADOWS_DISCOVERIES: Record<string, Discovery> = {
  // 01 · The Entrance: growing up without them
  'shadows-portrait': {
    id: 'shadows-portrait', kicker: 'The Entrance', title: 'Growing Up Without Them', intro: '',
    body: [
      "Growing up, my childhood wasn't exactly what I imagined a family would be. My parents weren't there throughout my upbringing, and my grandparents became the people who raised me. It was a different beginning, one that I didn't fully understand when I was young.",
    ],
  },
  // 02 · The Forgotten Grounds: being underestimated
  'shadows-statue': {
    id: 'shadows-statue', kicker: 'The Forgotten Grounds', title: 'Being Underestimated', intro: '',
    body: [
      "Growing up, I became aware that people sometimes judged my family because of what we had or didn't have. It wasn't always easy being underestimated. But our circumstances were never the complete measure of who we were or what we could become.",
    ],
  },
  // 03 · The House of Memories: the innocence of childhood
  'shadows-drawing': {
    id: 'shadows-drawing', kicker: 'The House of Memories', title: 'The Drawing Desk', intro: '',
    body: ['I was still just a kid who wanted to enjoy life. I loved drawing, and discovering new things.'],
  },
  'shadows-games': {
    id: 'shadows-games', kicker: 'The House of Memories', title: 'The Games', intro: '',
    body: ['I loved playing video games and spending time with my friends.'],
  },
  'shadows-chair': {
    id: 'shadows-chair', kicker: 'The House of Memories', title: 'An Empty Chair', intro: '',
    body: ['But not every experience was kind. There were moments of bullying and loneliness that became part of my childhood, too.'],
  },
};

/** lines shown as subtitles (no voice) at points along the way */
export const SHADOWS_LINES: Record<string, string[]> = {
  // 04 · The Descent: on stepping into the corridor, before anything appears
  descent: [
    "Sometimes, the things we experience when we're young stay with us longer than we expect.",
    'Even when we try to move forward, parts of the past can still catch up with us.',
  ],
  // 05 · The Threshold: out on the ledge, as the light comes up over the sea
  threshold: [
    "I can't change the circumstances I grew up in or the things that happened along the way.",
    "But those experiences are only part of my story. They don't have to decide everything that comes next.",
    "There's still a future I want to build, and I'm still moving toward it.",
  ],
};

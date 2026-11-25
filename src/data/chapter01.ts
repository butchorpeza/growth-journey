/* CONTENT for Chapter 01, "The place where everything began": what the information panel shows when the visitor
   presses E at a white diamond. This is Butch's own story, in his own words: edit it here, and only here (the voice
   lines in narration.ts are read from these same paragraphs). Photographs live in photos.ts.
   Source of truth: the biography Butch gave. Nothing here is invented: no memories, events or achievements beyond it.

   Fields: title · intro (one line, shown first) · body (paragraphs) · date (optional) · image (optional, a path, or
   "render:<view>" for a view rendered from the scene) · gallery (optional, a list of photos) · demo (optional, a small
   animated explanation) · action (optional, a button that does something, e.g. entering the next chapter). */
import { CAT, COLLAGE, K9, type Photo } from './photos';

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
  demo?: 'sungka';                 // (the sungka demonstration: no longer used, Butch never played it)
  action?: { label: string; kind: 'enter-next-chapter' };
}

export const DISCOVERIES: Record<string, Discovery> = {
  'survival-lamp': {
    id: 'survival-lamp', kicker: 'My grandparents', title: 'The People Who Raised Me', intro: '',
    body: [
      'When I think about where I came from, I think about my grandparents. They were the ones who raised me and stood by me throughout my childhood. They became my family, my support system, and an important part of the person I am today.',
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
    id: 'survival-k9', kicker: `Born ${K9.birthYear}`, title: `${K9.name}, A Loyal Companion`,
    intro: 'Some companions become part of our journey without needing words.',
    body: [`${K9.name} has been part of my life since ${K9.birthYear}. This little corner is dedicated to a companion whose presence deserves a place in my story.`],
    date: String(K9.birthYear),
    image: K9.image, imageCaption: K9.caption, imagePlaceholder: K9.placeholder,
  },
  'survival-cat': {
    id: 'survival-cat', kicker: 'A little companion', title: 'Minggay', intro: '',
    body: [
      "This is Minggay. She was part of my everyday life for about a year. I don't know where she is now, but having her around gave me little moments that became part of my story. I still hope she's somewhere safe.",
    ],
    ...(CAT.image ? { image: CAT.image, imageCaption: CAT.caption || undefined } : {}),
  },
  'survival-games': {
    id: 'survival-games', kicker: 'What I loved as a kid', title: 'Games and Drawings', intro: '',
    body: [
      'As a kid, I loved playing video games and drawing. I spent a lot of my time with friends, exploring and making things.',
      'Even back then, I dreamed of becoming a successful man someday, whatever that would take.',
    ],
  },
  'survival-motorbike': {
    id: 'survival-motorbike', kicker: "Our family's motorcycle", title: 'Keeping Things Moving', intro: '',
    body: [
      'This motorcycle was part of our family\'s everyday life. My parents used it to provide transportation for my grandfather, who needed it for his work. It might have seemed like an ordinary motorcycle, but it played a role in helping our family get by.',
    ],
  },
  'survival-computer': {
    id: 'survival-computer', kicker: "My grandfather's help", title: 'The First Opportunity', intro: '',
    body: [
      "One of the things I'll always be grateful for is how my grandfather helped me get a computer. He knew I wanted to do something with my skills, and that computer gave me an opportunity to explore freelancing. Whenever I encountered problems, he tried to help me find a way forward.",
      'I started as a graphic designer. Little by little, I learned new things, explored different creative fields, and discovered what I was capable of. What started as a small opportunity eventually grew into a freelance career that has lasted nearly five years.',
    ],
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

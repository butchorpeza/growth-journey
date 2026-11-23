/* Sections of the HTML website (the accessible, SEO and mobile version of the journey).
   Each section opens with a short line; the game's own chapters live in data/chapters.ts. */

export interface Section {
  id: 'about' | 'approach' | 'services' | 'work' | 'contact';
  index: number;
  number: string;
  title: string;
  narrative: string;
}

export const PALETTE = {
  charcoal: '#101820',
  navy: '#172D45',
  blue: '#244E76',
  white: '#F1F3F5',
  gold: '#D5A46C',
} as const;

export const sections: Section[] = [
  { id: 'about', index: 0, number: '01', title: 'About', narrative: 'Every business has a starting point. Every growth journey begins with a vision.' },
  { id: 'approach', index: 1, number: '02', title: 'Approach', narrative: 'Growth begins with understanding the problem.' },
  { id: 'services', index: 2, number: '03', title: 'Services', narrative: 'Strategy becomes powerful when every element works together.' },
  { id: 'work', index: 3, number: '04', title: 'Work', narrative: 'Strategy matters when it creates meaningful progress.' },
  { id: 'contact', index: 4, number: '05', title: 'Contact', narrative: 'Growth never stands still.' },
];

export const SECTION_COUNT = sections.length;

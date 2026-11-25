/* PHOTOS: the replaceable images of Chapter 01. Edit this file only to change photographs and captions; the
   interaction code reads it as it is.

   To add or change photographs: put the image files in public/assets/images/ and change `src` below (the path starts
   at /assets/images/). JPG or WebP, about 1200–1600 px on the long side is plenty; strip location data first.
   Titles, dates and descriptions are optional; leave a field out (or empty) and it isn't shown. The captions below
   only name what each picture shows: the stories behind them are Butch's to write. */

export interface Photo {
  src: string;
  title?: string;
  date?: string;
  description?: string;
  placeholder?: boolean;      // true while the image is a stand-in (shown as such in the panel)
}

/** the photo wall in house A: "Fragments of My Journey". Add or remove entries freely; the wall shows up to six
 *  (four or fewer hang as a loose row of larger frames, five or six as a grid). */
export const COLLAGE: Photo[] = [
  { src: '/assets/images/journey-studio-portrait.jpg', title: 'Studio portrait' },
  { src: '/assets/images/journey-outdoor-portrait.jpg', title: 'Outdoors' },
  { src: '/assets/images/journey-at-work.jpg', title: 'At the desk' },
  { src: '/assets/images/journey-21st-birthday.jpg', title: 'Turning 21' },
];

/** the photographs that hang on the wall (the gallery shows the same ones) */
export const wallPhotos = () => COLLAGE.slice(0, 6);

/** K9, Butch's dog (the 3D dog in the front yard is coloured to match). */
export const K9 = {
  name: 'K9',
  birthYear: 2020,
  image: '/assets/images/k9.jpg',
  caption: 'A loyal companion since 2020.',
  placeholder: false,
};

/** Butch's cat, a ginger tabby (the 3D cat in the sungka shelter is coloured to match). An empty `image` shows the
 *  panel as text only. */
export const CAT = {
  image: '/assets/images/my-cat.jpg' as string,
  caption: '',
};

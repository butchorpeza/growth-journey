/* PHOTOS: the replaceable images of Chapter 01. Edit this file only to change photographs and captions; the
   interaction code reads it as it is.

   To use your own photographs: put the image files in public/assets/images/ and change `src` below (the path starts
   at /assets/images/). JPG or WebP, about 1200 px on the long side is plenty. Titles, dates and descriptions are
   optional; leave a field out (or empty) and it isn't shown.

   Everything here is a PLACEHOLDER until Butch supplies the real photographs: the images say so on their face, and
   nothing in the captions describes a real memory. */

export interface Photo {
  src: string;
  title?: string;
  date?: string;
  description?: string;
  placeholder?: boolean;      // true while the image is a stand-in (shown as such in the panel)
}

/** the photo wall in house A: "Fragments of My Journey". Add or remove entries freely; the wall shows up to six. */
export const COLLAGE: Photo[] = [
  { src: '/assets/images/collage-1-placeholder.jpg', title: 'Photo 1', date: '', description: 'Placeholder: add a photograph and a few words about it.', placeholder: true },
  { src: '/assets/images/collage-2-placeholder.jpg', title: 'Photo 2', date: '', description: 'Placeholder: add a photograph and a few words about it.', placeholder: true },
  { src: '/assets/images/collage-3-placeholder.jpg', title: 'Photo 3', date: '', description: 'Placeholder: add a photograph and a few words about it.', placeholder: true },
  { src: '/assets/images/collage-4-placeholder.jpg', title: 'Photo 4', date: '', description: 'Placeholder: add a photograph and a few words about it.', placeholder: true },
  { src: '/assets/images/collage-5-placeholder.jpg', title: 'Photo 5', date: '', description: 'Placeholder: add a photograph and a few words about it.', placeholder: true },
  { src: '/assets/images/collage-6-placeholder.jpg', title: 'Photo 6', date: '', description: 'Placeholder: add a photograph and a few words about it.', placeholder: true },
];

/** K9. Replace `image` with the real photograph (e.g. /assets/images/k9.jpg) and set `placeholder: false`. */
export const K9 = {
  name: 'K9',
  birthYear: 2020,
  image: '/assets/images/k9-photo-placeholder.jpg',
  caption: 'A loyal companion since 2020.',
  placeholder: true,
};

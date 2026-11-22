/* Chapter 04, The Results. Only facts published on butchorpeza.com: the case studies (projects-data.js),
   the Experience timeline and the client list. No invented metrics, testimonials or years:
   `year` is filled only where the site states it (Experience timeline), `industry` only where the site says it. */

export interface Project {
  slug: string;
  name: string;
  industry?: string;
  overview: string;
  role: string;
  services: string[];
  technologies: string[];
  year?: string;
  image?: string;          // public/images/projects/<slug>.webp (laptop mockup with the live homepage)
  caseStudy?: string;      // case study on butchorpeza.com
  live?: string;           // live website
}

const CS = 'https://butchorpeza.com/work/';
const img = (s: string) => `images/projects/${s}.webp`;

export const projects: Project[] = [
  {
    slug: 'land-ai', name: 'Land AI', industry: 'Land investment · AI lead qualification',
    overview: 'Land AI finds land seller leads: callers reach the owners and an AI agent qualifies them, so investors know who to call.',
    role: 'Software Developer', year: '2023 – 2026',
    services: ['Software development', 'Interface and the logic behind it', 'Bug fixing'],
    technologies: ['Next.js', 'Vercel', 'AI voice agent'],
    image: img('land-ai'), caseStudy: `${CS}land-ai/`, live: 'https://landai.ai/',
  },
  {
    slug: 'lumara', name: 'Lumara Systems', industry: 'LED light therapy devices',
    overview: 'Professional LED light therapy for clinics and for people at home, sold through a Shopify store built to be found in search.',
    role: 'Web Development & SEO',
    services: ['Website development', 'Search-friendly site structure', 'On-page SEO'],
    technologies: ['Shopify', 'On-page SEO'],
    image: img('lumara'), caseStudy: `${CS}lumara/`, live: 'https://lumarasystems.com/',
  },
  {
    slug: 'north-horizon', name: 'North Horizon Helicopter Adventures', industry: 'Tourism · helicopter tours',
    overview: 'Helicopter tours from a helipad inside Nitmiluk National Park, in Australia’s Top End: a site that shows the flight first and makes booking simple.',
    role: 'Web Design & Development',
    services: ['Web design', 'WordPress development', 'Video hero and experience pages'],
    technologies: ['WordPress'],
    image: img('north-horizon'), caseStudy: `${CS}north-horizon/`, live: 'https://northhorizonheliadventures.com.au/',
  },
  {
    slug: 'joa', name: 'JOA Electrical', industry: 'Residential electrical services',
    overview: 'A team of residential electricians in Perth: a WordPress site that turns visits into calls and quote requests.',
    role: 'Web Design & Development',
    services: ['Web design', 'WordPress development', 'On-page SEO setup'],
    technologies: ['WordPress', 'Bricks Builder', 'Fluent Forms', 'Google Site Kit'],
    image: img('joa'), caseStudy: `${CS}joa/`, live: 'https://joaelectrical.com/',
  },
  {
    slug: 'brandon-parker', name: 'Brandon Parker', industry: 'Founder’s personal site',
    overview: 'One personal home for the founder of Land AI: his office as an interactive scene where every object opens a story.',
    role: 'Web Development',
    services: ['Custom design and layout', 'Front-end development', 'Performance-focused build'],
    technologies: ['Next.js', 'Vercel', 'CSS Modules'],
    image: img('brandon-parker'), caseStudy: `${CS}brandon-parker/`, live: 'https://brandonparker.com/',
  },
  {
    slug: 'bodybalancing', name: 'Body Balancing Nutrition', industry: 'Dietitians & nutritionists',
    overview: 'A warm, food-first website for a team of accredited dietitians in Perth that leads to one simple first step.',
    role: 'Web Design & Development',
    services: ['Web design', 'WordPress / Elementor build', 'On-page SEO'],
    technologies: ['WordPress', 'Elementor', 'WooCommerce', 'Google Site Kit'],
    image: img('bodybalancing'), caseStudy: `${CS}bodybalancing/`, live: 'https://bodybalancing.com.au/',
  },
  {
    slug: 'compound-gym', name: 'Compound Gym', industry: 'Fitness · 24/7 gym',
    overview: 'A bold, dark Shopify site for a 24/7 strength gym in Houston, where you can see the gym and join in a few taps.',
    role: 'Shopify Web Design',
    services: ['Web design', 'Shopify development', 'Memberships and day passes online'],
    technologies: ['Shopify', 'Meta Pixel'],
    image: img('compound-gym'), caseStudy: `${CS}compound-gym/`, live: 'https://compound-gym.com/',
  },
  {
    slug: 'lvm', name: 'Lord Vincent Van Mendoza', industry: 'Web design studio',
    overview: 'A calm, editorial portfolio for a Philippine web designer, built in Webflow with smooth GSAP motion.',
    role: 'Web Development',
    services: ['Webflow development', 'Scroll and motion design', 'Responsive build'],
    technologies: ['Webflow', 'GSAP'],
    image: img('lvm'), caseStudy: `${CS}lvm/`, live: 'https://dev.lordvincentvanmendoza.com/',
  },
  {
    slug: 'kleidereisen', name: 'Kleidereisen',
    overview: 'Graphics and 3D visuals for the brand, supporting its website, marketing materials and product presentation.',
    role: 'Graphic / 3D Designer', year: '2025 – 2026',
    services: ['Web design', 'Photoreal 3D product renders', 'Brand and marketing graphics'],
    technologies: ['Blender'],
    live: 'https://kleidereisen.de/',
  },
  {
    slug: 'endokids', name: 'Endo Kids Concierge',
    overview: 'The website, brand graphics and social media content, kept consistent across every channel.',
    role: 'Web Developer, Graphic Designer & Social Media Manager', year: '2024 – 2025',
    services: ['Website', 'Brand graphics', 'Social media content'],
    technologies: [],
    live: 'https://endokidsconcierge.com/',
  },
];

/* homepage client strip (main.js CLIENTS) */
export const clients = [
  { name: 'JSA Interactive', href: 'https://jsainteractive.com/' },
  { name: 'Genghis Digital', href: 'https://genghisdigital.com.au/' },
  { name: 'KleiderEisen', href: 'https://kleidereisen.de/' },
  { name: 'MilaBoo', href: 'https://milaboo.de/' },
  { name: 'Endo Kids Concierge', href: 'https://endokidsconcierge.com/' },
  { name: 'Nexora', href: 'https://journals.nexoraird.com/' },
  { name: 'Land AI', href: 'https://landai.ai/' },
  { name: 'Lumara', href: 'https://lumarasystems.com/' },
  { name: 'Progressive Dental Care', href: 'https://www.pdcfairfax.com/' },
];

/* Chapter 03, The System: five connected zones of one growth strategy.
   Descriptions and capability lists come from the brief and from butchorpeza.com/services (services-data.js). */

export interface Service {
  id: string;
  zone: string;           // "Zone 01"
  title: string;
  short: string;          // label on the 3D platform
  description: string;
  listLabel: 'Technologies' | 'Capabilities';
  items: string[];
  href: string;           // the full service page on the main site
  role: string;           // how this zone feeds the larger strategy
}

export const services: Service[] = [
  {
    id: 'web', zone: 'Zone 01', title: 'Web Design & Development', short: 'Web',
    description: 'Creating effective digital experiences that help businesses communicate their value, build trust, and convert visitors.',
    listLabel: 'Technologies', items: ['HTML', 'CSS', 'JavaScript', 'React', 'WordPress', 'Elementor', 'Shopify', 'Figma'],
    href: 'https://butchorpeza.com/services/web-design-development/',
    role: 'The storefront every other channel sends people to.',
  },
  {
    id: 'marketing', zone: 'Zone 02', title: 'Digital Marketing & Optimization', short: 'Marketing',
    description: 'Improving online visibility and optimizing digital channels to attract the right audience and create opportunities for growth.',
    listLabel: 'Capabilities', items: ['SEO', 'Local SEO', 'GEO / AEO', 'Content optimization', 'Conversion optimization', 'Analytics and reporting', 'Digital marketing strategy'],
    href: 'https://butchorpeza.com/services/digital-marketing-optimization/',
    role: 'Brings the right visitors to the storefront and measures what they do.',
  },
  {
    id: 'ai', zone: 'Zone 03', title: 'AI & Business Automation', short: 'Automation',
    description: 'Using AI tools and automation to simplify repetitive processes, improve efficiency, and support business operations.',
    listLabel: 'Capabilities', items: ['AI-assisted workflows', 'Workflow automation', 'Lead management', 'CRM integrations', 'Marketing automation', 'Process optimization'],
    href: 'https://butchorpeza.com/services/ai-business-automation/',
    role: 'Turns new enquiries into follow-ups without manual busywork.',
  },
  {
    id: 'brand', zone: 'Zone 04', title: 'Branding & Visual Identity', short: 'Brand',
    description: 'Building cohesive visual identities and creative assets that help businesses establish recognition and communicate consistently.',
    listLabel: 'Capabilities', items: ['Brand identity', 'Graphic design', 'Creative direction', 'Social media graphics', 'Marketing materials', 'Visual communication'],
    href: 'https://butchorpeza.com/services/branding-visual-identity/',
    role: 'Keeps every touchpoint recognisable, so trust carries across channels.',
  },
  {
    id: '3d', zone: 'Zone 05', title: '3D & Interactive Experiences', short: '3D',
    description: 'Using 3D visualization and interactive experiences to create engaging digital presentations and memorable brand interactions.',
    listLabel: 'Capabilities', items: ['Blender', '3D modeling', 'Product visualization', 'Interactive 3D', 'Motion graphics', 'Web-based 3D experiences'],
    href: 'https://butchorpeza.com/services/3d-interactive-experiences/',
    role: 'Makes products and ideas easier to understand, and harder to forget.',
  },
];

/* Who Butch is, how to reach him. Every line here is taken from butchorpeza.com (homepage, footer, site-config.js);
   nothing is invented. Edit this file to change the copy; the HTML story and the SEO tags both read from it. */

export const SITE_URL = 'https://butchorpeza.com';
export const PAGE_URL = `${SITE_URL}/about/`;

export const profile = {
  name: 'Butch Orpeza',
  title: 'Digital Growth Strategist',
  capabilities: ['Websites', 'Digital Marketing', 'SEO', 'AI Automation'],
  tagline: 'Helping businesses turn digital opportunities into sustainable growth.',
  location: 'Based in the Philippines',
  // homepage "about" section
  intro:
    "Most businesses don't need more tools. They need more customers, steadier sales and less time lost to busywork. " +
    'Whether you run a local service, an online store or a fast-growing startup, you get one accountable partner who finds ' +
    'what is holding your growth back and fixes it, from the first audit to ongoing improvement.',
  // homepage E-E-A-T cards
  credentials: [
    { k: 'Experience', v: '5+ years of hands-on work designing and building websites, graphics and 3D visuals for clients worldwide.' },
    { k: 'Expertise', v: 'Web design & development, AI automation, graphic & 3D design and SEO, all in one hand.' },
    { k: 'Authority', v: 'Co-founder of four agencies, with 9 live client websites you can visit today.' },
    { k: 'Trust', v: 'Rated Excellent on Google, with direct communication from start to finish.' },
  ],
};

export const contact = {
  email: 'hello@butchorpeza.com',
  call: 'https://cal.com/butch-orpeza-gfakel/30-min-meeting',
  portfolio: `${SITE_URL}/work/`,
  contactPage: `${SITE_URL}/#footer`,
};

export const socials = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/butch-orpeza-883227328/' },
  { label: 'GitHub', href: 'https://github.com/butchorpeza' },
  { label: 'Instagram', href: 'https://www.instagram.com/lourdearl/' },
  { label: 'Facebook', href: 'https://www.facebook.com/butchorpeza' },
];

/* homepage "Experience" timeline (main.js EXP) */
export const experience = [
  { years: '2023 – 2026', role: 'Software Developer', org: 'Land AI', text: 'Developed software and web features, working on both the interface and the logic behind it, and fixing bugs along the way.' },
  { years: '2022 – 2026', role: 'Interactive Web Designer / Developer', org: 'JSA Interactive', text: 'Designed and built interactive, responsive websites, combining clean layouts with smooth animations and strong front-end development.' },
  { years: '2025 – 2026', role: 'Web Developer', org: 'Genghis Digital', text: 'Developed and updated client websites, fixed technical issues, and delivered mobile-ready pages on WordPress and Elementor.' },
  { years: '2025 – 2026', role: 'Graphic / 3D Designer', org: 'Kleidereisen', text: 'Created graphics and 3D visuals for the brand, supporting its website, marketing materials, and product presentation.' },
  { years: '2024 – 2025', role: 'Web Developer, Graphic Designer & Social Media Manager', org: 'Endokids Concierge', text: 'Handled the website, brand graphics, and social media content, keeping the brand look consistent across every channel.' },
  { years: '2024 – 2025', role: 'Web Developer and SEO', org: 'Lumina', text: 'Built and maintained websites while setting up on-page SEO, site structure, and technical improvements to help pages rank and load faster.' },
];

/* homepage "Ventures" */
export const ventures = [
  { name: 'Bizyarn', role: 'Co-founder · Digital marketing', href: 'https://bizyarn.com/' },
  { name: 'Mapyros', role: 'Co-founder · Technology', href: 'https://mapyros.com/' },
  { name: 'Writeous Ideas', role: 'Co-founder · Content & branding', href: 'https://writeousideas.com/' },
  { name: 'Exsightful', role: 'Co-founder · Creative innovation', href: 'https://exsightful.net/' },
];

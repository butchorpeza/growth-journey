import { SITE_URL, contact, profile } from '../../data/profile';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>© {new Date().getFullYear()} {profile.name} · {profile.title}</p>
      <nav aria-label="Site">
        <a href={SITE_URL}>Home</a>
        <a href={contact.portfolio}>Work</a>
        <a href={`${SITE_URL}/blog/`}>Blog</a>
        <a href={`mailto:${contact.email}`}>{contact.email}</a>
      </nav>
    </footer>
  );
}

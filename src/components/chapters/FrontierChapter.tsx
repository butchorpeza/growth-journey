import { sections } from '../../data/sections';
import { contact, profile, socials } from '../../data/profile';
import { ButtonLink } from '../common/Button';
import { ChapterHeader } from '../common/ChapterHeader';

const chapter = sections[4];

export function FrontierChapter() {
  return (
    <section id="contact" data-chapter="4" className="chapter chapter--frontier" aria-labelledby="h-frontier">
      <div className="chapter__intro chapter__intro--final">
        <ChapterHeader chapter={chapter} headingId="h-frontier" heading="Contact" />
        <p className="final-line" data-reveal>Let’s build something that moves your business forward.</p>
        <p className="final-sign" data-reveal><strong>{profile.name}</strong><span>{profile.title}</span></p>
        <div className="final-actions" data-reveal>
          <ButtonLink href={`mailto:${contact.email}?subject=${encodeURIComponent("Let's work together")}`}>Let’s Work Together</ButtonLink>
          <ButtonLink variant="ghost" href={contact.portfolio}>Explore My Portfolio</ButtonLink>
          <ButtonLink variant="ghost" href={contact.call} external>Book a Discovery Call</ButtonLink>
        </div>
        <div className="final-contact" data-reveal>
          <p><span className="eyebrow eyebrow--plain">Email</span> <a href={`mailto:${contact.email}`}>{contact.email}</a></p>
          <ul className="socials" aria-label="Social profiles">
            {socials.map((s) => <li key={s.label}><a href={s.href} target="_blank" rel="noopener me">{s.label}</a></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

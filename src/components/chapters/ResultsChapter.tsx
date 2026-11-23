import { sections } from '../../data/sections';
import { experience, ventures } from '../../data/profile';
import { clients, projects } from '../../data/projects';
import { ChapterHeader } from '../common/ChapterHeader';

const chapter = sections[3];

export function ResultsChapter() {
  return (
    <section id="work" data-chapter="3" className="chapter chapter--results" aria-labelledby="h-results">
      <div className="chapter__intro">
        <ChapterHeader chapter={chapter} headingId="h-results" heading="Selected Work" />
        <p className="chapter__lede" data-reveal>
          Different businesses. Different challenges. One objective: creating better digital experiences and growth opportunities.
        </p>
      </div>
      <div className="chapter__body">
        <ul className="cards cards--projects">
          {projects.map((p) => (
            <li key={p.slug} id={`project-${p.slug}`} className="panel card card--project" data-reveal>
              {p.image && (
                <img src={p.image} alt={`${p.name} website shown on a laptop`} width="1024" height="666" loading="lazy" decoding="async" />
              )}
              <div className="card__content">
                {p.industry && <p className="card__zone">{p.industry}</p>}
                <h3>{p.name}</h3>
                <p>{p.overview}</p>
                <dl className="facts">
                  <div><dt>My role</dt><dd>{p.role}</dd></div>
                  {p.year && <div><dt>Years</dt><dd>{p.year}</dd></div>}
                  <div><dt>Services</dt><dd>{p.services.join(', ')}</dd></div>
                  {p.technologies.length > 0 && <div><dt>Built with</dt><dd>{p.technologies.join(', ')}</dd></div>}
                </dl>
                <p className="card__links">
                  {p.caseStudy && <a className="btn btn--link" href={p.caseStudy}>Read the case study</a>}
                  {p.live && <a className="btn btn--link" href={p.live} target="_blank" rel="noopener">Visit the live site<span className="sr-only"> (opens in a new tab)</span></a>}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="split">
          <article className="panel" data-reveal>
            <h3>Experience</h3>
            <ol className="timeline">
              {experience.map((e) => (
                <li key={e.org + e.role}>
                  <p className="timeline__years">{e.years}</p>
                  <p className="timeline__role"><strong>{e.role}</strong>, {e.org}</p>
                  <p>{e.text}</p>
                </li>
              ))}
            </ol>
          </article>
          <div className="stack">
            <article className="panel" data-reveal>
              <h3>Ventures</h3>
              <ul className="plain-list">
                {ventures.map((v) => <li key={v.name}><a href={v.href} target="_blank" rel="noopener">{v.name}</a> <span>{v.role}</span></li>)}
              </ul>
            </article>
            <article className="panel" data-reveal>
              <h3>Clients</h3>
              <ul className="tags tags--links">
                {clients.map((c) => <li key={c.name}><a href={c.href} target="_blank" rel="noopener">{c.name}</a></li>)}
              </ul>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

import { sections } from '../../data/sections';
import { services } from '../../data/services';
import { ChapterHeader } from '../common/ChapterHeader';

const chapter = sections[2];

export function SystemChapter() {
  return (
    <section id="services" data-chapter="2" className="chapter chapter--system" aria-labelledby="h-system">
      <div className="chapter__intro">
        <ChapterHeader chapter={chapter} headingId="h-system" heading="Services" />
        <p className="chapter__lede" data-reveal>
          Five capabilities, one growth strategy. The website, the marketing behind it, the automation after it and the
          brand around it are planned together, so each part makes the others work harder.
        </p>
      </div>
      <div className="chapter__body">
        <ul className="cards cards--services">
          {services.map((s) => (
            <li key={s.id} id={`zone-${s.id}`} className="panel card card--service" data-reveal>
              <p className="card__zone">{s.zone}</p>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
              <p className="card__role">{s.role}</p>
              <h4 className="card__list-label">{s.listLabel}</h4>
              <ul className="tags">{s.items.map((t) => <li key={t}>{t}</li>)}</ul>
              <a className="btn btn--link" href={s.href}>About {s.title.toLowerCase()}</a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

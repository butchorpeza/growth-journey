import { sections } from '../../data/sections';
import { challenges } from '../../data/challenges';
import { ChapterHeader } from '../common/ChapterHeader';

const chapter = sections[1];

export function DiscoveryChapter() {
  return (
    <section id="approach" data-chapter="1" className="chapter chapter--discovery" aria-labelledby="h-discovery">
      <div className="chapter__intro">
        <ChapterHeader chapter={chapter} headingId="h-discovery" heading="Approach" />
        <p className="chapter__lede" data-reveal>Before building a solution, understand what is holding a business back.</p>
      </div>
      <div className="chapter__body">
        <article className="panel panel--wide" data-reveal>
          <p>I approach digital growth by identifying opportunities, understanding customer behavior, and building strategies around business objectives.</p>
        </article>
        <ol className="cards cards--challenges">
          {challenges.map((c, i) => (
            <li key={c.id} className="panel card" data-reveal>
              <span className="card__index">{String(i + 1).padStart(2, '0')}</span>
              <h3>{c.title}</h3>
              <p>{c.metaphor}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* Build-time render of the HTML story (scripts/prerender.mjs puts it into dist/index.html). */
import { renderToString } from 'react-dom/server';
import { App } from './components/App';

export function render(): string {
  return renderToString(<App />);
}

// Puts the server-rendered HTML story into dist/index.html, so the page has its full text, headings and links
// before any JavaScript runs (search engines, link previews, screen readers, no-JS visitors).
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = resolve('dist/index.html');
const { render } = await import(pathToFileURL(resolve('dist-ssr/entry-server.js')).href);
const html = readFileSync(dist, 'utf8');
if (!html.includes('<!--app-html-->')) throw new Error('placeholder <!--app-html--> missing in dist/index.html');
writeFileSync(dist, html.replace('<!--app-html-->', render()));
rmSync(resolve('dist-ssr'), { recursive: true, force: true });
console.log('prerendered dist/index.html');

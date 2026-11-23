// Renders a labelled grid of images to one PNG (headless Chrome). Usage: node scripts/dev/contact-sheet.mjs out.png cols img1 img2 …
import { launch } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';
const [out, cols, ...imgs] = process.argv.slice(2);
const html = `<html><body style="margin:0;background:#222;font:14px system-ui;color:#fff;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px">${imgs.map((f, i) => `<figure style="margin:0;position:relative"><img src="file://${path.resolve(f)}" style="width:100%;display:block"><figcaption style="position:absolute;left:6px;top:4px;background:#000a;padding:2px 6px">${i + 1}. ${path.basename(f).replace(/preview-|-front|\.png/g, '')}</figcaption></figure>`).join('')}</body></html>`;
const tmp = path.resolve(path.dirname(out), '.sheet.html'); fs.writeFileSync(tmp, html);
const b = await launch(process.cwd() + '/.chrome-sheet', 9381);
await b.viewport(Number(cols) * 300, Math.ceil(imgs.length / cols) * 404);
await b.goto('file://' + tmp, 1500);
await b.shot(out); await b.close(); fs.rmSync(tmp);

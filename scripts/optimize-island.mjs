// Asset pipeline for the island + avatar GLB exported from Blender (75 MB, 8K PNG cloth textures).
// Usage: npm run assets:island -- [path/to/island.glb]   (default: ~/Downloads/island.glb)
// Output: public/models/island.glb  (textures max 2048px WebP, meshopt-compressed geometry + animation, quantized).
// meshopt instead of Draco: it also compresses the skinning data and the Mixamo animation, decodes faster, and
// three.js ships the decoder in JS (no extra decoder files to host).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const src = resolve(process.argv[2] || join(homedir(), 'Downloads', 'island.glb'));
const out = resolve('public/models/island.glb');
if (!existsSync(src)) { console.error(`Source not found: ${src}`); process.exit(1); }
mkdirSync('public/models', { recursive: true });
const bin = resolve('node_modules/.bin/gltf-transform');
const tmp = resolve('public/models/.island-tmp.glb');
const run = (...args) => execFileSync(bin, args, { stdio: 'inherit' });
// 1) resize the oversized textures (normal + colour maps) and convert every texture to WebP
run('resize', src, tmp, '--width', '2048', '--height', '2048');
run('webp', tmp, tmp, '--quality', '82');
// 2) clean up + compress geometry and animation (no simplify: keeps the avatar and terrain silhouettes intact)
run('dedup', tmp, tmp);
run('prune', tmp, tmp, '--keep-attributes', 'true');
run('resample', tmp, tmp);
run('meshopt', tmp, out, '--level', 'medium');
execFileSync('rm', ['-f', tmp]);
console.log(`\n${src} (${(statSync(src).size / 1e6).toFixed(1)} MB) -> ${out} (${(statSync(out).size / 1e6).toFixed(2)} MB)`);

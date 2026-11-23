// Downloads CC0 Poly Haven assets by id via the public API (https://api.polyhaven.com), into assets-src/.
// Usage: node scripts/fetch-polyhaven.mjs <outDir> <res> <id> [id …]   (res: 1k | 2k | 4k)
// HDRIs -> .hdr, textures -> glTF material folder (Diffuse/Normal/Rough/AO maps as JPG), models -> glTF + textures.
import fs from 'node:fs';
import path from 'node:path';
const [outDir, res, ...ids] = process.argv.slice(2);
const get = (u) => fetch(u, { headers: { 'User-Agent': 'growth-journey-asset-fetch' } });
for (const id of ids) {
  const info = await (await get(`https://api.polyhaven.com/info/${id}`)).json();
  const files = await (await get(`https://api.polyhaven.com/files/${id}`)).json();
  const type = ['hdris', 'textures', 'models'][info.type];
  const dir = path.join(outDir, type, id); fs.mkdirSync(dir, { recursive: true });
  const jobs = [];
  if (type === 'hdris') jobs.push([files.hdri[res].hdr.url, `${id}_${res}.hdr`]);
  else {
    const g = files.gltf?.[res]?.gltf;
    if (!g) { console.log(id, 'no gltf at', res); continue; }
    jobs.push([g.url, path.basename(g.url)]);
    for (const [rel, f] of Object.entries(g.include || {})) jobs.push([f.url, rel]);
  }
  let bytes = 0;
  for (const [u, rel] of jobs) {
    const dest = path.join(dir, rel); fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) continue;
    const buf = Buffer.from(await (await get(u)).arrayBuffer()); fs.writeFileSync(dest, buf); bytes += buf.length;
  }
  fs.writeFileSync(path.join(dir, 'SOURCE.txt'), `${info.name}\nhttps://polyhaven.com/a/${id}\nLicence: CC0 (https://polyhaven.com/license)\nAuthors: ${Object.keys(info.authors || {}).join(', ')}\n`);
  console.log(type, id, res, (bytes / 1e6).toFixed(1), 'MB', info.polycount ? `${info.polycount} polys` : '');
}

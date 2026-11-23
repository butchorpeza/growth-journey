// Automated play test of the third-person prototype in headless Chrome (real key events through CDP).
// Usage: npm run preview (port 4173) in one terminal, then: node scripts/dev/play-test.mjs
import { launch } from './cdp.mjs';
import fs from 'node:fs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = 'scripts/dev/out'; fs.mkdirSync(out, { recursive: true });
const b = await launch(process.cwd() + '/.chrome-test', 9371);
await b.viewport(1280, 720);
await b.goto('http://localhost:4173/?debug', 1500);
const key = async (code, type) => b.send('Input.dispatchKeyEvent', { type, code, key: code.replace('Key', '').toLowerCase(), windowsVirtualKeyCode: { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, Space: 32, KeyE: 69, ShiftLeft: 16 }[code] });
const hold = async (codes, ms) => { for (const c of codes) await key(c, 'rawKeyDown'); await sleep(ms); for (const c of codes) await key(c, 'keyUp'); };
const pos = () => b.eval(`JSON.stringify({p: window.__player.position.toArray().map(v=>+v.toFixed(2)), speed:+window.__player.speed.toFixed(2), grounded: window.__player.grounded, mode: window.__game.getGame().mode, prompt: window.__game.getGame().prompt?.label || null})`).then(JSON.parse);
const log = (...a) => console.log(...a);

await b.eval(`[...document.querySelectorAll('button')].find(x=>/Start the Journey/.test(x.innerText)).click(); 1`);
for (let i = 0; i < 40; i++) { await sleep(500); const ok = await b.eval(`!!window.__game && window.__game.getGame().mode === 'intro'`).catch(() => false); if (ok) break; }
log('fps check', await b.eval(`(async()=>{const st=window.__r3f; const f=st.gl.info.render.frame; await new Promise(r=>setTimeout(r,1000)); return st.gl.info.render.frame-f})()`));
await b.shot(`${out}/01-intro.png`);
await b.eval(`window.__game.setGame({ mode: 'playing' }); 1`); await sleep(300);
log('spawn', await pos());
await hold(['KeyW'], 1500); log('after W 1.5s (walk)', await pos());
await hold(['KeyW', 'ShiftLeft'], 1500); log('after W+Shift 1.5s (run)', await pos());
await b.shot(`${out}/02-moving.png`);
await key('Space', 'rawKeyDown'); await sleep(250); log('jump +0.25s', await pos()); await key('Space', 'keyUp'); await sleep(900); log('landed', await pos());
// walk to the photograph interactable at (-3, 0, 4) by teleporting nearby, then press E
await b.eval(`window.__player.teleport = new window.__player.position.constructor(-3, 0, 5.4); window.__player.camYaw = 0; 1`); await sleep(600);
await hold(['KeyW'], 150); log('near photograph', await pos());
await b.shot(`${out}/03-prompt.png`);
await key('KeyE', 'rawKeyDown'); await sleep(100); await key('KeyE', 'keyUp'); await sleep(400); log('after E', await pos());
await b.shot(`${out}/04-reading.png`);
// walls: run into the long wall at x = -14 and make sure we stop before it
await b.eval(`window.__game.setGame({ mode: 'playing', reading: null }); window.__player.teleport = new window.__player.position.constructor(-11.9, 0, 4); window.__player.camYaw = -Math.PI/2; 1`); await sleep(500);
await hold(['KeyW', 'ShiftLeft'], 1500); log('pressed into wall (x must stay > -13.5)', await pos());
// slopes: 44° should be climbable, 58° not
await b.eval(`window.__player.teleport = new window.__player.position.constructor(-4, 0, -8.5); window.__player.camYaw = 0; 1`); await sleep(500);
await hold(['KeyW'], 2500); log('44° ramp after 2.5s (y should rise)', await pos());
await b.eval(`window.__player.teleport = new window.__player.position.constructor(0, 0, -8.5); 1`); await sleep(500);
await hold(['KeyW'], 2500); log('58° ramp after 2.5s (y should stay low)', await pos());
// stairs at x=6 from z=-8 going -z
await b.eval(`window.__player.teleport = new window.__player.position.constructor(6, 0, -6.5); 1`); await sleep(500);
await hold(['KeyW'], 2500); log('stairs after 2.5s (y should reach ~1.7)', await pos());
await b.shot(`${out}/05-stairs.png`);
// camera collision: stand in the corridor and rotate the camera towards the wall
await b.eval(`window.__player.teleport = new window.__player.position.constructor(-12, 0, 8); window.__player.camYaw = Math.PI/2; window.__player.camDistance = 5; 1`); await sleep(800);
log('camera in corridor', await b.eval(`JSON.stringify({cam: window.__r3f.camera.position.toArray().map(v=>+v.toFixed(2))})`), '(camera x must stay between -14 and -10)');
await b.shot(`${out}/06-camera-corridor.png`);
await b.close();

// Close-up captures of the character in idle / walk / run, front and side (headless Chrome).
import { launch } from './cdp.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = 'scripts/dev/out';
const b = await launch(process.cwd() + '/.chrome-pose', 9392);
await b.viewport(900, 900);
await b.goto('http://localhost:4173/?debug', 1500);
await b.eval(`[...document.querySelectorAll('button')].find(x=>/Start the Journey/.test(x.innerText)).click(); 1`);
for (let i = 0; i < 40; i++) { await sleep(500); if (await b.eval(`!!window.__game && window.__game.getGame().mode==='intro'`).catch(() => false)) break; }
await b.eval(`window.__game.setGame({mode:'playing'}); document.querySelector('.hud').style.display='none'; 1`);
const key = (code, type) => b.send('Input.dispatchKeyEvent', { type, code, key: code, windowsVirtualKeyCode: { KeyW: 87, ShiftLeft: 16 }[code] });
const view = (yaw) => b.eval(`window.__player.camYaw=${yaw}; window.__player.camPitch=0.08; window.__player.camDistance=2.6; 1`);
// character faces the direction of travel; camYaw 0 = camera behind (+z) looking -z
await view(Math.PI); await sleep(900); await b.shot(`${out}/pose-idle-front.png`);
await view(Math.PI / 2); await sleep(600); await b.shot(`${out}/pose-idle-side.png`);
await view(0); await key('KeyW', 'rawKeyDown'); await sleep(900); await view(-Math.PI / 2 + 0.0001); await sleep(350); await b.shot(`${out}/pose-walk-side.png`);
await key('ShiftLeft', 'rawKeyDown'); await sleep(900); await b.shot(`${out}/pose-run-side.png`);
await key('ShiftLeft', 'keyUp'); await key('KeyW', 'keyUp'); await b.close();
// airborne + interaction poses
{
  const b2 = await launch(process.cwd() + '/.chrome-pose', 9392);
  await b2.viewport(900, 900);
  await b2.goto('http://localhost:4173/?debug', 1500);
  await b2.eval(`[...document.querySelectorAll('button')].find(x=>/Start the Journey/.test(x.innerText)).click(); 1`);
  for (let i = 0; i < 40; i++) { await sleep(500); if (await b2.eval(`!!window.__game && window.__game.getGame().mode==='intro'`).catch(() => false)) break; }
  await b2.eval(`window.__game.setGame({mode:'playing'}); document.querySelector('.hud').style.display='none'; window.__player.camYaw=Math.PI/2; window.__player.camPitch=0.08; window.__player.camDistance=3.2; 1`);
  await sleep(800);
  await b2.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
  await sleep(160); await b2.shot(`${out}/pose-jump.png`);
  await b2.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ', windowsVirtualKeyCode: 32 });
  await sleep(330); await b2.shot(`${out}/pose-fall.png`);
  await sleep(260); await b2.shot(`${out}/pose-land.png`);
  // inspect: stand next to the photograph and press E
  await b2.eval(`window.__player.teleport = new window.__player.position.constructor(-3, 0, 5.2); window.__player.camYaw = Math.PI/2; 1`); await sleep(900);
  await b2.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'KeyE', key: 'e', windowsVirtualKeyCode: 69 });
  await sleep(60); await b2.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyE', key: 'e', windowsVirtualKeyCode: 69 });
  await b2.eval(`document.querySelectorAll('.narrative, .hud, [class*=panel]').forEach(e=>e.style.display='none'); 1`);
  await sleep(1500); await b2.shot(`${out}/pose-interact.png`);
  await b2.close();
}

/* Keyboard + mouse input, read by the controller every frame (no React state).
   W/A/S/D or arrows move, Shift runs, Space jumps, E interacts, mouse looks (pointer lock, or drag as a fallback),
   wheel zooms. Esc is handled by the browser (it releases pointer lock) and turned into "pause" by the game. */

export const input = {
  forward: 0, right: 0,           // -1 … 1
  run: false,
  jumpPressed: false,             // edge-triggered: consumed by the controller
  interactPressed: false,         // edge-triggered: consumed by the interaction manager
  lookX: 0, lookY: 0,             // accumulated mouse deltas, consumed by the camera
  zoom: 0,                        // accumulated wheel delta
  enabled: false,
};

const keys = new Set<string>();
const recompute = () => {
  input.forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  input.right = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  input.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
};

let dragging = false, target: HTMLElement | null = null;

const onKeyDown = (e: KeyboardEvent) => {
  if (!input.enabled) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space') input.jumpPressed = true;
  if (e.code === 'KeyE') input.interactPressed = true;
  recompute();
};
const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); recompute(); };
const onBlur = () => { keys.clear(); recompute(); };
const onMouseMove = (e: MouseEvent) => {
  if (!input.enabled) return;
  if (document.pointerLockElement === target || dragging) { input.lookX += e.movementX; input.lookY += e.movementY; }
};
const onDown = (e: MouseEvent) => { if (e.button === 0 && document.pointerLockElement !== target) dragging = true; };
const onUp = () => { dragging = false; };
const onWheel = (e: WheelEvent) => { if (input.enabled) { input.zoom += Math.sign(e.deltaY); e.preventDefault(); } };

export function attachInput(el: HTMLElement) {
  target = el;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  el.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('mousemove', onMouseMove);
    el.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
    el.removeEventListener('wheel', onWheel);
    keys.clear(); recompute(); target = null;
  };
}

export function clearInput() {
  keys.clear(); recompute();
  input.jumpPressed = false; input.interactPressed = false; input.lookX = 0; input.lookY = 0; input.zoom = 0;
}

export async function lockPointer(el: HTMLElement) {
  try { await (el.requestPointerLock as (o?: { unadjustedMovement?: boolean }) => Promise<void> | void).call(el, { unadjustedMovement: true }); }
  catch { try { await el.requestPointerLock(); } catch { /* not allowed: drag-to-look still works */ } }
}

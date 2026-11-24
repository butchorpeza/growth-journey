/* Keyboard + mouse input, read by the controller every frame (no React state).
   W/A/S/D or arrows move, Shift sprints, Space jumps, E interacts. Esc is handled by the browser (it releases
   pointer lock) and turned into "pause" by the game.

   Mouse look, no button needed:
   - Pointer lock (taken on "Start exploring" where the browser allows it): unlimited turning, cursor hidden.
   - Hover look (whenever the mouse isn't locked, e.g. embedded previews): the view follows the mouse as it moves
     over the game, and holding the cursor near an edge keeps turning that way (see `pointer`, used by the camera). */

export const input = {
  forward: 0, right: 0,           // -1 … 1
  run: false,
  jumpPressed: false,             // edge-triggered: consumed by the controller
  interactPressed: false,         // edge-triggered: consumed by the interaction manager
  lookX: 0, lookY: 0,             // accumulated mouse deltas, consumed by the camera
  scroll: 0,                      // accumulated scroll (px, + = forward), consumed by the scroll-mode path
  enabled: false,
};

/** cursor over the game while the mouse isn't locked: -1 … 1 from the centre (x right, y down) */
export const pointer = { x: 0, y: 0, over: false };

const keys = new Set<string>();
const recompute = () => {
  input.forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  input.right = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  input.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
};

let target: HTMLElement | null = null;

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
const onBlur = () => { keys.clear(); recompute(); pointer.over = false; };
const onMouseMove = (e: MouseEvent) => {
  if (!target) return;
  const locked = document.pointerLockElement === target;
  if (!locked) {
    const r = target.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    pointer.over = Math.abs(pointer.x) <= 1 && Math.abs(pointer.y) <= 1;
  }
  if (!input.enabled || (!locked && !pointer.over)) return;
  input.lookX += e.movementX; input.lookY += e.movementY;
};
const onLeave = () => { pointer.over = false; };
// scroll mode: wheel / trackpad / vertical swipe move along the path (down = forward)
const onWheel = (e: WheelEvent) => { if (!input.enabled) return; input.scroll += e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY; e.preventDefault(); };
let touchY: number | null = null;
const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? null; };
const onTouchMove = (e: TouchEvent) => { if (!input.enabled || touchY === null) return; const y = e.touches[0].clientY; input.scroll += (touchY - y) * 2; touchY = y; };

export function attachInput(el: HTMLElement) {
  target = el;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  document.documentElement.addEventListener('mouseleave', onLeave);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: true });
  return () => {
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('mousemove', onMouseMove);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    keys.clear(); recompute(); target = null; pointer.over = false;
  };
}

export function clearInput() {
  keys.clear(); recompute();
  input.jumpPressed = false; input.interactPressed = false; input.lookX = 0; input.lookY = 0; input.scroll = 0;
}

export async function lockPointer(el: HTMLElement) {
  try { await (el.requestPointerLock as (o?: { unadjustedMovement?: boolean }) => Promise<void> | void).call(el, { unadjustedMovement: true }); }
  catch { try { await el.requestPointerLock(); } catch { /* not allowed here: hover look still works */ } }
}

/* Reusable interaction framework (works in scroll mode and free mode).
   <Interactable id label verb narrativeId? onInteract? reach?>…object…</Interactable> registers a point of interest.
   The InteractionManager (mounted once in the scene) checks every registered object each frame:
   - marker: is it on screen, within 30 m, and not hidden behind something (a BVH ray from the eye, a few times a
     second)? Then a white diamond floats over it (InteractionMarkers, HTML overlay).
   - in reach: within `reach` of the eye and visible → the diamond lights up; the one closest to the centre of the
     view becomes the E prompt. Pressing E is optional: the visitor can scroll or walk on.
   Default action: open the narrative entry and pause movement. */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Group, Raycaster, Vector3, type Object3D } from 'three';
import { discover, getGame, setGame } from '../game/GameState';
import { VIEW } from '../player/movement';
import { input } from '../player/PlayerInput';

export interface InteractableProps {
  id: string;
  verb?: string;                       // "inspect", "open", "travel"
  label: string;                       // object name for the prompt
  narrativeId?: string;                // entry in data/narrative.ts to show
  onInteract?: () => void;
  position?: [number, number, number];
  reach?: number;                      // max distance in metres from the eye (default VIEW.interactReach + margin)
  children?: ReactNode;
}

interface Entry { id: string; verb: string; label: string; reach: number; obj: Group; run: () => void }
const registry = new Map<Object3D, Entry>();

/** screen state of every marker, written by the InteractionManager each frame and read by the HTML overlay */
export interface MarkerState { x: number; y: number; visible: boolean; active: boolean }
export const markers = new Map<string, MarkerState>();

const REACH = VIEW.interactReach + 0.8;   // ~3.4 m: comfortable in scroll mode, where you can't step closer at will
const MARKER_RANGE = 30;

export function Interactable({ id, verb = 'inspect', label, narrativeId, onInteract, position = [0, 0, 0], reach = REACH, children }: InteractableProps) {
  const group = useRef<Group>(null);
  useEffect(() => {
    const g = group.current; if (!g) return;
    const run = () => {
      discover(id);
      if (onInteract) onInteract();
      else if (narrativeId) { setGame({ mode: 'reading', reading: narrativeId, prompt: null }); document.exitPointerLock?.(); }
    };
    registry.set(g, { id, verb, label, reach, obj: g, run });
    return () => { registry.delete(g); markers.delete(id); if (getGame().prompt?.id === id) setGame({ prompt: null }); };
  }, [id, verb, label, narrativeId, onInteract, reach]);
  return <group ref={group} position={position}>{children}</group>;
}

/** the interactable that owns this object, if any */
function owner(o: Object3D | null): Entry | null {
  for (let n = o; n; n = n.parent) { const e = registry.get(n); if (e) return e; }
  return null;
}

/** mount once inside the scene */
export function InteractionManager() {
  const camera = useThree((s) => s.camera), scene = useThree((s) => s.scene), size = useThree((s) => s.size);
  const ray = useMemo(() => { const r = new Raycaster(); (r as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true; return r; }, []);
  const tmp = useMemo(() => ({ w: new Vector3(), ndc: new Vector3(), dir: new Vector3() }), []);
  const occluded = useRef(new Map<string, boolean>()), frame = useRef(0), current = useRef<string | null>(null);

  useFrame(() => {
    const g = getGame(), playing = g.mode === 'playing';
    const checkOcclusion = frame.current++ % 4 === 0;
    let target: Entry | null = null, bestCentre = Infinity;
    registry.forEach((e) => {
      e.obj.getWorldPosition(tmp.w);
      const dist = tmp.w.distanceTo(camera.position);
      tmp.ndc.copy(tmp.w).project(camera);
      const onScreen = tmp.ndc.z < 1 && Math.abs(tmp.ndc.x) < 1 && Math.abs(tmp.ndc.y) < 1;
      if (checkOcclusion && onScreen && dist < MARKER_RANGE) {
        ray.set(camera.position, tmp.dir.copy(tmp.w).sub(camera.position).normalize()); ray.far = dist + 0.5;
        const hit = ray.intersectObject(scene, true).find((h) => h.object.visible && (h.object as { isMesh?: boolean }).isMesh);
        occluded.current.set(e.id, !!hit && owner(hit.object) !== e && hit.distance < dist - 0.6);
      }
      const visible = playing && onScreen && dist < MARKER_RANGE && !occluded.current.get(e.id);
      const inReach = visible && dist < e.reach;
      const centre = Math.hypot(tmp.ndc.x, tmp.ndc.y);
      // marker sits a little above the object's centre
      tmp.ndc.copy(tmp.w).setY(tmp.w.y + 0.35).project(camera);
      markers.set(e.id, { x: (tmp.ndc.x * 0.5 + 0.5) * size.width, y: (-tmp.ndc.y * 0.5 + 0.5) * size.height, visible, active: false });
      if (inReach && centre < bestCentre) { bestCentre = centre; target = e; }
    });
    const t = target as Entry | null;
    if (t) markers.get(t.id)!.active = true;
    const key = t ? `${t.id}|${t.verb}|${t.label}` : null;
    if (key !== current.current) {
      current.current = key;
      setGame({ prompt: t ? { id: t.id, verb: t.verb, label: t.label } : null });
    }
    if (input.interactPressed) {
      input.interactPressed = false;                     // an unused press never fires later by surprise
      t?.run();
    }
  });
  return null;
}

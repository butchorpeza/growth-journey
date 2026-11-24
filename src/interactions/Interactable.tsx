/* Reusable interaction framework (first-person raycast).
   <Interactable id label verb narrativeId? onInteract? reach?>…object…</Interactable> registers a point of interest.
   The InteractionManager (mounted once in the scene) casts a ray from the centre of the view every frame. If the
   first surface it hits within reach belongs to an interactable, the HUD shows "E  <Verb> <label>" and the reticle
   lights up; pressing E runs the action (default: open the narrative entry and pause movement).
   Because the ray stops at the first surface, objects behind walls or other props can't be used. */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Group, Raycaster, Vector2, type Object3D } from 'three';
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
  reach?: number;                      // max distance in metres from the eye (default VIEW.interactReach)
  children?: ReactNode;
}

interface Entry { id: string; verb: string; label: string; reach: number; run: () => void }
const registry = new Map<Object3D, Entry>();

export function Interactable({ id, verb = 'inspect', label, narrativeId, onInteract, position = [0, 0, 0], reach = VIEW.interactReach, children }: InteractableProps) {
  const group = useRef<Group>(null);
  useEffect(() => {
    const g = group.current; if (!g) return;
    const run = () => {
      discover(id);
      if (onInteract) onInteract();
      else if (narrativeId) { setGame({ mode: 'reading', reading: narrativeId, prompt: null }); document.exitPointerLock?.(); }
    };
    registry.set(g, { id, verb, label, reach, run });
    return () => { registry.delete(g); if (getGame().prompt?.id === id) setGame({ prompt: null }); };
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
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const ray = useMemo(() => { const r = new Raycaster(); r.far = Math.max(VIEW.interactReach, 6); return r; }, []);
  const centre = useMemo(() => new Vector2(0, 0), []);
  const current = useRef<string | null>(null);

  useFrame(() => {
    const g = getGame();
    let target: Entry | null = null;
    if (g.mode === 'playing' && registry.size) {
      ray.setFromCamera(centre, camera);
      // first visible surface in front of the eye: anything nearer (a wall, another prop) blocks the interaction
      const hit = ray.intersectObject(scene, true).find((h) => h.object.visible && (h.object as { isMesh?: boolean }).isMesh);
      const e = hit ? owner(hit.object) : null;
      if (e && hit && hit.distance <= e.reach) target = e;
    }
    const id = target?.id ?? null;
    if (id !== current.current) {
      current.current = id;
      setGame({ prompt: target ? { id: target.id, verb: target.verb, label: target.label } : null });
    }
    if (input.interactPressed) {
      input.interactPressed = false;                     // an unused press never fires later by surprise
      target?.run();
    }
  });
  return null;
}

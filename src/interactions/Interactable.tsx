/* Reusable interaction framework.
   <Interactable id label verb narrativeId? onInteract? radius?>…object…</Interactable> registers a point of interest.
   The InteractionManager (mounted once in the scene) finds the nearest registered object within reach of the
   player every frame, shows "E  <Verb> <label>", and runs its action when E is pressed (default: open the
   narrative entry and pause movement). Proximity is measured directly (cheap and reliable for a kinematic
   character, which Rapier sensors don't report against fixed bodies by default). */
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import { Group, Vector3 } from 'three';
import { discover, getGame, setGame } from '../game/GameState';
import { input } from '../player/PlayerInput';
import { playerState } from '../player/playerState';

export interface InteractableProps {
  id: string;
  verb?: string;                       // "inspect", "open", "travel"
  label: string;                       // object name for the prompt
  narrativeId?: string;                // entry in data/narrative.ts to show
  onInteract?: () => void;
  position?: [number, number, number];
  radius?: number;                     // reach in metres (horizontal)
  children?: ReactNode;
}

interface Entry { id: string; verb: string; label: string; radius: number; world: Vector3; run: () => void }
const registry = new Map<string, Entry>();

export function Interactable({ id, verb = 'inspect', label, narrativeId, onInteract, position = [0, 0, 0], radius = 1.6, children }: InteractableProps) {
  const group = useRef<Group>(null);
  useEffect(() => {
    const world = new Vector3();
    group.current?.getWorldPosition(world);
    const run = () => {
      discover(id);
      if (onInteract) onInteract();
      else if (narrativeId) { setGame({ mode: 'reading', reading: narrativeId, prompt: null }); document.exitPointerLock?.(); }
    };
    registry.set(id, { id, verb, label, radius, world, run });
    return () => { registry.delete(id); if (getGame().prompt?.id === id) setGame({ prompt: null }); };
  }, [id, verb, label, narrativeId, onInteract, radius]);
  return <group ref={group} position={position}>{children}</group>;
}

/** mount once inside the scene */
export function InteractionManager() {
  const current = useRef<string | null>(null);
  useFrame(() => {
    const g = getGame();
    let best: Entry | null = null, bestD = Infinity;
    if (g.mode === 'playing') {
      const p = playerState.position;
      registry.forEach((e) => {
        const d = Math.hypot(e.world.x - p.x, e.world.z - p.z);
        if (d < e.radius && Math.abs(e.world.y - p.y) < 2.5 && d < bestD) { best = e; bestD = d; }
      });
    }
    const id = (best as Entry | null)?.id ?? null;
    if (id !== current.current) {
      current.current = id;
      const b = best as Entry | null;
      setGame({ prompt: b ? { id: b.id, verb: b.verb, label: b.label } : null });
    }
    if (input.interactPressed) {
      input.interactPressed = false;                     // an unused press never fires later by surprise
      if (best) (best as Entry).run();
    }
  });
  return null;
}

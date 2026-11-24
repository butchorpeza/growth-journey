/* Game-wide state (React re-renders on change) + saved progress (localStorage, no personal data).
   Frame-rate data (player position, velocity, camera yaw) lives in player/playerState.ts instead. */
import { useSyncExternalStore } from 'react';
import type { ChapterId } from '../data/chapters';

export type GameMode = 'loading' | 'intro' | 'playing' | 'paused' | 'reading';

export interface Prompt { id: string; verb: string; label: string }
export interface Settings { sensitivity: number; invertY: boolean; quality: 'high' | 'medium' | 'low'; audio: boolean; volume: number; reducedMotion: boolean; widescreenBars: boolean; movement: 'scroll' | 'free'; guide: boolean }
export interface SaveData { chapter: ChapterId; checkpoint: string | null; completed: ChapterId[]; discovered: string[]; restored: string[] }

export interface GameState {
  mode: GameMode;
  chapter: ChapterId;
  prompt: Prompt | null;       // what "E" would do right now
  reading: string | null;      // narrative entry id open in the panel
  pointerLocked: boolean;
  loadProgress: number;        // 0…100 while assets load
  settings: Settings;
  save: SaveData;
}

const SAVE_KEY = 'bo-journey-save-v1', SETTINGS_KEY = 'bo-journey-settings-v1';
const load = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? { ...fallback, ...JSON.parse(v) } : fallback; } catch { return fallback; } };
const store = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: progress just isn't kept */ } };

const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const defaultSettings: Settings = { sensitivity: 1, invertY: false, quality: 'high', audio: true, volume: 0.7, reducedMotion: !!prefersReducedMotion, widescreenBars: false, movement: 'scroll', guide: true };
const defaultSave: SaveData = { chapter: 'survival', checkpoint: null, completed: [], discovered: [], restored: [] };

/** settings the visitor doesn't choose (the pause menu only offers volume and movement): High graphics, sound on
 *  (volume 0 mutes it), full screen without bars, normal look, and reduced motion from the system preference.
 *  Applied on every load, so settings saved by earlier builds can't leave anyone on Low or muted. */
function migrateSettings(s: Settings & { rev?: number }): Settings {
  const fixed = { quality: 'high' as const, audio: true, widescreenBars: false, invertY: false, sensitivity: 1, reducedMotion: !!prefersReducedMotion };
  const known = Object.fromEntries(Object.keys(defaultSettings).map((k) => [k, s[k as keyof Settings] ?? defaultSettings[k as keyof Settings]])) as unknown as Settings;   // drops keys from older builds
  const next = { ...known, ...fixed };
  if (JSON.stringify(next) !== JSON.stringify(s)) store(SETTINGS_KEY, next);
  return next;
}

/** Chapter 01 is the starting world; ?range opens the technical test range instead */
const startChapter: ChapterId = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('range') ? 'prototype' : 'survival';

let state: GameState = {
  mode: 'loading', chapter: startChapter, prompt: null, reading: null, pointerLocked: false, loadProgress: 0,
  settings: migrateSettings(load(SETTINGS_KEY, defaultSettings)), save: load(SAVE_KEY, defaultSave),
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getGame = () => state;
export function setGame(patch: Partial<GameState>) { state = { ...state, ...patch }; emit(); }
export function updateSettings(patch: Partial<Settings>) { state = { ...state, settings: { ...state.settings, ...patch } }; store(SETTINGS_KEY, state.settings); emit(); }
export function updateSave(patch: Partial<SaveData>) { state = { ...state, save: { ...state.save, ...patch } }; store(SAVE_KEY, state.save); emit(); }
export function discover(id: string) { if (!state.save.discovered.includes(id)) updateSave({ discovered: [...state.save.discovered, id] }); }
export function resetProgress() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } state = { ...state, save: { ...defaultSave } }; emit(); }

export const subscribeGame = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export function useGame<T>(select: (s: GameState) => T): T {
  return useSyncExternalStore(subscribeGame, () => select(state), () => select(state));
}

# Story audit: where Chapter 01 and Chapter 02's content lives

This is Phase 1 of the "Personalize my 3D About Me" brief. It records the project as it stands, before the story changes.

## Content and configuration

| What | File |
|---|---|
| Chapter list, titles, taglines | `src/data/chapters.ts` |
| Chapter 01 panels (title, text, photos) | `src/data/chapter01.ts` (`DISCOVERIES`) |
| Chapter 02 panels | `src/data/chapter02.ts` (`SHADOWS_DISCOVERIES`) |
| Photographs (collage, K9, the cat) | `src/data/photos.ts` |
| Voice lines and subtitles | `src/data/narration.ts`, `src/audio/narrator.ts`, `src/interface/Subtitles.tsx` |
| Older plain-text entries | `src/data/narrative.ts` (the end-of-road placeholder) |

The narrator plays the owner's recording when the file exists, else a placeholder. It is switched off (`NARRATION_ENABLED = false`), so nothing is spoken. The generated Kokoro placeholder recordings (`public/audio/chapter-01/*.m4a`) read old text and are not the owner's voice.

## Interaction system

There is a single system, `src/interactions/Interactable.tsx`:
- it registers each object and draws the white diamond (`InteractionMarkers.tsx`);
- E opens the panel (`src/interface/InfoPanel.tsx`), and the camera frames the object (`src/player/viewFocus.ts`);
- the photo wall opens the photo-by-photo viewer instead of a panel.

### Chapter 01 objects

| Id | Where it is placed | Note |
|---|---|---|
| `survival-lamp` | `SurvivalChapter.tsx`, from `layout.json` | |
| `survival-photograph` | `Discoveries.tsx` (the photo wall) | |
| `survival-k9` | `Animals.tsx` | |
| `survival-cat` | `Animals.tsx` | |
| `survival-motorbike` | `Discoveries.tsx` | The motorbike is "Rusty Motorbike" (Sketchfab), a real motorcycle, not a rickshaw. |
| `survival-sungka` | `SurvivalChapter.tsx` | The board is inside `world.glb` and is moved onto the shelter bench by `placeSungka`. |

### Chapter 02 objects

| Section | Objects (E) |
|---|---|
| The courtyard (`Courtyard.tsx`) | fountain, suitcase, statue |
| The house (`House.tsx`) | clock, photograph, mirror, bookcase, rocking chair, fireplace, cabinet, dust sheets, bed |

All of these have generic, symbolic text. None of it is personal.

## Movement, camera, collision

- Free mode (WASD): `src/player/Player.tsx`, using a Rapier character controller. Shift runs and Space jumps.
- Scroll mode: `src/player/RailController.tsx` moves along each chapter's path (`SURVIVAL_PATH`, `SHADOWS_PATH`).
- Input: `src/player/PlayerInput.ts`.
- Camera: `src/player/PlayerCamera.tsx`. Its framing, shake and takeovers come from `src/game/director.ts`.

## Transitions and the pursuit

- Chapter 01 → 02: `src/chapters/survival/PortalPull.tsx` (the fall through the portal, then a chapter switch in the black).
- Chapter 02 opening: `src/chapters/shadows/Intro.tsx`.
- Ending: `src/chapters/shadows/Descent.tsx` (`Ending`).
- Pursuit: `src/chapters/shadows/Pursuit.tsx`, covering the sighting, the standoff, the chase, a catch and its retry, and the escape at the gate.
  - The creature itself is `Creature.tsx`, using THE RAKE's own animations.
  - In scroll mode, the chase currently needs constant scrolling.

## Assets

- Chapter 01: `public/models/survival/` (`world.glb`, houses, vehicles, flora, animals).
- Chapter 02: `public/models/shadows/` (props, creature, birds, rocks, smoke).
- Everything is GLB with meshopt geometry and WebP textures.

## After the personalisation (Phases 2 to 5)

### Content: one place to edit

- Chapter 01 panels: `src/data/chapter01.ts`. Chapter 02 panels and subtitle lines: `src/data/chapter02.ts` (`SHADOWS_DISCOVERIES`, `SHADOWS_LINES`).
- `src/data/narration.ts` builds every voice and subtitle line from those files, so the text is written once.
- No recordings exist yet. The narrator keeps its placeholder path (`public/audio/chapter-01/<id>.mp3` when the owner records them) and stays off. The generated stand-in voice files were removed because they read old text in a voice that isn't the owner's.

### Chapter 01

| Id | Object | Story |
|---|---|---|
| `survival-lamp` | oil lamp | The people who raised me (his grandparents) |
| `survival-cat` | the cat | Minggay, with her real photo. She is missing; nothing says otherwise. |
| `survival-games` | games corner on the shelter bench (console, gamepad, sketchbook) | Games and drawings. This replaces the sungka board, which is now hidden. |
| `survival-motorbike` | motorbike | The family's motorcycle |
| `survival-computer` | **new**: an old computer on a desk in house A | My grandfather's help (the first opportunity, freelancing) |
| `survival-photograph`, `survival-k9` | photo wall, K9 | Unchanged |

All seven must be seen before the portal pulls the visitor in (`PortalPull.tsx`).

### Chapter 02

| Section | Where | What |
|---|---|---|
| 01 The Entrance | an empty family portrait leaning on the gate pillar (`Portrait.tsx`) | `shadows-portrait` |
| 02 The Forgotten Grounds | the courtyard statue | `shadows-statue` (the fountain and suitcase panels were removed) |
| 03 The House of Memories | drawing desk, TV and games, empty rocking chair (`House.tsx`) | `shadows-drawing`, `shadows-games`, `shadows-chair` (the clock, photograph and mirror panels were removed) |
| 04 The Descent | the corridor | subtitles `descent`, shown as the creature is first seen |
| 05 The Threshold | the ledge at dawn | subtitles `threshold`. Light warms over 14 s before the card. |

### The pursuit in both modes

- **WASD:** hold Shift + W to sprint. Space jumps, as before, and still does after the chase.
- **Scroll:** once the chase starts the visitor moves forward on their own (2.2 m/s). Each tap of Space adds momentum, which fades within a second or two; scrolling isn't needed. The mouse still looks around.
  - In scroll mode the rail holds the visitor a little way into the corridor (`rail.cap`) until the creature comes. Before this, fast scrolling went straight past the trigger.
- Camera shake was reduced throughout.

### Tested (manual frame stepping in the browser, 30 fps)

| Case | Result |
|---|---|
| Scroll mode, Space at 2.5 taps/s | escaped, with the creature about 4 m behind |
| Scroll mode, no taps | caught on the stairs after about 6 s; jump scare, then restart at the corridor |
| WASD, Shift + W | escaped, then the ending |
| Subtitles | descent lines appear at the sighting; threshold lines appear at the ending |
| Panels | every Chapter 01 and Chapter 02 panel opens with the new text |
| Prompts | the computer and the games corner show their E prompts |

### Found in the visual review

- The solid west wing of the mansion (`Estate.tsx`) stood 2.5 m inside the living room. It hid that end of the room, the TV corner included, though the walls you collide with were further out. It now stops at the main block's west wall; the outside is unchanged.
- The TV now gives off a faint cold glow, so the games corner can be found in the dark.

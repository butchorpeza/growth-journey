# Chapter 02 · The Shadows: build plan

Chapter 02 had no map before this work; it was only listed as "planned" in `src/data/chapters.ts`. So there was no existing layout to preserve. Everything below sits on a new island in `src/chapters/shadows/`. Chapter 01 is unchanged, apart from its exit.

## Done

### The way in from Chapter 01

The portal has no panel or text any more. Walking into it plays the fall, which ends in black, and the game switches to Chapter 02 in that black. Chapter 02's opening fades in from it.

- With all six discoveries found, the pull takes the visitor from about 6 m away.
- Without them, walking right up to the portal (or reaching the end of the scroll path, 4.3 m away) takes them through.
- Progress saves `chapter: 'shadows'` and marks Chapter 01 completed.
- For building and testing, `?chapter=shadows` starts in Chapter 02 directly.

### Section 01: The Entrance of Isolation

- **Island:** an island in a near-black sea. The sea has moving water, a broken path of moonlight and foam on the shore. The sky is a heavy overcast with a moon behind it, plus far-off lightning.
- **Gate:** two weathered stone pillars, one with its finial fallen into the grass. A wrought-iron double gate with spear-tipped bars, rings and a scrolled arch; one leaf hangs open and sags.
- **Boundary wall:** a low stone wall with iron railings running from the gate to the cliffs. It has a collapsed stretch, bent bars, and lengths of railing lying in the grass.
- **Avenue:** an overgrown path with six old lamps. Two give a weak amber light, two are failing, and two are dead.
- **Trees and grass:** thirteen bare, twisted dead trees, and dry grass that moves in the wind.
- **Mansion:** on its terrace in the north, mostly a silhouette against the moonlit cloud. It has a main block, two wings, a tower, chimneys, a columned porch, boarded windows, and a few unevenly lit windows (one flickers; two are cold).
- **Fog:** low layers drifting over the ground, thicker towards the sea.
- **Sound:** wind that gusts and moans, the sea washing and breaking on the rocks, and rare whispers that can't be made out. The score is a low beating drone, a thin high tone, falling detuned bell notes, and a slow heartbeat pulse.
- **Controls:** both control modes work. Scroll mode follows a path from the meadow through the gate and down the avenue. WASD is free movement, kept on the island by the cliff tops.

### Opening

The opening runs about 11 s and can be skipped:

1. Black.
2. The eyes open, lying in the grass under the night sky, with a heavy blink.
3. He gets up onto one knee, then stands at the gate.
4. The view lifts and narrows onto the mansion.
5. Lightning. For as long as the flash lasts, something tall stands beside the avenue beyond the gate. It is gone when the light goes.
6. The title card: **THE SHADOWS**, with the line "Not everything we leave behind *stays behind.*"
7. The view eases back to the gate and control returns.

## Done (second pass)

**Assets.** These were downloaded with your approval:
- 20 Poly Haven models (CC0)
- 6 Poly Haven texture sets (CC0)
- the three.js Xbot rig, used for the creature

After optimisation they total about 12 MB. They start downloading in the background once Chapter 01's story begins, so Chapter 02 is ready by the portal.

**02 · The Forgotten Grounds.** The avenue now bends round a dry, cracked fountain (the broken piece of the bowl lies in the basin) on a circle of mossy cobbles. Around it:
- four benches, one tipped over
- the statue on its plinth, facing the house
- two marble busts
- urns, one fallen
- old lanterns on stone posts (two lit)
- dead flower beds
- an abandoned table and chairs
- a suitcase left by a bench
- loose stones

Optional E objects: the fountain, the suitcase and the statue (texts in `src/data/chapter02.ts`; symbolic only).

**03 · The House of Memories.** You enter through the front door, which opens as you reach it.
- **Hall:** a dim chandelier, a grandfather clock (E), a cabinet, and a console with a photograph (E). After you have seen the photograph and looked away, a tall figure is standing in the doorway in it. A staircase leads up to a landing where the upper flight has collapsed.
- **Living room:** a stone fireplace, a sofa, armchairs, a bookcase, and a candle. A rocking chair rocks on its own and slows when you watch it.
- **Side room:** furniture under dust sheets, a mirror (E) and a commode. Its door is found standing open after you look away. Something falls upstairs the first time you step in.
- **Corridor:** long and low, with sconces and frames. A shadow slides along the wall with a whisper.
- **Bedroom:** a bed, a commode, a mirror, and curtains moving at the window.

Moonlight comes through the windows. Indoors, the sky's fill light is turned down so the rooms are properly dark.

**The creature.** It is about 2.5 m tall and narrow. Its arms are lengthened past the knees, its hands are too large, its spine is hunched, and its head is small, bowed and tipped to one side. Its surface is a nearly light-swallowing black with an organic relief and only a faint cold edge. It uses real motion-captured idle, walk and run, timed to its speed so the feet don't slide.

**The sighting and the pursuit (03 → 04).**
1. **Sighting:** the first time you enter the corridor, the far lights fail and it stands at the far end. Darkness, then it is gone.
2. **Trigger:** further along, towards the stairs, you hear footsteps behind you and the lights stutter.
3. **Standoff:** the view turns back to it, standing at the far west end. The bulbs burst one by one, it cries out and runs, and **RUN** appears (with "Hold Shift" in WASD mode, "Keep scrolling" in scroll mode).
4. **Chase:** it follows the corridor, comes down the stairs fast, and enters the brick passage under the grounds.
   - It keeps about 5–6 m behind a running visitor and closes on one who stops.
   - If caught: black, and the chase restarts from the corridor.
5. **Escape:** through the heavy door, which slams. Something strikes it from the other side, then silence, and the card *The Shadows · 04 · The Descent* appears.

At a run the chase takes about 15–20 s, plus the standoff. Skip, reduced motion and camera-effects settings are respected.

## Done (third pass): the whole chapter

### Your additions

**The creature is scarier:**
- Two small eyes that shine cold in the dark like an animal's.
- A veil of long hanging strands over its face.
- Long claws from the fingertips.
- A lumpy surface that slowly writhes.
- Now and then the head snaps to a new angle and holds it.

**Its face, and its voice:**
- A mouth split far too wide across its face, with two rows of long needle teeth. The jaw works slackly as it runs and drops open further than any jaw should when it screams.
- Its eyes flicker.
- The voice is now **recorded**, not synthesised (the synthesised version sounded like a video game):
  - a real horror scream, pitched down and layered with a deep roar and a second shriek for the jump scare;
  - a roar and shriek when it starts to run;
  - growls through the chase;
  - a heavy breath at the standoff;
  - a distant howl at the first sighting.
- Sources are CC0 (see CREDITS.md).

**Jump scare when it catches you:** the view is pulled onto its face and held there.
1. It lunges into your face.
2. A hard, stuttering light falls on it, with a scream, a hit and a violent shake.
3. The screen edges pulse dark red.
4. Black, then the chase restarts.

With reduced motion it goes straight to black, with no lunge or shake.

**Crows at the gate:** seven crows perch on the iron arch, the pillar tops and the wall. The first time you walk up to the gate they burst up at once: a clatter of wings, harsh caws and a flinch of the view. One flies straight past your head, then they scatter into the dark.

**The golden trail in Chapter 02:** the same guiding motes as Chapter 01. They run along the whole route: the avenue, round the fountain, through the house, down the passage, through the cistern and out to the shore. The trail follows the floor at every level, and the "Guiding trail" setting turns it off.

### The rest of the chapter

**A longer passage.** The pursuit route is now about 76 m: the corridor, the stairs, then five brick runs under the grounds. At a run that is about 17 s, plus the standoff. Turns and stairs slow you, so it typically lands at 20–30 s.

**04 · The Descent:**
- Past the heavy door, steps lead down into the **cistern**: a flooded, vaulted brick chamber with four pillars and their arches, black still water, and a raised stone causeway.
- One lantern was left on the causeway, and cold light falls through a grating in the vault.
- Water drips, and once, far behind, something strikes the door.
- The fog thickens underground, thickest here.

**05 · The Exit:**
- A tunnel climbs from the cistern towards cold light, to a cave mouth in the island's west cliffs.
- Outside is a rock shelf just above the sea.
- Walking out to its end ends the chapter:
  1. The view goes out to sea, and the cloud thins in the west.
  2. A pale gold opens low over the water, reflected in it: the first sign of Chapter 03's light.
  3. Everything fades to a warm white.
- **Closing card:** *End of Chapter 02 · THE SHADOWS*, with the brief's line ("Sometimes, the hardest part of moving forward is confronting the things we have been trying to *leave behind.*") and *Chapter 03 · Rebirth · in production*. It offers **Play Chapter 02 again** or **Back to the website**.
- Progress saves Chapter 02 as completed.

## Not built (nothing exists for them yet)
- Chapter 03 · Rebirth itself.
- The rest of the brief after "CONTROL MODE A — WASD / Normal", which never arrived. The chase uses the existing controls: Shift to run in WASD mode, faster scrolling (or W) in scroll mode.

## The creature model (fourth pass)

The creature is now **"THE RAKE" by The WarVet** (Sketchfab, CC-BY 4.0, credited in CREDITS.md): a professionally made, fully rigged and animated horror creature. It replaces the stretched mannequin.
- It's hunched and long-limbed, with cold glowing eyes and a face that splits open into a maw.
- It uses its own animations: idle; walk; run and sprint (picked by speed, timed so the feet don't slide); an enraged roar as the standoff breaks; and its own jump scare animation when it catches you.
- After optimisation it is 1.2 MB, from a 17 MB download.
- The procedural mouth, teeth, veil and claws are gone, since the model has its own. The head-snapping twitch stays.

## A straight chase (fifth pass)

This is a website first, so the chase is now one straight line with no corners and no maze:
1. east along the corridor;
2. straight down the stairs in the east wing;
3. a short brick tunnel straight on;
4. out of the cliff onto a rock ledge above the sea.

The old iron gate at the tunnel's mouth slams shut behind you. The creature hits the bars, stands there a moment, and the dark takes it. Walking out to the end of the ledge ends the chapter at sunrise in the east (the first gold of Chapter 03).

The winding passage under the grounds, the flooded cistern and the west-side tunnel are gone. The chase is about 10–15 s: short and clear. The scroll path and the golden trail follow the same straight line.

## Sixth pass: realism and atmosphere

- **The way down:**
  - The stairs have proper wooden treads with dark nosings, so every step reads (they looked like one smeared ramp).
  - The outdoor ground-fog layers no longer reach into the house, the stair tunnel or over the ledge. Going downstairs, they had hung there as flat sheets.
  - The tunnel's haze sprites are gone.
- **Rocks:** the faceted generated boulders are replaced with scanned Poly Haven rock faces (CC0) around the tunnel mouth, mossy rocks along the ledge, and a cold light off the sea on them.
- **Crows:**
  - Real models (CC-BY): each perches, plays its own take-off animation, then flies off with real wing-beats.
  - Their sound is now recorded crow calls and wing flaps (CC0) instead of synthesis.
- **The monster:**
  - The stutter came from its run and sprint clips switching back and forth every frame. It now switches with some slack, keeping its stride.
  - The chase follows horror chase design (Outlast 2's designers on Game Developer):
    - it starts abruptly, with footsteps behind you and then every light dying at once;
    - when they snap back on it is already close, rearing up and roaring with a loud sting;
    - it stays about 4–5 m behind, so you feel outmatched;
    - the pattern breaks once: at the top of the stairs the view jerks back to it.
- **Trees:** Chapter 01's rain trees, mango trees and ferns now grow across the island, alongside the dead trees.
- **Light:**
  - stronger moonlight and sky fill;
  - brighter, wider lamps, with more of them working;
  - every courtyard lantern lit;
  - porch lanterns at the door;
  - a brighter chandelier.
- **The house:**
  - A real low smoke haze lies across the floors: thin stacked layers of churning noise with a sickly green in them and a green glow from within.
  - Six more things to press E on: the bookcase, the rocking chair, the fireplace, the cabinet, the dust sheets and the bed.
- **Real smoke:** on top of the haze, photographic vapour sprites ("Smoke vapor particles", OpenGameArt, CC0). They drift low, rise a little, turn, swell and thin out, tinted green.
- **At the gate:** the creature no longer pops out of sight. It throws itself at the bars, stands there breathing, then goes black and dissolves into the dark; its glowing eyes are the last thing to go.
- **Smoke, final:** the layered mist is removed, at your request. Only the real photographic smoke remains in the house.

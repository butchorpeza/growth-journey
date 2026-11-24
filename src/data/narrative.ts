/* Text shown when the player inspects an object. PLACEHOLDERS: Butch will supply the real, personal text.
   Keep each entry short (2–4 sentences); the panel is designed for a quick read. */
export interface NarrativeEntry { id: string; title: string; body: string; placeholder: boolean }

export const narrative: Record<string, NarrativeEntry> = {
  // Chapter 01 · Survival — titles describe the object; the text itself is Butch's to write (nothing is invented)
  'survival-photograph': {
    id: 'survival-photograph', title: 'An old photograph', placeholder: true,
    body: 'Placeholder text. A photograph rests on top of the cabinet. Butch will write what it shows and what it means; until then this panel only marks where that memory belongs.',
  },
  'survival-lamp': {
    id: 'survival-lamp', title: 'An oil lamp', placeholder: true,
    body: 'Placeholder text. An oil lamp lights the table. The words for this object will come from Butch.',
  },
  'survival-sungka': {
    id: 'survival-sungka', title: 'A sungka board', placeholder: true,
    body: 'Placeholder text. A wooden sungka board, the shells still in its pits. Butch will add the story behind it.',
  },
  'survival-road': {
    id: 'survival-road', title: 'A red light at the end of the road', placeholder: true,
    body: 'Placeholder text. The road ends at a burning red threshold. Beyond it is Chapter 02, The Shadows, which begins here once it is built. Butch will write what this moment means.',
  },
  'test-photograph': {
    id: 'test-photograph', title: 'An old photograph', placeholder: true,
    body: 'Placeholder text. In the finished journey, inspecting an object like this opens a short memory or reflection written by Butch. This one exists to test the interaction system: walk up, press E, read, then close to keep exploring.',
  },
  'test-signpost': {
    id: 'test-signpost', title: 'A road leading away', placeholder: true,
    body: 'Placeholder text. Chapter exits will use interactions like this one to start the cinematic transition to the next world.',
  },
};

/* Text shown when the player inspects an object. PLACEHOLDERS: Butch will supply the real, personal text.
   Keep each entry short (2–4 sentences); the panel is designed for a quick read. */
export interface NarrativeEntry { id: string; title: string; body: string; placeholder: boolean }

export const narrative: Record<string, NarrativeEntry> = {
  'test-photograph': {
    id: 'test-photograph', title: 'An old photograph', placeholder: true,
    body: 'Placeholder text. In the finished journey, inspecting an object like this opens a short memory or reflection written by Butch. This one exists to test the interaction system: walk up, press E, read, then close to keep exploring.',
  },
  'test-signpost': {
    id: 'test-signpost', title: 'A road leading away', placeholder: true,
    body: 'Placeholder text. Chapter exits will use interactions like this one to start the cinematic transition to the next world.',
  },
};

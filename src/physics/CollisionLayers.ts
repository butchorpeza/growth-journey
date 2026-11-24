/* Rapier collision groups. A collider is in one membership group and collides with the groups in its filter.
   Player ↔ environment / dynamic props; triggers only detect the player. */
import { interactionGroups } from '@react-three/rapier';

export const LAYER = { PLAYER: 0, ENVIRONMENT: 1, INTERACTIVE: 2, TRIGGER: 3, DYNAMIC: 4 } as const;

export const GROUPS = {
  player: interactionGroups(LAYER.PLAYER, [LAYER.ENVIRONMENT, LAYER.INTERACTIVE, LAYER.DYNAMIC, LAYER.TRIGGER]),
  environment: interactionGroups(LAYER.ENVIRONMENT, [LAYER.PLAYER, LAYER.DYNAMIC]),
  interactive: interactionGroups(LAYER.INTERACTIVE, [LAYER.PLAYER, LAYER.DYNAMIC]),
  trigger: interactionGroups(LAYER.TRIGGER, [LAYER.PLAYER]),
  dynamic: interactionGroups(LAYER.DYNAMIC, [LAYER.PLAYER, LAYER.ENVIRONMENT, LAYER.INTERACTIVE, LAYER.DYNAMIC]),
};

// JEM — Central entity selection (detail panel + state)
import { State } from './state.js';
import { openDetailPanel } from './panel.js';

/** Select entity, ensure it appears in the 3-gen focus view, open full detail panel. */
export function selectAndOpenEntity(entityOrId) {
  const entity = typeof entityOrId === 'string'
    ? State.getEntityById(entityOrId)
    : entityOrId;
  if (!entity?.id) return;
  State.ensureEntityInTrinityView(entity.id);
  State.selectEntity(entity.id);
  openDetailPanel(entity);
}

export function selectEntityOnly(entityOrId) {
  const entity = typeof entityOrId === 'string'
    ? State.getEntityById(entityOrId)
    : entityOrId;
  if (!entity?.id) return;
  State.selectEntity(entity.id);
  openDetailPanel(entity);
}

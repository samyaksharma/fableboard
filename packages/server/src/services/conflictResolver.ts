import { lwwResolve, isNewer, type CanvasElement, type KanbanCard } from '@fableboard/shared';

export function resolveElementConflict(
  incoming: CanvasElement,
  existing: CanvasElement,
): CanvasElement {
  return lwwResolve(incoming, existing);
}

/**
 * Resolve kanban card conflicts using LWW.
 * Server is authoritative — if incoming is newer, accept; otherwise reject.
 */
export function resolveCardConflict(
  incoming: KanbanCard,
  existing: KanbanCard,
): { accepted: boolean; card: KanbanCard } {
  if (isNewer(incoming, existing)) {
    return { accepted: true, card: incoming };
  }
  return { accepted: false, card: existing };
}

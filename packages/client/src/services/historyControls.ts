import { create } from 'zustand';

export const useHistoryState = create<{ canUndo: boolean; canRedo: boolean }>(() => ({
  canUndo: false,
  canRedo: false,
}));

interface Controller {
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

let controller: Controller | null = null;
let suspended = 0;

export const historyControls = {
  attach(c: Controller) {
    controller = c;
  },
  detach() {
    controller = null;
    useHistoryState.setState({ canUndo: false, canRedo: false });
  },
  undo: () => controller?.undo(),
  redo: () => controller?.redo(),
  clear: () => controller?.clear(),
  isSuspended: () => suspended > 0,
  /** Run changes that must not become undo steps (undo itself, moving an element to the kanban). */
  suspend<T>(fn: () => T): T {
    suspended++;
    try {
      return fn();
    } finally {
      suspended--;
    }
  },
};

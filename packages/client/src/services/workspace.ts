import { useSessionStore } from '@/stores/sessionStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useKanbanStore } from '@/stores/kanbanStore';
import { useUIStore } from '@/stores/uiStore';
import { historyControls } from './historyControls';

/** Leave the current board: drop the session and everything cached from it. */
export function resetWorkspace() {
  historyControls.clear();
  useSessionStore.getState().reset();
  useCanvasStore.getState().setElements([]);
  useKanbanStore.getState().setCards([]);
  useUIStore.setState({ kanbanOpen: false });
}

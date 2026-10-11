import { useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { KanbanCard as KanbanCardType, KanbanColumn as KanbanColumnType } from '@fableboard/shared';
import { KANBAN_COLUMN_ORDER } from '@fableboard/shared';
import { useKanbanStore } from '@/stores/kanbanStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useKanban } from '@/hooks/useKanban';
import { useSessionStore } from '@/stores/sessionStore';
import { captureBoardSnapshot } from '@/utils/boardSnapshot';
import { showToast } from '@/components/ui/Toast';
import { KanbanColumn } from './KanbanColumn';
import { CardEditor } from './CardEditor';

interface Props {
  socket: Socket | null;
  kanbanRef: React.RefObject<HTMLDivElement | null>;
}

export function KanbanPanel({ socket, kanbanRef }: Props) {
  const { emitAddCard, emitMoveCard, emitUpdateCard, emitDeleteCard } = useKanban(socket);
  const { canManageCards } = usePermissions();
  const cards = useKanbanStore((s) => s.cards);
  const editingCardId = useKanbanStore((s) => s.editingCardId);
  const setEditingCardId = useKanbanStore((s) => s.setEditingCardId);
  const getCardsByColumn = useKanbanStore((s) => s.getCardsByColumn);

  const handleDragStart = useCallback((e: React.DragEvent, card: KanbanCardType) => {
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleAddCard = useCallback(
    (title: string, column: KanbanColumnType) => {
      emitAddCard(title, column);
    },
    [emitAddCard],
  );

  const sessionTitle = useSessionStore((s) => s.session?.title ?? 'Board');

  const handleSaveBoard = useCallback(() => {
    const snapshot = captureBoardSnapshot();
    if (!snapshot) {
      showToast('Could not capture the board', 'error');
      return;
    }
    const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    emitAddCard(`${sessionTitle} snapshot, ${time}`, 'todo', null, snapshot);
    showToast('Board saved to the kanban', 'success');
  }, [emitAddCard, sessionTitle]);

  const editingCard = editingCardId ? cards[editingCardId] : null;

  return (
    <div
      ref={kanbanRef as React.RefObject<HTMLDivElement>}
      className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-800">Kanban Board</h2>
          {canManageCards && (
            <button
              onClick={handleSaveBoard}
              title="Save a snapshot of the whole board as a card"
              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
            >
              Save board
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Drag canvas items here to create tasks</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {KANBAN_COLUMN_ORDER.map((col) => (
          <KanbanColumn
            key={col}
            column={col}
            cards={getCardsByColumn(col)}
            onEdit={setEditingCardId}
            onDelete={emitDeleteCard}
            onMoveCard={emitMoveCard}
            onAddCard={handleAddCard}
            onDragStart={handleDragStart}
            readOnly={!canManageCards}
          />
        ))}
      </div>
      {editingCard && (
        <CardEditor
          card={editingCard}
          onSave={emitUpdateCard}
          onClose={() => setEditingCardId(null)}
        />
      )}
    </div>
  );
}

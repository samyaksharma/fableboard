import { useCallback, useState } from 'react';
import type { KanbanCard as KanbanCardType, KanbanColumn as KanbanColumnType } from '@fableboard/shared';
import { KANBAN_COLUMN_LABELS } from '@fableboard/shared';
import { KanbanCard } from './KanbanCard';

interface Props {
  column: KanbanColumnType;
  cards: KanbanCardType[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveCard: (cardId: string, column: KanbanColumnType, order: number) => void;
  onAddCard: (title: string, column: KanbanColumnType) => void;
  onDragStart: (e: React.DragEvent, card: KanbanCardType) => void;
  readOnly?: boolean;
}

export function KanbanColumn({
  column,
  cards,
  onEdit,
  onDelete,
  onMoveCard,
  onAddCard,
  onDragStart,
  readOnly = false,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (readOnly) return;
      const cardId = e.dataTransfer.getData('text/plain');
      if (cardId) {
        onMoveCard(cardId, column, Date.now());
      }
    },
    [column, onMoveCard, readOnly],
  );

  const handleAddSubmit = () => {
    if (newTitle.trim()) {
      onAddCard(newTitle.trim(), column);
      setNewTitle('');
      setAdding(false);
    }
  };

  const columnColors: Record<string, string> = {
    todo: 'bg-gray-100',
    in_progress: 'bg-blue-50',
    done: 'bg-green-50',
  };

  return (
    <div
      data-column={column}
      className={`flex flex-col min-h-0 rounded-lg ${columnColors[column] ?? 'bg-gray-50'}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {KANBAN_COLUMN_LABELS[column]}
        </h3>
        <span className="text-xs text-gray-400">{cards.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            onEdit={onEdit}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onMove={(c) => onMoveCard(card.id, c, Date.now())}
            readOnly={readOnly}
          />
        ))}
        {readOnly ? null : adding ? (
          <div className="bg-white rounded-lg p-2 shadow-sm border">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSubmit();
                if (e.key === 'Escape') setAdding(false);
              }}
              placeholder="Card title..."
              className="w-full text-sm px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={handleAddSubmit}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded"
              >
                Add
              </button>
              <button
                onClick={() => setAdding(false)}
                className="text-xs text-gray-500 px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-left text-xs text-gray-400 hover:text-gray-600 py-1 px-2"
          >
            + Add card
          </button>
        )}
      </div>
    </div>
  );
}

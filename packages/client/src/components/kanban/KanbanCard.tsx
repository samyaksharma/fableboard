import { useState } from 'react';
import type { KanbanCard as KanbanCardType } from '@fableboard/shared';

interface Props {
  card: KanbanCardType;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, card: KanbanCardType) => void;
  readOnly?: boolean;
}

export function KanbanCard({ card, onEdit, onDelete, onDragStart, readOnly = false }: Props) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => onDragStart(e, card)}
      className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-gray-800 flex-1 min-w-0 break-words">
          {card.title}
        </h4>
        {!readOnly && (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEdit(card.id)}
            className="text-gray-400 hover:text-blue-500 text-xs"
            title="Edit"
          >
            &#9998;
          </button>
          <button
            onClick={() => onDelete(card.id)}
            className="text-gray-400 hover:text-red-500 text-xs"
            title="Delete"
          >
            &#10005;
          </button>
        </div>
        )}
      </div>
      {card.snapshot && (
        <>
          <img
            src={card.snapshot}
            alt={`Snapshot: ${card.title}`}
            draggable={false}
            onClick={() => setZoomed(true)}
            className="mt-2 w-full rounded border border-gray-200 cursor-zoom-in"
          />
          {zoomed && (
            <div
              className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-8 cursor-zoom-out"
              onClick={() => setZoomed(false)}
            >
              <img
                src={card.snapshot}
                alt={card.title}
                className="max-w-full max-h-full rounded shadow-2xl bg-white"
              />
            </div>
          )}
        </>
      )}
      {card.description && (
        <p className="text-xs text-gray-500 mt-1 break-words">{card.description}</p>
      )}
      {card.assignee && (
        <span className="inline-block mt-2 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
          {card.assignee}
        </span>
      )}
      {card.snapshot && !card.sourceElementId && (
        <span className="inline-block mt-2 text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
          board snapshot
        </span>
      )}
      {card.sourceElementId && (
        <span className="inline-block mt-2 ml-1 text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
          from canvas
        </span>
      )}
    </div>
  );
}

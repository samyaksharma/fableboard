import { useEffect, useCallback, useRef } from 'react';
import type { Canvas } from 'fabric';
import type { KanbanColumn } from '@fableboard/shared';
import { useCanvasStore } from '@/stores/canvasStore';
import { historyControls } from '@/services/historyControls';
import { useUIStore } from '@/stores/uiStore';

interface UseDragToKanbanProps {
  fabricRef: React.RefObject<Canvas | null>;
  kanbanRef: React.RefObject<HTMLDivElement | null>;
  onDropToKanban: (elementId: string, title: string, column: KanbanColumn) => void;
}

export function useDragToKanban({
  fabricRef,
  kanbanRef,
  onDropToKanban,
}: UseDragToKanbanProps) {
  const kanbanOpen = useUIStore((s) => s.kanbanOpen);
  const elements = useCanvasStore((s) => s.elements);
  const removeElement = useCanvasStore((s) => s.removeElement);
  // Only a real drag of a canvas object may create a card; a plain click that happens to land
  // on the panel (menus, "+ Add card") while something is selected must not.
  const dragging = useRef(false);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const onMoving = () => {
      dragging.current = true;
    };
    // Runs after the kanban handler has had its chance to read the flag.
    const clear = () => setTimeout(() => (dragging.current = false), 0);
    canvas.on('object:moving', onMoving);
    document.addEventListener('pointerup', clear);
    return () => {
      canvas.off('object:moving', onMoving);
      document.removeEventListener('pointerup', clear);
    };
  }, [fabricRef]);

  const handleDragEnd = useCallback(
    (e: PointerEvent) => {
      const wasDragging = dragging.current;
      dragging.current = false;
      if (!wasDragging) return;

      const canvas = fabricRef.current;
      const kanbanEl = kanbanRef.current;
      if (!canvas || !kanbanEl || !kanbanOpen) return;

      const kanbanRect = kanbanEl.getBoundingClientRect();
      const isOverKanban =
        e.clientX >= kanbanRect.left &&
        e.clientX <= kanbanRect.right &&
        e.clientY >= kanbanRect.top &&
        e.clientY <= kanbanRect.bottom;

      if (!isOverKanban) return;

      const activeObj = canvas.getActiveObject();
      if (!activeObj) return;

      const elementId = (activeObj as any).__elementId;
      if (!elementId) return;

      const element = elements[elementId];
      const title =
        element?.type === 'sticky_note'
          ? element.content || 'Sticky Note'
          : element?.type === 'path'
            ? 'Sketch'
            : element?.type
              ? element.type.charAt(0).toUpperCase() + element.type.slice(1)
              : 'Canvas Item';

      const columnEl = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>('[data-column]');
      const column = (columnEl?.dataset.column as KanbanColumn | undefined) ?? 'todo';

      // Remove from canvas. Not __skipEmit: the removal is broadcast so every client's canvas matches.
      canvas.discardActiveObject();
      historyControls.suspend(() =>
        canvas
          .getObjects()
          .filter((obj) => (obj as any).__elementId === elementId)
          .forEach((obj) => canvas.remove(obj)),
      );
      canvas.renderAll();
      removeElement(elementId);

      onDropToKanban(elementId, title, column);
    },
    [fabricRef, kanbanRef, kanbanOpen, elements, removeElement, onDropToKanban],
  );

  useEffect(() => {
    if (!kanbanOpen) return;
    document.addEventListener('pointerup', handleDragEnd);
    return () => document.removeEventListener('pointerup', handleDragEnd);
  }, [kanbanOpen, handleDragEnd]);
}

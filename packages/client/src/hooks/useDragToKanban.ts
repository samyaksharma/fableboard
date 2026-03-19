import { useEffect, useCallback } from 'react';
import type { Canvas } from 'fabric';
import { useCanvasStore } from '@/stores/canvasStore';
import { useUIStore } from '@/stores/uiStore';

interface UseDragToKanbanProps {
  fabricRef: React.RefObject<Canvas | null>;
  kanbanRef: React.RefObject<HTMLDivElement | null>;
  onDropToKanban: (elementId: string, title: string) => void;
}

export function useDragToKanban({
  fabricRef,
  kanbanRef,
  onDropToKanban,
}: UseDragToKanbanProps) {
  const kanbanOpen = useUIStore((s) => s.kanbanOpen);
  const elements = useCanvasStore((s) => s.elements);
  const removeElement = useCanvasStore((s) => s.removeElement);

  const handleDragEnd = useCallback(
    (e: MouseEvent) => {
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

      // Remove from canvas
      const objectsToRemove = canvas
        .getObjects()
        .filter((obj) => (obj as any).__elementId === elementId);
      objectsToRemove.forEach((obj) => {
        (obj as any).__skipEmit = true;
        canvas.remove(obj);
      });
      canvas.discardActiveObject();
      canvas.renderAll();
      removeElement(elementId);

      onDropToKanban(elementId, title);
    },
    [fabricRef, kanbanRef, kanbanOpen, elements, removeElement, onDropToKanban],
  );

  useEffect(() => {
    if (!kanbanOpen) return;
    document.addEventListener('mouseup', handleDragEnd);
    return () => document.removeEventListener('mouseup', handleDragEnd);
  }, [kanbanOpen, handleDragEnd]);
}

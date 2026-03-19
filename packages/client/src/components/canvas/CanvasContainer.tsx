import { useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { useCanvas } from '@/hooks/useCanvas';
import { useDrawing } from '@/hooks/useDrawing';
import { useShapes } from '@/hooks/useShapes';
import { useStickyNotes } from '@/hooks/useStickyNotes';
import { useCanvasSync } from '@/hooks/useCanvasSync';
import { useCursorSync } from '@/hooks/useCursorSync';
import { useDragToKanban } from '@/hooks/useDragToKanban';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { RemoteCursors } from './RemoteCursors';
import { useCanvasStore, ToolType } from '@/stores/canvasStore';

interface Props {
  socket: Socket | null;
  kanbanRef?: React.RefObject<HTMLDivElement | null>;
  onDropToKanban?: (elementId: string, title: string) => void;
}

export function CanvasContainer({ socket, kanbanRef, onDropToKanban }: Props) {
  const { canvasRef, fabricRef, containerRef } = useCanvas();
  const activeTool = useCanvasStore((s) => s.activeTool);

  useDrawing(fabricRef, socket);
  useCanvasSync(fabricRef, socket);
  const { createShape } = useShapes(fabricRef, socket);
  const { createStickyNote } = useStickyNotes(fabricRef, socket);
  const remoteCursors = useCursorSync(containerRef, socket);

  useKeyboardShortcuts(fabricRef);

  useDragToKanban({
    fabricRef,
    kanbanRef: kanbanRef ?? { current: null },
    onDropToKanban: onDropToKanban ?? (() => {}),
  });

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const target = canvas.findTarget(e.nativeEvent as any);
      if (target) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const shapeTools: ToolType[] = ['rect', 'circle', 'triangle'];
      if (shapeTools.includes(activeTool)) {
        createShape(activeTool, x, y);
      } else if (activeTool === 'sticky_note') {
        createStickyNote(x, y);
      }
    },
    [fabricRef, containerRef, activeTool, createShape, createStickyNote],
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden"
      onClick={handleCanvasClick}
    >
      <canvas ref={canvasRef} />
      <RemoteCursors cursors={remoteCursors} />
    </div>
  );
}

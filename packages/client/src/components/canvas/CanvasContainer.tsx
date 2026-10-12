import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useCanvas } from '@/hooks/useCanvas';
import { useDrawing } from '@/hooks/useDrawing';
import { useShapes } from '@/hooks/useShapes';
import { useStickyNotes } from '@/hooks/useStickyNotes';
import { useCanvasSync } from '@/hooks/useCanvasSync';
import { useStickyText } from '@/hooks/useStickyText';
import { useCursorSync } from '@/hooks/useCursorSync';
import { useDragToKanban } from '@/hooks/useDragToKanban';
import { useEraser } from '@/hooks/useEraser';
import { useLines } from '@/hooks/useLines';
import { useHistory } from '@/hooks/useHistory';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { KanbanColumn } from '@fableboard/shared';
import { RemoteCursors } from './RemoteCursors';
import { usePermissions } from '@/hooks/usePermissions';
import { useCanvasStore, ToolType } from '@/stores/canvasStore';

interface Props {
  socket: Socket | null;
  kanbanRef?: React.RefObject<HTMLDivElement | null>;
  onDropToKanban?: (elementId: string, title: string, column: KanbanColumn) => void;
}

export function CanvasContainer({ socket, kanbanRef, onDropToKanban }: Props) {
  const { canvasRef, fabricRef, containerRef } = useCanvas();
  const activeTool = useCanvasStore((s) => s.activeTool);
  const [isEmpty, setIsEmpty] = useState(true);

  const { canDraw } = usePermissions();

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const update = () => setIsEmpty(canvas.getObjects().length === 0);
    canvas.on('object:added', update);
    canvas.on('object:removed', update);
    update();
    return () => {
      canvas.off('object:added', update);
      canvas.off('object:removed', update);
    };
  }, [fabricRef]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.selection = canDraw;
    canvas.skipTargetFind = !canDraw;
    if (!canDraw) {
      canvas.isDrawingMode = false;
      canvas.discardActiveObject();
      canvas.renderAll();
      useCanvasStore.getState().setActiveTool('select');
    }
  }, [fabricRef, canDraw]);

  useDrawing(fabricRef, socket);
  useEraser(fabricRef, canDraw);
  useLines(fabricRef, socket, canDraw);
  useHistory(fabricRef, socket, canDraw);
  useCanvasSync(fabricRef, socket);
  useStickyText(fabricRef, socket);
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
      if (!canvas || !canDraw) return;

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
    [fabricRef, containerRef, canDraw, activeTool, createShape, createStickyNote],
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden"
      onPointerDownCapture={() => fabricRef.current?.calcOffset()}
      onClick={handleCanvasClick}
    >
      <canvas ref={canvasRef} />
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <p className="text-lg font-medium text-slate-500">Sketch it. Sync it. Ship it.</p>
            <p className="text-sm mt-1">
              {canDraw
                ? 'Pick a tool above, then drag a sticky note or shape onto the kanban board to make a task.'
                : 'Waiting for the owner or an editor to add something.'}
            </p>
          </div>
        </div>
      )}
      <RemoteCursors cursors={remoteCursors} />
    </div>
  );
}

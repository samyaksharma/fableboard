import { useEffect } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useUIStore } from '@/stores/uiStore';
import type { Canvas } from 'fabric';

export function useKeyboardShortcuts(fabricRef: React.RefObject<Canvas | null>) {
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const toggleKanban = useUIStore((s) => s.toggleKanban);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'p':
        case 'd':
          setActiveTool('draw');
          break;
        case 'e':
          setActiveTool('eraser');
          break;
        case 'r':
          setActiveTool('rect');
          break;
        case 'c':
          setActiveTool('circle');
          break;
        case 't':
          setActiveTool('triangle');
          break;
        case 'n':
          setActiveTool('sticky_note');
          break;
        case 'k':
          toggleKanban();
          break;
        case 'delete':
        case 'backspace': {
          const canvas = fabricRef.current;
          if (!canvas) break;
          const active = canvas.getActiveObjects();
          if (active.length > 0) {
            active.forEach((obj) => canvas.remove(obj));
            canvas.discardActiveObject();
            canvas.renderAll();
          }
          break;
        }
        case 'escape': {
          const canvas = fabricRef.current;
          if (canvas) {
            canvas.discardActiveObject();
            canvas.renderAll();
          }
          setActiveTool('select');
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fabricRef, setActiveTool, toggleKanban]);
}

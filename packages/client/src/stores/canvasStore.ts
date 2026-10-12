import { create } from 'zustand';
import type { CanvasElement, CanvasElementType } from '@fableboard/shared';

export type ToolType =
  | 'select'
  | 'draw'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'sticky_note';

interface CanvasState {
  elements: Record<string, CanvasElement>;
  activeTool: ToolType;
  brushColor: string;
  brushWidth: number;
  fillColor: string;
  strokeColor: string;

  setActiveTool: (tool: ToolType) => void;
  setBrushColor: (color: string) => void;
  setBrushWidth: (width: number) => void;
  setFillColor: (color: string) => void;
  setStrokeColor: (color: string) => void;
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  removeElement: (id: string) => void;
  setElements: (elements: CanvasElement[]) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  elements: {},
  activeTool: 'select',
  brushColor: '#1e293b',
  brushWidth: 3,
  fillColor: 'transparent',
  strokeColor: '#1e293b',

  setActiveTool: (tool) => set({ activeTool: tool }),
  setBrushColor: (color) => set({ brushColor: color }),
  setBrushWidth: (width) => set({ brushWidth: width }),
  setFillColor: (color) => set({ fillColor: color }),
  setStrokeColor: (color) => set({ strokeColor: color }),

  addElement: (element) =>
    set((state) => ({
      elements: { ...state.elements, [element.id]: element },
    })),

  updateElement: (id, updates) =>
    set((state) => {
      const existing = state.elements[id];
      if (!existing) return state;
      return {
        elements: { ...state.elements, [id]: { ...existing, ...updates } },
      };
    }),

  removeElement: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.elements;
      return { elements: rest };
    }),

  setElements: (elements) =>
    set({
      elements: Object.fromEntries(elements.map((e) => [e.id, e])),
    }),
}));

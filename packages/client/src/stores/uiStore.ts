import { create } from 'zustand';

interface UIState {
  kanbanOpen: boolean;
  toggleKanban: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  kanbanOpen: false,
  toggleKanban: () => set((state) => ({ kanbanOpen: !state.kanbanOpen })),
}));

import { create } from 'zustand';
import type { KanbanCard, KanbanColumn } from '@fableboard/shared';

interface KanbanState {
  cards: Record<string, KanbanCard>;
  editingCardId: string | null;

  addCard: (card: KanbanCard) => void;
  updateCard: (id: string, updates: Partial<KanbanCard>) => void;
  moveCard: (id: string, column: KanbanColumn, order: number) => void;
  removeCard: (id: string) => void;
  setCards: (cards: KanbanCard[]) => void;
  setEditingCardId: (id: string | null) => void;
  getCardsByColumn: (column: KanbanColumn) => KanbanCard[];
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  cards: {},
  editingCardId: null,

  addCard: (card) =>
    set((state) => ({
      cards: { ...state.cards, [card.id]: card },
    })),

  updateCard: (id, updates) =>
    set((state) => {
      const existing = state.cards[id];
      if (!existing) return state;
      return {
        cards: { ...state.cards, [id]: { ...existing, ...updates } },
      };
    }),

  moveCard: (id, column, order) =>
    set((state) => {
      const existing = state.cards[id];
      if (!existing) return state;
      return {
        cards: { ...state.cards, [id]: { ...existing, column, order } },
      };
    }),

  removeCard: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.cards;
      return { cards: rest };
    }),

  setCards: (cards) =>
    set({
      cards: Object.fromEntries(cards.map((c) => [c.id, c])),
    }),

  setEditingCardId: (id) => set({ editingCardId: id }),

  getCardsByColumn: (column) => {
    const cards = get().cards;
    return Object.values(cards)
      .filter((c) => c.column === column)
      .sort((a, b) => a.order - b.order);
  },
}));

import { create } from 'zustand';
import type { Session, Participant } from '@fableboard/shared';

interface SessionState {
  session: Session | null;
  participants: Participant[];
  currentParticipant: Participant | null;
  connected: boolean;

  setSession: (session: Session) => void;
  setCurrentParticipant: (participant: Participant) => void;
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  participants: [],
  currentParticipant: null,
  connected: false,

  setSession: (session) => set({ session }),
  setCurrentParticipant: (participant) => set({ currentParticipant: participant }),
  setParticipants: (participants) => set({ participants }),
  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants.filter((p) => p.id !== participant.id), participant],
    })),
  removeParticipant: (participantId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== participantId),
    })),
  setConnected: (connected) => set({ connected }),
  reset: () =>
    set({
      session: null,
      participants: [],
      currentParticipant: null,
      connected: false,
    }),
}));

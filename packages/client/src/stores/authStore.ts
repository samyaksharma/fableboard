import { create } from 'zustand';
import type { JwtPayload } from '@fableboard/shared';

interface AuthState {
  token: string | null;
  user: JwtPayload | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: JwtPayload) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64);
    const payload = JSON.parse(json);
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl,
      provider: payload.provider,
    };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  setAuth: (token, user) => {
    localStorage.setItem('fableboard_token', token);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('fableboard_token');
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('fableboard_token');
    if (!token) return;

    const user = parseJwtPayload(token);
    if (!user) {
      localStorage.removeItem('fableboard_token');
      return;
    }

    set({ token, user, isAuthenticated: true });
  },
}));

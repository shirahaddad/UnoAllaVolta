import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export const TODOIST_CLIENT_ID = process.env.EXPO_PUBLIC_TODOIST_CLIENT_ID!;
export const TODOIST_CLIENT_SECRET = process.env.EXPO_PUBLIC_TODOIST_CLIENT_SECRET!;

const SECURE_KEY = 'todoist_token';

interface AuthState {
  todoistToken: string | null;
  setTodoistToken: (token: string | null) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  todoistToken: null,

  setTodoistToken: async (token) => {
    if (token) {
      await SecureStore.setItemAsync(SECURE_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(SECURE_KEY);
    }
    set({ todoistToken: token });
  },

  loadFromStorage: async () => {
    const token = await SecureStore.getItemAsync(SECURE_KEY);
    set({ todoistToken: token });
  },
}));

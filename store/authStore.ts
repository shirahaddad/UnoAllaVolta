import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export const TODOIST_CLIENT_ID = process.env.EXPO_PUBLIC_TODOIST_CLIENT_ID!;
export const TODOIST_CLIENT_SECRET = process.env.EXPO_PUBLIC_TODOIST_CLIENT_SECRET!;

const SECURE_KEY = 'todoist_token';

interface AuthState {
  todoistToken: string | null;
  tokenFoundInStorage: boolean | null;
  setTodoistToken: (token: string | null) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  todoistToken: null,
  tokenFoundInStorage: null,

  setTodoistToken: async (token) => {
    try {
      if (token) {
        await SecureStore.setItemAsync(SECURE_KEY, token);
        const verify = await SecureStore.getItemAsync(SECURE_KEY);
        if (!verify) console.warn('[authStore] SecureStore write succeeded but read-back returned null');
      } else {
        await SecureStore.deleteItemAsync(SECURE_KEY);
      }
      set({ todoistToken: token });
    } catch (e) {
      console.error('[authStore] setTodoistToken failed:', e);
      set({ todoistToken: token });
    }
  },

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync(SECURE_KEY);
      console.log('[authStore] loadFromStorage todoistToken:', token ? 'present' : 'null');
      set({ todoistToken: token, tokenFoundInStorage: token !== null });
    } catch (e) {
      console.error('[authStore] loadFromStorage failed:', e);
    }
  },
}));

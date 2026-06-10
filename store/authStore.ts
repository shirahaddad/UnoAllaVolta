import { create } from 'zustand';
import * as SecureStore from '@/utils/storage';

export const TODOIST_CLIENT_ID = process.env.EXPO_PUBLIC_TODOIST_CLIENT_ID!;
export const TODOIST_CLIENT_SECRET = process.env.EXPO_PUBLIC_TODOIST_CLIENT_SECRET!;

const SECURE_KEY = 'todoist_token';
const SECURE_REFRESH_KEY = 'todoist_refresh_token';

interface AuthState {
  todoistToken: string | null;
  todoistRefreshToken: string | null;
  tokenFoundInStorage: boolean | null;
  setTodoistToken: (token: string | null) => Promise<void>;
  setTodoistRefreshToken: (token: string) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  todoistToken: null,
  todoistRefreshToken: null,
  tokenFoundInStorage: null,

  setTodoistToken: async (token) => {
    try {
      if (token) {
        await SecureStore.setItemAsync(SECURE_KEY, token);
        const verify = await SecureStore.getItemAsync(SECURE_KEY);
        if (!verify) console.warn('[authStore] SecureStore write succeeded but read-back returned null');
      } else {
        await Promise.all([
          SecureStore.deleteItemAsync(SECURE_KEY),
          SecureStore.deleteItemAsync(SECURE_REFRESH_KEY),
        ]);
      }
      set({ todoistToken: token, ...(token === null && { todoistRefreshToken: null }) });
    } catch (e) {
      console.error('[authStore] setTodoistToken failed:', e);
      set({ todoistToken: token, ...(token === null && { todoistRefreshToken: null }) });
    }
  },

  setTodoistRefreshToken: async (token) => {
    try {
      await SecureStore.setItemAsync(SECURE_REFRESH_KEY, token);
      set({ todoistRefreshToken: token });
    } catch (e) {
      console.error('[authStore] setTodoistRefreshToken failed:', e);
      set({ todoistRefreshToken: token });
    }
  },

  loadFromStorage: async () => {
    try {
      const [token, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEY),
        SecureStore.getItemAsync(SECURE_REFRESH_KEY),
      ]);
      console.log('[authStore] loadFromStorage todoistToken:', token ? 'present' : 'null', '| refreshToken:', refreshToken ? 'present' : 'null');
      set({ todoistToken: token, todoistRefreshToken: refreshToken, tokenFoundInStorage: token !== null });
    } catch (e) {
      console.error('[authStore] loadFromStorage failed:', e);
    }
  },
}));

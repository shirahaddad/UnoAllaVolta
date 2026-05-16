import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY_ACCESS = 'google_access_token';
const KEY_REFRESH = 'google_refresh_token';
const KEY_EXPIRES = 'google_expires_at';
const KEY_EMAIL = 'google_email';

export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!;
export const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET!;

interface GoogleAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  email: string | null;
  setTokens: (params: { accessToken: string; refreshToken: string; expiresIn: number; email: string }) => Promise<void>;
  clearTokens: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  getValidToken: () => Promise<string | null>;
}

export const useGoogleAuthStore = create<GoogleAuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  email: null,

  setTokens: async ({ accessToken, refreshToken, expiresIn, email }) => {
    const expiresAt = Date.now() + expiresIn * 1000;
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS, accessToken),
      SecureStore.setItemAsync(KEY_REFRESH, refreshToken),
      SecureStore.setItemAsync(KEY_EXPIRES, String(expiresAt)),
      SecureStore.setItemAsync(KEY_EMAIL, email),
    ]);
    set({ accessToken, refreshToken, expiresAt, email });
  },

  clearTokens: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_ACCESS),
      SecureStore.deleteItemAsync(KEY_REFRESH),
      SecureStore.deleteItemAsync(KEY_EXPIRES),
      SecureStore.deleteItemAsync(KEY_EMAIL),
    ]);
    set({ accessToken: null, refreshToken: null, expiresAt: null, email: null });
  },

  loadFromStorage: async () => {
    const [accessToken, refreshToken, expiresAtStr, email] = await Promise.all([
      SecureStore.getItemAsync(KEY_ACCESS),
      SecureStore.getItemAsync(KEY_REFRESH),
      SecureStore.getItemAsync(KEY_EXPIRES),
      SecureStore.getItemAsync(KEY_EMAIL),
    ]);
    if (accessToken && refreshToken && expiresAtStr) {
      set({
        accessToken,
        refreshToken,
        expiresAt: Number(expiresAtStr),
        email,
      });
    }
  },

  getValidToken: async () => {
    const { accessToken, refreshToken, expiresAt } = get();

    const isExpired = !expiresAt || Date.now() > expiresAt - 60_000;
    if (!isExpired && accessToken) return accessToken;

    if (!refreshToken) return null;

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });
      const data = await res.json();
      if (!data.access_token) return null;
      const newExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
      await Promise.all([
        SecureStore.setItemAsync(KEY_ACCESS, data.access_token),
        SecureStore.setItemAsync(KEY_EXPIRES, String(newExpiresAt)),
      ]);
      set({ accessToken: data.access_token, expiresAt: newExpiresAt });
      return data.access_token as string;
    } catch {
      return null;
    }
  },
}));

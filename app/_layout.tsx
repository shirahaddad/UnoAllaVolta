import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useGoogleAuthStore } from '@/store/googleAuthStore';
import { useDeckStore } from '@/store/deckStore';

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0F0F0F',
    card: '#0F0F0F',
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const loadAuth = useAuthStore((s) => s.loadFromStorage);
  const loadSettings = useSettingsStore((s) => s.loadFromStorage);
  const loadGoogleAuth = useGoogleAuthStore((s) => s.loadFromStorage);
  const loadDeckCache = useDeckStore((s) => s.loadCachedCards);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = 'UnoAllaVolta';
    Promise.all([loadAuth(), loadSettings(), loadGoogleAuth(), loadDeckCache()])
      .then(() => setReady(true));
  }, []);

  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        loadAuth().catch(console.error);
        loadGoogleAuth().catch(console.error);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.hidden) return;
      const { todoistToken } = useAuthStore.getState();
      const { accessToken } = useGoogleAuthStore.getState();
      if (todoistToken || accessToken) {
        useDeckStore.getState().fetchCards(todoistToken);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }, []);

  const activeCardCount = useDeckStore((s) => s.queue.length);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
    if (activeCardCount > 0) {
      (navigator as any).setAppBadge(activeCardCount).catch(() => {});
    } else {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }, [activeCardCount]);

  if (!ready) return null;

  return (
    <ThemeProvider value={AppTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'UnoAllaVolta' }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

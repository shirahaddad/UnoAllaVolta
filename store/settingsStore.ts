import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const SECURE_KEY = 'excluded_project_ids';

interface SettingsState {
  excludedProjectIds: string[];
  toggleProject: (id: string) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  excludedProjectIds: [],

  toggleProject: async (id) => {
    const current = get().excludedProjectIds;
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    await SecureStore.setItemAsync(SECURE_KEY, JSON.stringify(next));
    set({ excludedProjectIds: next });
  },

  loadFromStorage: async () => {
    const raw = await SecureStore.getItemAsync(SECURE_KEY);
    if (raw) {
      try {
        set({ excludedProjectIds: JSON.parse(raw) });
      } catch {
        // ignore malformed data
      }
    }
  },
}));

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const KEY_PROJECTS = 'excluded_project_ids';
const KEY_CALENDARS = 'excluded_calendar_ids';

interface SettingsState {
  excludedProjectIds: string[];
  excludedCalendarIds: string[];
  toggleProject: (id: string) => Promise<void>;
  toggleCalendar: (id: string) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  excludedProjectIds: [],
  excludedCalendarIds: [],

  toggleProject: async (id) => {
    const current = get().excludedProjectIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    await SecureStore.setItemAsync(KEY_PROJECTS, JSON.stringify(next));
    set({ excludedProjectIds: next });
  },

  toggleCalendar: async (id) => {
    const current = get().excludedCalendarIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    await SecureStore.setItemAsync(KEY_CALENDARS, JSON.stringify(next));
    set({ excludedCalendarIds: next });
  },

  loadFromStorage: async () => {
    const [rawProjects, rawCalendars] = await Promise.all([
      SecureStore.getItemAsync(KEY_PROJECTS),
      SecureStore.getItemAsync(KEY_CALENDARS),
    ]);
    try {
      if (rawProjects) set({ excludedProjectIds: JSON.parse(rawProjects) });
      if (rawCalendars) set({ excludedCalendarIds: JSON.parse(rawCalendars) });
    } catch {
      // ignore malformed data
    }
  },
}));

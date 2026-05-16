import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { GoogleCalendar } from '@/services/googleCalendar';

const KEY_PROJECTS = 'excluded_project_ids';
const KEY_CALENDARS = 'excluded_calendar_ids';
const KEY_DISMISSED = 'dismissed_calendar_events';

interface SettingsState {
  excludedProjectIds: string[];
  excludedCalendarIds: string[];
  dismissedCalendarEventIds: string[];
  cachedCalendars: GoogleCalendar[];
  toggleProject: (id: string) => Promise<void>;
  toggleCalendar: (id: string) => Promise<void>;
  dismissCalendarEvent: (id: string) => Promise<void>;
  resetDismissedCalendarEvents: () => Promise<void>;
  setCachedCalendars: (cals: GoogleCalendar[]) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  excludedProjectIds: [],
  excludedCalendarIds: [],
  dismissedCalendarEventIds: [],
  cachedCalendars: [],

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

  dismissCalendarEvent: async (id) => {
    const today = new Date().toISOString().slice(0, 10);
    const next = [...new Set([...get().dismissedCalendarEventIds, id])];
    await SecureStore.setItemAsync(KEY_DISMISSED, JSON.stringify({ date: today, ids: next }));
    set({ dismissedCalendarEventIds: next });
  },

  resetDismissedCalendarEvents: async () => {
    await SecureStore.deleteItemAsync(KEY_DISMISSED);
    set({ dismissedCalendarEventIds: [] });
  },

  setCachedCalendars: async (cals) => {
    set({ cachedCalendars: cals });
  },

  loadFromStorage: async () => {
    const [rawProjects, rawCalendars, rawDismissed] = await Promise.all([
      SecureStore.getItemAsync(KEY_PROJECTS),
      SecureStore.getItemAsync(KEY_CALENDARS),
      SecureStore.getItemAsync(KEY_DISMISSED),
    ]);
    try {
      if (rawProjects) set({ excludedProjectIds: JSON.parse(rawProjects) });
      if (rawCalendars) set({ excludedCalendarIds: JSON.parse(rawCalendars) });
      if (rawDismissed) {
        const { date, ids } = JSON.parse(rawDismissed) as { date: string; ids: string[] };
        const today = new Date().toISOString().slice(0, 10);
        if (date === today) set({ dismissedCalendarEventIds: ids });
      }
    } catch {
      // ignore malformed data
    }
  },
}));

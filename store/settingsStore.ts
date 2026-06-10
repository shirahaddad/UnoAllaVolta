import { create } from 'zustand';
import * as SecureStore from '@/utils/storage';
import { GoogleCalendar } from '@/services/googleCalendar';

const KEY_PROJECTS = 'excluded_project_ids';
const KEY_CALENDARS = 'excluded_calendar_ids';
const KEY_DISMISSED = 'dismissed_calendar_events';
const KEY_QUEUE = 'queue_state';

function localDateStr() {
  return new Date().toLocaleDateString('en-CA');
}

interface SettingsState {
  excludedProjectIds: string[];
  excludedCalendarIds: string[];
  dismissedCalendarEventIds: string[];
  savedQueueState: { orderedIds: string[]; laterCount: number } | null;
  cachedCalendars: GoogleCalendar[];
  toggleProject: (id: string) => Promise<void>;
  toggleCalendar: (id: string) => Promise<void>;
  dismissCalendarEvent: (id: string) => Promise<void>;
  resetDismissedCalendarEvents: () => Promise<void>;
  saveQueueState: (orderedIds: string[], laterCount: number) => Promise<void>;
  setCachedCalendars: (cals: GoogleCalendar[]) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  excludedProjectIds: [],
  excludedCalendarIds: [],
  dismissedCalendarEventIds: [],
  savedQueueState: null,
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
    const next = [...new Set([...get().dismissedCalendarEventIds, id])];
    await SecureStore.setItemAsync(KEY_DISMISSED, JSON.stringify({ date: localDateStr(), ids: next }));
    set({ dismissedCalendarEventIds: next });
  },

  resetDismissedCalendarEvents: async () => {
    await SecureStore.deleteItemAsync(KEY_DISMISSED);
    set({ dismissedCalendarEventIds: [] });
  },

  saveQueueState: async (orderedIds, laterCount) => {
    await SecureStore.setItemAsync(KEY_QUEUE, JSON.stringify({ date: localDateStr(), orderedIds, laterCount }));
    set({ savedQueueState: { orderedIds, laterCount } });
  },

  setCachedCalendars: async (cals) => {
    set({ cachedCalendars: cals });
  },

  loadFromStorage: async () => {
    const [rawProjects, rawCalendars, rawDismissed, rawQueue] = await Promise.all([
      SecureStore.getItemAsync(KEY_PROJECTS),
      SecureStore.getItemAsync(KEY_CALENDARS),
      SecureStore.getItemAsync(KEY_DISMISSED),
      SecureStore.getItemAsync(KEY_QUEUE),
    ]);
    try {
      const today = localDateStr();
      if (rawProjects) set({ excludedProjectIds: JSON.parse(rawProjects) });
      if (rawCalendars) set({ excludedCalendarIds: JSON.parse(rawCalendars) });
      if (rawDismissed) {
        const { date, ids } = JSON.parse(rawDismissed) as { date: string; ids: string[] };
        if (date === today) set({ dismissedCalendarEventIds: ids });
      }
      if (rawQueue) {
        const { date, orderedIds, laterCount } = JSON.parse(rawQueue) as { date: string; orderedIds: string[]; laterCount: number };
        if (date === today) set({ savedQueueState: { orderedIds, laterCount } });
      }
    } catch {
      // ignore malformed data
    }
  },
}));

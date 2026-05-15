import { create } from 'zustand';
import { fetchTasks, fetchProjects, closeTask, TodoistAuthError, TodoistProject } from '@/services/todoist';
import { fetchTodayEvents, GoogleCalendar } from '@/services/googleCalendar';
import { useAuthStore } from '@/store/authStore';
import { useGoogleAuthStore } from '@/store/googleAuthStore';
import { buildDeckCards } from '@/utils/cardBuilder';
import { useSettingsStore } from '@/store/settingsStore';

export type CardType = 'calendar' | 'task';

export interface Card {
  id: string;
  type: CardType;
  title: string;
  subtitle: string;
  order: number;
}

type ErrorKind = 'invalid_token' | 'network' | null;

interface DeckState {
  queue: Card[];
  projects: TodoistProject[];
  calendars: GoogleCalendar[];
  doneCount: number;
  totalCount: number;
  isLoading: boolean;
  error: ErrorKind;
  markDone: (id: string) => void;
  moveLater: (id: string) => void;
  fetchCards: (token: string) => Promise<void>;
}

export const useDeckStore = create<DeckState>((set) => ({
  queue: [],
  projects: [],
  calendars: [],
  doneCount: 0,
  totalCount: 0,
  isLoading: false,
  error: null,

  markDone: (id) =>
    set((state) => {
      const card = state.queue.find((c) => c.id === id);
      if (card?.type === 'task') {
        const token = useAuthStore.getState().todoistToken;
        if (token) closeTask(id, token).catch(console.error);
      }
      // calendar events: just remove locally, no API call
      return {
        queue: state.queue.filter((c) => c.id !== id),
        doneCount: state.doneCount + 1,
      };
    }),

  moveLater: (id) =>
    set((state) => {
      const card = state.queue.find((c) => c.id === id);
      if (!card) return state;
      return { queue: [...state.queue.filter((c) => c.id !== id), card] };
    }),

  fetchCards: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const settings = useSettingsStore.getState();

      const [allTasks, projects] = await Promise.all([
        fetchTasks(token),
        fetchProjects(token),
      ]);

      const excludedProjects = new Set(settings.excludedProjectIds);
      const tasks = allTasks.filter(
        (t) => !t.checked && !excludedProjects.has(t.project_id) && (t.due === null || t.due.date <= todayStr)
      );

      // Fetch calendar events if Google is connected
      let events: Awaited<ReturnType<typeof fetchTodayEvents>> = [];
      let calendars: GoogleCalendar[] = [];
      const googleToken = await useGoogleAuthStore.getState().getValidToken();
      if (googleToken) {
        try {
          const { fetchCalendarList } = await import('@/services/googleCalendar');
          const allCalendars = await fetchCalendarList(googleToken);
          calendars = allCalendars;
          const excludedCals = new Set(settings.excludedCalendarIds);
          const includedCalendars = allCalendars.filter((c) => !excludedCals.has(c.id));
          if (includedCalendars.length > 0) {
            events = await fetchTodayEvents(includedCalendars, googleToken);
          }
        } catch (e) {
          console.error('[deckStore] calendar fetch error:', e);
        }
      }

      const cards = buildDeckCards(tasks, projects, events);
      set({ queue: cards, projects, calendars, totalCount: cards.length, doneCount: 0, isLoading: false });
    } catch (e) {
      console.error('[deckStore] fetchCards error:', e);
      if (e instanceof TodoistAuthError) {
        set({ isLoading: false, error: 'invalid_token' });
      } else {
        set({ isLoading: false, error: 'network' });
      }
    }
  },
}));

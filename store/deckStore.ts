import { create } from 'zustand';
import { fetchTasks, fetchProjects, closeTask, TodoistAuthError, TodoistProject } from '@/services/todoist';
import { fetchTodayEvents, fetchCalendarList, GoogleCalendar } from '@/services/googleCalendar';
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
  description?: string;
}

type ErrorKind = 'invalid_token' | 'network' | null;

interface DeckState {
  queue: Card[];
  projects: TodoistProject[];
  calendars: GoogleCalendar[];
  doneCount: number;
  laterCount: number;
  totalCount: number;
  isLoading: boolean;
  error: ErrorKind;
  pendingUndo: Card | null;
  markDone: (id: string) => void;
  commitPendingUndo: () => void;
  cancelPendingUndo: () => void;
  moveLater: (id: string) => void;
  fetchCards: (token?: string | null) => Promise<void>;
}

function _commit(card: Card) {
  if (card.type === 'task') {
    const token = useAuthStore.getState().todoistToken;
    if (token) closeTask(card.id, token).catch((e) => console.error('[todoist] closeTask failed:', e));
  }
  if (card.type === 'calendar') {
    useSettingsStore.getState().dismissCalendarEvent(card.id).catch(console.error);
  }
}

export const useDeckStore = create<DeckState>((set) => ({
  queue: [],
  projects: [],
  calendars: [],
  doneCount: 0,
  laterCount: 0,
  totalCount: 0,
  isLoading: false,
  error: null,
  pendingUndo: null,

  markDone: (id) =>
    set((state) => {
      const card = state.queue.find((c) => c.id === id);
      if (!card) return state;
      if (state.pendingUndo) _commit(state.pendingUndo);
      const newQueue = state.queue.filter((c) => c.id !== id);
      return {
        queue: newQueue,
        doneCount: state.doneCount + 1,
        laterCount: state.laterCount >= newQueue.length ? 0 : state.laterCount,
        pendingUndo: card,
      };
    }),

  commitPendingUndo: () =>
    set((state) => {
      if (state.pendingUndo) _commit(state.pendingUndo);
      return { pendingUndo: null };
    }),

  cancelPendingUndo: () =>
    set((state) => {
      if (!state.pendingUndo) return state;
      return {
        pendingUndo: null,
        queue: [state.pendingUndo, ...state.queue],
        doneCount: Math.max(0, state.doneCount - 1),
      };
    }),

  moveLater: (id) =>
    set((state) => {
      const card = state.queue.find((c) => c.id === id);
      if (!card) return state;
      const nextLaterCount = state.laterCount + 1;
      return {
        queue: [...state.queue.filter((c) => c.id !== id), card],
        laterCount: nextLaterCount >= state.queue.length ? 0 : nextLaterCount,
      };
    }),

  fetchCards: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const settings = useSettingsStore.getState();

      const [todoistResult, googleToken] = await Promise.all([
        token
          ? Promise.all([fetchTasks(token), fetchProjects(token)])
          : Promise.resolve([[], []] as const),
        useGoogleAuthStore.getState().getValidToken(),
      ]);

      const [allTasks, projects] = todoistResult;

      const excludedProjects = new Set(settings.excludedProjectIds);
      const tasks = allTasks.filter(
        (t) => !t.checked && !excludedProjects.has(t.project_id) && (t.due === null || t.due.date <= todayStr)
      );

      let events: Awaited<ReturnType<typeof fetchTodayEvents>> = [];
      let calendars: GoogleCalendar[] = [];
      if (googleToken) {
        try {
          const excludedCals = new Set(settings.excludedCalendarIds);
          const cachedCals = settings.cachedCalendars;

          if (cachedCals.length > 0) {
            calendars = cachedCals;
            const included = cachedCals.filter((c) => !excludedCals.has(c.id));
            if (included.length > 0) {
              events = await fetchTodayEvents(included, googleToken);
            }
            fetchCalendarList(googleToken)
              .then((fresh) => useSettingsStore.getState().setCachedCalendars(fresh))
              .catch(() => {});
          } else {
            const allCalendars = await fetchCalendarList(googleToken);
            calendars = allCalendars;
            await useSettingsStore.getState().setCachedCalendars(allCalendars);
            const included = allCalendars.filter((c) => !excludedCals.has(c.id));
            if (included.length > 0) {
              events = await fetchTodayEvents(included, googleToken);
            }
          }
        } catch (e) {
          console.error('[deckStore] calendar fetch error:', e);
        }
      }

      const dismissed = new Set(settings.dismissedCalendarEventIds);
      events = events.filter((e) => !dismissed.has(e.id));

      const cards = buildDeckCards(tasks, projects, events);
      set({ queue: cards, projects, calendars, totalCount: cards.length, doneCount: 0, laterCount: 0, isLoading: false });
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

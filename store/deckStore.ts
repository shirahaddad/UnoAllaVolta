import { create } from 'zustand';
import * as SecureStore from '@/utils/storage';
import { fetchTasks, fetchProjects, closeTask, rescheduleTask, refreshTodoistToken, TodoistAuthError, TodoistProject } from '@/services/todoist';
import { fetchTodayEvents, fetchCalendarList, GoogleCalendar } from '@/services/googleCalendar';
import { useAuthStore, TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET } from '@/store/authStore';
import { useGoogleAuthStore } from '@/store/googleAuthStore';
import { buildDeckCards } from '@/utils/cardBuilder';
import { useSettingsStore } from '@/store/settingsStore';

const KEY_DECK = 'cached_deck_v1';

export type CardType = 'calendar' | 'task';

export interface Card {
  id: string;
  type: CardType;
  title: string;
  subtitle: string;
  description?: string;
  sourceUrl?: string;
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
  authErrorDetail: string | null;
  todoistDisconnected: boolean;
  pendingUndo: Card | null;
  browseIndex: number;
  lastFetchedAt: number;
  loadCachedCards: () => Promise<void>;
  markDone: (id: string) => void;
  commitPendingUndo: () => void;
  cancelPendingUndo: () => void;
  moveLater: (id: string) => void;
  rescheduleTomorrow: (id: string) => void;
  fetchCards: (token?: string | null, retryCount?: number) => Promise<void>;
  browseBy: (delta: number) => void;
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
  authErrorDetail: null,
  todoistDisconnected: false,
  pendingUndo: null,
  browseIndex: 0,
  lastFetchedAt: 0,

  loadCachedCards: async () => {
    try {
      const raw = await SecureStore.getItemAsync(KEY_DECK);
      if (!raw) return;
      const { cards, laterCount, date } = JSON.parse(raw) as { cards: Card[]; laterCount: number; date?: string };
      const todayStr = new Date().toLocaleDateString('en-CA');
      if (date !== todayStr) return;
      if (Array.isArray(cards) && cards.length > 0) {
        set({ queue: cards, laterCount, totalCount: cards.length, browseIndex: 0 });
      }
    } catch {}
  },

  markDone: (id) =>
    set((state) => {
      const card = state.queue.find((c) => c.id === id);
      if (!card) return state;
      if (state.pendingUndo) _commit(state.pendingUndo);
      const newQueue = state.queue.filter((c) => c.id !== id);
      const newLaterCount = state.laterCount >= newQueue.length ? 0 : state.laterCount;
      useSettingsStore.getState().saveQueueState(newQueue.map(c => c.id), newLaterCount).catch(console.error);
      return {
        queue: newQueue,
        doneCount: state.doneCount + 1,
        laterCount: newLaterCount,
        pendingUndo: card,
        browseIndex: 0,
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
      const newQueue = [state.pendingUndo, ...state.queue];
      useSettingsStore.getState().saveQueueState(newQueue.map(c => c.id), state.laterCount).catch(console.error);
      return {
        pendingUndo: null,
        queue: newQueue,
        doneCount: Math.max(0, state.doneCount - 1),
        browseIndex: 0,
      };
    }),

  moveLater: (id) =>
    set((state) => {
      const card = state.queue.find((c) => c.id === id);
      if (!card) return state;
      const newQueue = [...state.queue.filter((c) => c.id !== id), card];
      const newLaterCount = state.laterCount + 1 >= state.queue.length ? 0 : state.laterCount + 1;
      useSettingsStore.getState().saveQueueState(newQueue.map(c => c.id), newLaterCount).catch(console.error);
      return { queue: newQueue, laterCount: newLaterCount, browseIndex: 0 };
    }),

  rescheduleTomorrow: (id) =>
    set((state) => {
      if (!state.queue.find((c) => c.id === id)) return state;
      const token = useAuthStore.getState().todoistToken;
      if (token) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        rescheduleTask(id, d.toLocaleDateString('en-CA'), token)
          .catch((e) => console.error('[todoist] rescheduleTask failed:', e));
      }
      const newQueue = state.queue.filter((c) => c.id !== id);
      const newLaterCount = state.laterCount >= newQueue.length ? 0 : state.laterCount;
      useSettingsStore.getState().saveQueueState(newQueue.map(c => c.id), newLaterCount).catch(console.error);
      return { queue: newQueue, laterCount: newLaterCount, doneCount: state.doneCount + 1, browseIndex: 0 };
    }),

  browseBy: (delta) =>
    set((state) => {
      const len = state.queue.length;
      if (len === 0) return { browseIndex: 0 };
      const next = ((state.browseIndex + delta) % len + len) % len;
      return { browseIndex: next };
    }),

  fetchCards: async (token, retryCount = 0) => {
    set({ isLoading: true, error: null, authErrorDetail: null });

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      set({ isLoading: false, error: 'network', authErrorDetail: null });
    }, 30_000);

    try {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const settings = useSettingsStore.getState();

      // Fetch Todoist independently so a 401 does not abort the calendar fetch.
      let allTasks: Awaited<ReturnType<typeof fetchTasks>> = [];
      let projects: Awaited<ReturnType<typeof fetchProjects>> = [];
      let todoistAuthFailed = false;
      let todoistAuthDetail: string | null = null;

      if (token) {
        // allSettled so both promises' rejections are handled — with Promise.all a
        // simultaneous 477 on the second call would become an unhandled rejection.
        const [tasksResult, projectsResult] = await Promise.allSettled([
          fetchTasks(token),
          fetchProjects(token),
        ]);
        const firstError =
          tasksResult.status === 'rejected' ? tasksResult.reason :
          projectsResult.status === 'rejected' ? projectsResult.reason : null;
        if (firstError) {
          if (firstError instanceof TodoistAuthError) {
            if (firstError.errorCode === 477 && retryCount === 0) {
              // Token expired — attempt refresh before giving up (per Todoist docs: do NOT retry same token).
              const { todoistRefreshToken } = useAuthStore.getState();
              if (todoistRefreshToken) {
                const refreshed = await refreshTodoistToken(todoistRefreshToken, TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET);
                if (refreshed) {
                  await useAuthStore.getState().setTodoistToken(refreshed.accessToken);
                  if (refreshed.refreshToken) {
                    await useAuthStore.getState().setTodoistRefreshToken(refreshed.refreshToken);
                  }
                  clearTimeout(timeoutId);
                  await useDeckStore.getState().fetchCards(refreshed.accessToken, 1);
                  return;
                }
              }
            }
            todoistAuthFailed = true;
            todoistAuthDetail = (firstError as Error).message || null;
            console.error('[deckStore] Todoist auth error:', firstError);
          } else {
            throw firstError;
          }
        } else {
          allTasks = (tasksResult as PromiseFulfilledResult<typeof allTasks>).value;
          projects = (projectsResult as PromiseFulfilledResult<typeof projects>).value;
        }
      }

      const excludedProjects = new Set(settings.excludedProjectIds);
      const tasks = allTasks.filter(
        (t) => !t.checked && !excludedProjects.has(t.project_id) && (t.due === null || t.due.date <= todayStr)
      );

      // Fetch calendar regardless of Todoist outcome.
      const googleToken = await useGoogleAuthStore.getState().getValidToken();
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
      const pendingCard = useDeckStore.getState().pendingUndo;
      if (pendingCard?.type === 'calendar') dismissed.add(pendingCard.id);
      events = events.filter((e) => !dismissed.has(e.id));

      const cards = buildDeckCards(tasks, projects, events);
      const saved = useSettingsStore.getState().savedQueueState;
      let ordered: typeof cards;
      let laterCount: number;
      if (saved && saved.orderedIds.length > 0) {
        const posMap = new Map(saved.orderedIds.map((id, i) => [id, i]));
        const known = cards.filter(c => posMap.has(c.id))
          .sort((a, b) => posMap.get(a.id)! - posMap.get(b.id)!);
        const brandNew = cards.filter(c => !posMap.has(c.id));
        ordered = [...known, ...brandNew];
        laterCount = Math.min(saved.laterCount, Math.max(0, ordered.length - 1));
      } else {
        ordered = cards;
        laterCount = 0;
      }

      // When Todoist is disconnected but calendar cards exist: surface banner, not error screen.
      // When Todoist is disconnected and nothing else loaded either: surface error screen.
      const noCards = ordered.length === 0;
      clearTimeout(timeoutId);
      if (!timedOut) {
        set({
          queue: ordered,
          projects,
          calendars,
          totalCount: ordered.length,
          doneCount: 0,
          laterCount,
          isLoading: false,
          error: todoistAuthFailed && noCards ? 'invalid_token' : null,
          todoistDisconnected: todoistAuthFailed,
          authErrorDetail: todoistAuthFailed ? todoistAuthDetail : null,
          browseIndex: 0,
          lastFetchedAt: todoistAuthFailed ? 0 : Date.now(),
        });
        if (!todoistAuthFailed || !noCards) {
          SecureStore.setItemAsync(KEY_DECK, JSON.stringify({ cards: ordered, laterCount, date: todayStr })).catch(console.error);
        }
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.error('[deckStore] fetchCards error:', e);
      if (!timedOut) set({ isLoading: false, error: 'network', authErrorDetail: null });
    }
  },
}));

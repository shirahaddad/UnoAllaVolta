# UnoAllaVolta — Product Spec

> *Uno alla volta* — one at a time.
> A flashcard-style daily planner that surfaces your Todoist tasks and Google Calendar events one at a time, so you focus on one thing instead of everything.

---

## Overview

| | |
|---|---|
| **Platform** | React Native (Expo) — iOS + Android |
| **Integrations** | Todoist REST API v2 · Google Calendar API v3 |
| **Card loop logic** | Events (chronological) → Tasks (by priority), cyclic |
| **Snooze model** | Later today — card moves to end of queue, no external change |

---

## Card Types

Every active item for today becomes a card. Cards are grouped and ordered as follows:

1. **Calendar events** — chronological by start time (includes all-day and recurring)
2. **Todoist tasks** — by priority, then creation date (includes recurring tasks)

Cards swiped to "Later" move to the end of the active queue and remain there until marked done or rescheduled.

---

## Card Data Model

### Calendar event card
- Type label: "calendar"
- Title: event title
- Subtitle: start time + duration, location or conference link if present
- Source: Google Calendar API

### Task card
- Type label: "task"
- Title: task content
- Subtitle: project name, due time if set
- Source: Todoist REST API

---

## Card Interactions

| Action | Gesture | Behavior |
|---|---|---|
| Done | Swipe right or tap "Done" | Marks task complete in Todoist (or acknowledges calendar event locally). Card removed from deck. |
| Later | Swipe left or tap "Later" | Card moves to end of queue. No external change. Stays active all day. |
| Reschedule | Tap "Reschedule" | Opens date picker. Moves task to selected date in Todoist. Card removed from deck. |
| Expand | Tap card body | Shows full detail: description, notes, subtasks, location. |

---

## Progress & Navigation

- Progress bar at top shows position in today's deck (e.g. "card 3 of 11")
- Two-segment indicator shows which section is active: events vs tasks
- Cards swiped "Later" are not counted as progress until marked done

---

## Empty State (Clear Deck)

When all cards are marked done, show a celebration screen with:
- A visual celebration moment (confetti, animation, or similar)
- A randomly selected gentle suggestion from a curated list, e.g.:
  - "Read a book"
  - "Take a walk"
  - "Call someone you love"
  - "Play a game"
  - "Take a nap"
  - "Make something with your hands"
- A "See what's tomorrow" link (read-only peek at tomorrow's deck)

The suggestion is decorative — not a task, not actionable.

---

## Data & Sync

### Todoist
- Auth: OAuth 2.0
- Read: tasks due today + tasks with no date
- Write: mark complete, update due date (reschedule)
- API: REST API v2 (`https://api.todoist.com/rest/v2/`)

### Google Calendar
- Auth: OAuth 2.0
- Read: all events for today across all user calendars
- Write: none in v1 (calendar events are acknowledged locally only)
- API: Calendar API v3 (`https://www.googleapis.com/calendar/v3/`)

### Sync behavior
- Sync on app open
- Manual pull-to-refresh
- No background polling in v1
- Today's card queue stored in-memory + AsyncStorage for session persistence
- Queue resets at midnight

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React Native (Expo) | Single codebase for iOS + Android, fastest path to production |
| Navigation | React Navigation | Stack + bottom tab |
| Auth | expo-auth-session | Handles OAuth flows for both Todoist and Google |
| Gestures | react-native-reanimated + react-native-gesture-handler | Standard for swipe card UI |
| State | Zustand | Lightweight, minimal boilerplate |
| Storage | AsyncStorage | Session persistence for today's queue |

---

## Project Structure (suggested)

```
UnoAllaVolta/
├── app/
│   ├── index.tsx          # Entry / today's deck
│   ├── onboarding.tsx     # Auth flow
│   └── tomorrow.tsx       # Peek at tomorrow
├── components/
│   ├── FlipCard.tsx       # Core card component
│   ├── CardDeck.tsx       # Deck container + queue logic
│   ├── ProgressBar.tsx    # Top progress indicator
│   └── EmptyState.tsx     # Clear deck screen
├── services/
│   ├── todoist.ts         # Todoist API client
│   └── googleCalendar.ts  # Google Calendar API client
├── store/
│   └── deckStore.ts       # Zustand store for card queue
├── utils/
│   └── cardBuilder.ts     # Merges + sorts events and tasks into card list
└── SPEC.md                # This file
```

---

## Build Phases

### Phase 1 — Core loop (personal use)
- [ ] Expo project setup
- [ ] Todoist OAuth + task fetching
- [ ] Google Calendar OAuth + event fetching
- [ ] Card queue builder (merge, sort, group)
- [ ] FlipCard component with swipe gestures
- [ ] Done / Later / Reschedule actions
- [ ] Progress bar
- [ ] Empty state screen

### Phase 2 — Polish & settings
- [ ] Calendar filter (choose which calendars appear)
- [ ] Notification reminders
- [ ] Onboarding flow for new users
- [ ] "Later" cards visually flagged when they reappear
- [ ] Overdue task handling (tasks from previous days)

### Phase 3 — App store release
- [ ] Privacy policy
- [ ] Production OAuth credentials
- [ ] App Store submission
- [ ] Google Play submission
- [ ] Crash reporting (Sentry)

---

## Open Questions

1. How should task ordering within the tasks section work — Todoist priority, due time, or manual order?
2. Should "Later" cards show a visual indicator when they reappear in the queue?
3. What happens to overdue tasks from previous days — do they appear in today's deck?
4. Will there be a "peek ahead" view for tomorrow, or is UnoAllaVolta intentionally today-only?

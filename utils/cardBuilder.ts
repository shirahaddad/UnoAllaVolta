import { Card } from '@/store/deckStore';
import { TodoistTask, TodoistProject } from '@/services/todoist';
import { GoogleEvent, GoogleCalendar, formatEventTime } from '@/services/googleCalendar';

function formatDueTime(due: TodoistTask['due']): string {
  if (!due) return 'no due time';
  if (due.datetime) {
    const date = new Date(due.datetime);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return 'due today';
}

function eventSortKey(e: GoogleEvent): string {
  // All-day events (no dateTime) sort before timed events
  return e.start.dateTime ?? '0000';
}

export function buildDeckCards(
  tasks: TodoistTask[],
  projects: TodoistProject[],
  events: GoogleEvent[] = [],
): Card[] {
  const projectMap: Record<string, string> = {};
  for (const p of projects) projectMap[p.id] = p.name;

  const sortedEvents = [...events].sort((a, b) =>
    eventSortKey(a).localeCompare(eventSortKey(b))
  );

  const sortedTasks = [...tasks].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (a.created_at ?? '').localeCompare(b.created_at ?? '');
  });

  const eventCards: Card[] = sortedEvents.map((event, i) => ({
    id: event.id,
    type: 'calendar' as const,
    title: event.summary,
    subtitle: `${formatEventTime(event)} · ${event.calendarName}`,
    order: i + 1,
  }));

  const taskCards: Card[] = sortedTasks.map((task, i) => ({
    id: task.id,
    type: 'task' as const,
    title: task.content,
    subtitle: `${projectMap[task.project_id] ?? 'Inbox'} · ${formatDueTime(task.due)}`,
    order: eventCards.length + i + 1,
  }));

  return [...eventCards, ...taskCards];
}

// Keep old name as alias for any existing callers
export const buildCards = buildDeckCards;

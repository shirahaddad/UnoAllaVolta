import { Card } from '@/store/deckStore';
import { TodoistTask, TodoistProject } from '@/services/todoist';

function formatDueTime(due: TodoistTask['due']): string {
  if (!due) return 'no due time';
  if (due.datetime) {
    const date = new Date(due.datetime);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return 'due today';
}

export function buildCards(
  tasks: TodoistTask[],
  projects: TodoistProject[]
): Card[] {
  const projectMap: Record<string, string> = {};
  for (const p of projects) projectMap[p.id] = p.name;

  const sorted = [...tasks].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (a.created_at ?? '').localeCompare(b.created_at ?? '');
  });

  return sorted.map((task, index) => ({
    id: task.id,
    type: 'task' as const,
    title: task.content,
    subtitle: `${projectMap[task.project_id] ?? 'Inbox'} · ${formatDueTime(task.due)}`,
    order: index + 1,
  }));
}

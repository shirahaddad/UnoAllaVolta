const BASE = 'https://api.todoist.com/api/v1';

export interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  priority: 1 | 2 | 3 | 4;
  due: { date: string; datetime?: string | null } | null;
  project_id: string;
  created_at?: string;
  checked: boolean;
}

export interface TodoistProject {
  id: string;
  name: string;
  is_frozen: boolean;
}

export class TodoistAuthError extends Error {}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    const body = await res.text().catch(() => '(unreadable)');
    console.error('[todoist] 401 response body:', body);
    throw new TodoistAuthError(body);
  }
  if (!res.ok) throw new Error(`Todoist API error: ${res.status}`);
  return res.json();
}

const TASK_FILTER = encodeURIComponent('(today | overdue | no date) & !#Templates');

export async function fetchTasks(token: string): Promise<TodoistTask[]> {
  const all: TodoistTask[] = [];
  let cursor: string | null = null;

  do {
    const url = `${BASE}/tasks?filter=${TASK_FILTER}&limit=200${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      const body = await res.text().catch(() => '(unreadable)');
      console.error('[todoist] 401 response body:', body);
      throw new TodoistAuthError(body);
    }
    if (!res.ok) throw new Error(`Todoist API error: ${res.status}`);
    const data = await res.json() as Record<string, unknown>;
    const page = (data.results ?? data.tasks ?? data.items ?? data.data ?? []) as TodoistTask[];
    if (Array.isArray(page)) all.push(...page);
    cursor = (data.next_cursor as string | null) ?? null;
  } while (cursor);

  return all;
}

export async function closeTask(taskId: string, token: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${taskId}/close`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[todoist] closeTask ${res.status}:`, body);
    if (res.status === 401) throw new TodoistAuthError(body);
    throw new Error(`Todoist API error: ${res.status}`);
  }
}

export async function fetchProjects(token: string): Promise<TodoistProject[]> {
  const data = await get<unknown>('/projects', token);
  if (Array.isArray(data)) return data as TodoistProject[];
  const obj = data as Record<string, unknown>;
  const arr = obj.projects ?? obj.results ?? obj.items ?? obj.data;
  if (Array.isArray(arr)) return arr as TodoistProject[];
  return [];
}

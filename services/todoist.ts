import { Platform } from 'react-native';

// Browsers block direct calls to api.todoist.com and todoist.com/oauth (no CORS
// headers on those origins), so web routes through same-origin Vercel proxies;
// native hits Todoist directly.
const BASE = Platform.OS === 'web' ? '/api/todoist' : 'https://api.todoist.com/api/v1';
export const TODOIST_OAUTH_URL = Platform.OS === 'web' ? '/api/todoist-oauth' : 'https://todoist.com/oauth/access_token';

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

export class TodoistAuthError extends Error {
  constructor(
    message: string,
    public errorCode?: number,
    public retryAfter?: number,
    public errorTag?: string,
    public requestId?: string,
  ) {
    super(message);
  }
}

function parse401(body: string): { errorCode?: number; retryAfter?: number; errorTag?: string } {
  try {
    const parsed = JSON.parse(body);
    return {
      errorCode: parsed.error_code,
      retryAfter: parsed.error_extra?.retry_after,
      errorTag: parsed.error_tag,
    };
  } catch {
    return {};
  }
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    const body = await res.text().catch(() => '(unreadable)');
    const requestId = res.headers.get('x-request-id') ?? undefined;
    const { errorCode, retryAfter, errorTag } = parse401(body);
    const log = errorCode === 477 ? console.warn : console.error;
    log('[todoist] 401:', { endpoint: path, errorCode, errorTag, requestId, body });
    throw new TodoistAuthError(body, errorCode, retryAfter, errorTag, requestId);
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
      const requestId = res.headers.get('x-request-id') ?? undefined;
      const { errorCode, retryAfter, errorTag } = parse401(body);
      const log = errorCode === 477 ? console.warn : console.error;
      log('[todoist] 401:', { endpoint: url, errorCode, errorTag, requestId, body });
      throw new TodoistAuthError(body, errorCode, retryAfter, errorTag, requestId);
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
    if (res.status === 401) {
      const { errorCode, retryAfter } = parse401(body);
      throw new TodoistAuthError(body, errorCode, retryAfter);
    }
    throw new Error(`Todoist API error: ${res.status}`);
  }
}

// Todoist rotates the refresh token on every use (the old one is consumed and
// becomes invalid), so the caller must persist the new refreshToken too, or
// every refresh after the first will fail with invalid_grant.
export async function refreshTodoistToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  try {
    const res = await fetch(TODOIST_OAUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    const data = await res.json();
    console.log('[todoist] token refresh response:', res.status, data.access_token ? 'got token' : JSON.stringify(data));
    if (!data.access_token) return null;
    return { accessToken: data.access_token as string, refreshToken: data.refresh_token as string | undefined };
  } catch (e) {
    console.error('[todoist] token refresh failed:', e);
    return null;
  }
}

export async function rescheduleTask(taskId: string, dueDate: string, token: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${taskId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ due_date: dueDate }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) {
      const { errorCode, retryAfter } = parse401(body);
      throw new TodoistAuthError(body, errorCode, retryAfter);
    }
    throw new Error(`Todoist API error: ${res.status}`);
  }
}

export async function createTask(
  content: string,
  token: string,
  options?: { project_id?: string; priority?: number },
): Promise<void> {
  const res = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, due_string: 'today', ...options }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) {
      const { errorCode, retryAfter } = parse401(body);
      throw new TodoistAuthError(body, errorCode, retryAfter);
    }
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

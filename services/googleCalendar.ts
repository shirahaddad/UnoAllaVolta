const BASE = 'https://www.googleapis.com/calendar/v3';

export interface GoogleCalendar {
  id: string;
  summary: string;
}

export interface GoogleEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  calendarId: string;
  calendarName: string;
}

async function googleGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Google API error: ${res.status}`);
  return res.json();
}

export async function fetchCalendarList(token: string): Promise<GoogleCalendar[]> {
  const data = await googleGet<{ items?: GoogleCalendar[] }>('/users/me/calendarList', token);
  return data.items ?? [];
}

export async function fetchTodayEvents(
  calendars: GoogleCalendar[],
  token: string
): Promise<GoogleEvent[]> {
  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const results = await Promise.all(
    calendars.map(async (cal) => {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      });
      const data = await googleGet<{ items?: any[] }>(
        `/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
        token
      );
      return (data.items ?? []).map((e: any) => ({
        id: `${cal.id}::${e.id}`,
        summary: e.summary ?? '(No title)',
        start: e.start,
        end: e.end,
        calendarId: cal.id,
        calendarName: cal.summary,
      })) as GoogleEvent[];
    })
  );

  return results.flat();
}

export function formatEventTime(event: GoogleEvent): string {
  if (!event.start.dateTime) return 'All day';
  const start = new Date(event.start.dateTime);
  const end = event.end.dateTime ? new Date(event.end.dateTime) : null;
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

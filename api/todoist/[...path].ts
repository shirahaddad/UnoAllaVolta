import type { VercelRequest, VercelResponse } from '@vercel/node';

const TODOIST_BASE = 'https://api.todoist.com/api/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathParam = req.query.path;
  const path = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam ?? '');
  const queryString = req.url?.split('?')[1];
  const url = `${TODOIST_BASE}/${path}${queryString ? `?${queryString}` : ''}`;

  const headers: Record<string, string> = {};
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'] as string;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body),
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
    res.send(body);
  } catch (e) {
    console.error('[api/todoist] proxy error:', e);
    res.status(502).json({ error: 'proxy_failed' });
  }
}

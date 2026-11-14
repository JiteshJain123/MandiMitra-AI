const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'mm_token';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } },
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your internet connection.');
  }
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try { body = await res.json(); } catch { /* not JSON */ }
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, body.error?.code ?? `HTTP_${res.status}`, body.error?.message ?? 'Request failed.', body.error?.details);
  }
  return res;
}

export const api = {
  async get<T>(path: string): Promise<T> { return (await raw(path)).json(); },
  async post<T>(path: string, body?: unknown, headers?: HeadersInit): Promise<T> {
    const res = await raw(path, { method: 'POST', body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body), headers });
    return res.status === 204 ? (undefined as T) : res.json();
  },
  async patch<T>(path: string, body: unknown): Promise<T> { return (await raw(path, { method: 'PATCH', body: JSON.stringify(body) })).json(); },
  async del(path: string): Promise<void> { await raw(path, { method: 'DELETE' }); },
  async blob(path: string, init?: RequestInit): Promise<{ blob: Blob; filename?: string }> {
    const res = await raw(path, init);
    const cd = res.headers.get('Content-Disposition') ?? '';
    return { blob: await res.blob(), filename: /filename="([^"]+)"/.exec(cd)?.[1] };
  },
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

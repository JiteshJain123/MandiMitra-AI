import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, tokenStore } from './api';

afterEach(() => { vi.restoreAllMocks(); tokenStore.clear(); });

describe('api client', () => {
  it('sends the bearer token and parses JSON', async () => {
    tokenStore.set('abc');
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    await expect(api.get('/api/x')).resolves.toEqual({ ok: 1 });
    expect(new Headers(spy.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer abc');
  });

  it('surfaces server error codes and messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { code: 'GNANI_TIMEOUT', message: 'took too long' } }), { status: 504 }));
    await expect(api.post('/api/voice/transcribe', new FormData())).rejects.toMatchObject({ status: 504, code: 'GNANI_TIMEOUT', message: 'took too long' });
  });

  it('reports network failures distinctly (used for offline queueing)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const err = (await api.get('/api/x').catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NETWORK_ERROR');
  });
});

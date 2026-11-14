import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '../src/config/env.js';
import { app, auth, makeWav, registerUser, useDatabase, WHEAT } from './helpers.js';

useDatabase();

const REFERENCE = 'Bhaiya, 25 quintal gehu becha hai, rate 2400 rupaye per quintal hai. 2 percent commission aur 500 rupaye transport charge kaat lena.';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => impl(String(input), init ?? {}));
}

afterEach(() => {
  vi.restoreAllMocks();
  process.env.GNANI_API_KEY = 'test-key-not-real';
  resetEnvCache();
});

describe('POST /api/voice/transcribe (Prisma, mocked)', () => {
  it('sends the documented request and returns the actual transcript with extraction', async () => {
    const { token } = await registerUser({ preferredLanguage: 'hinglish' });
    let captured: { url: string; headers: Headers; form: FormData } | undefined;
    mockFetch(async (url, init) => {
      captured = { url, headers: new Headers(init.headers), form: init.body as FormData };
      return json(200, { success: true, request_id: 'req-1', transcript: REFERENCE, model: 'prisma-v3.0', detected_language_code: 'hi-IN', processing_time: 0.8, end_to_end_latency: 1.1 });
    });
    const res = await request(app).post('/api/voice/transcribe').set(auth(token)).attach('audio', makeWav(3), 'rec.wav').expect(200);

    expect(captured?.url).toBe('https://gnani.test/stt/v3');
    expect(captured?.headers.get('X-API-Key-ID')).toBe('test-key-not-real');
    expect(captured?.form.get('model')).toBe('prisma-v3.0');
    expect(captured?.form.get('language_code')).toBe('hi-IN,en-IN');
    expect(captured?.form.get('format')).toBe('transcribe');
    expect(captured?.form.get('audio_file')).toBeInstanceOf(Blob);

    expect(res.body.transcript).toBe(REFERENCE);
    expect(res.body.detectedLanguageCode).toBe('hi-IN');
    expect(res.body.audio).toEqual({ format: 'wav', durationSeconds: 3 });
    expect(res.body.extraction.draft).toMatchObject({ cropName: 'Wheat', quantity: 25, ratePerUnit: 2400, commissionPercentage: 2, transportCharge: 500 });
    expect(JSON.stringify(res.body)).not.toContain('test-key-not-real');
  });

  it('supports automatic language detection with indic-auto', async () => {
    const { token } = await registerUser();
    let lang: unknown;
    mockFetch(async (_u, init) => { lang = (init.body as FormData).get('language_code'); return json(200, { success: true, request_id: 'r', transcript: '' }); });
    const res = await request(app).post('/api/voice/transcribe').set(auth(token)).field('language', 'auto').attach('audio', makeWav(1), 'a.wav').expect(200);
    expect(lang).toBe('indic-auto');
    expect(res.body.transcript).toBe('');
    expect(res.body.extraction).toBeNull();
  });

  it('rejects invalid audio before calling Gnani', async () => {
    const { token } = await registerUser();
    const spy = mockFetch(() => json(200, {}));
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(100)]);
    const cases: [Buffer, number, string][] = [
      [webm, 415, 'AUDIO_UNSUPPORTED_FORMAT'],
      [Buffer.from('this is not audio at all'), 415, 'AUDIO_UNSUPPORTED_FORMAT'],
      [makeWav(31), 400, 'AUDIO_TOO_LONG'],
      [makeWav(0.1), 400, 'AUDIO_TOO_SHORT'],
    ];
    for (const [buf, status, code] of cases) {
      const res = await request(app).post('/api/voice/transcribe').set(auth(token)).attach('audio', buf, 'x.bin');
      expect(res.status, code).toBe(status);
      expect(res.body.error.code).toBe(code);
    }
    const missing = await request(app).post('/api/voice/transcribe').set(auth(token)).field('language', 'hi');
    expect(missing.body.error.code).toBe('AUDIO_MISSING');
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    [401, { detail: { error_code: 'INVALID_API_KEY', message: 'bad key', status_code: 401 } }, 502, 'GNANI_AUTH_FAILED'],
    [402, { detail: { error_code: 'INSUFFICIENT_CREDIT', message: 'x', status_code: 402 } }, 502, 'GNANI_INSUFFICIENT_CREDIT'],
    [429, { detail: { error_code: 'RATE_LIMITED', message: 'slow', status_code: 429 } }, 429, 'GNANI_RATE_LIMITED'],
    [400, { success: false, error: { type: 'AUDIO_CONVERSION_ERROR', message: 'x' } }, 400, 'GNANI_AUDIO_CONVERSION_ERROR'],
    [422, { detail: [{ loc: ['body', 'language_code'], msg: 'Field required' }] }, 400, 'GNANI_VALIDATION_ERROR'],
    [504, { error: 'timeout', code: 'UPSTREAM_TIMEOUT', message: 'x' }, 504, 'GNANI_TIMEOUT'],
    [500, { success: false, error: { type: 'TRANSCRIPTION_FAILED', message: 'x' } }, 502, 'GNANI_UPSTREAM_ERROR'],
  ])('maps Gnani HTTP %i to a safe error', async (status, body, expectedStatus, code) => {
    const { token } = await registerUser();
    mockFetch(() => json(status, body));
    const res = await request(app).post('/api/voice/transcribe').set(auth(token)).attach('audio', makeWav(1), 'a.wav');
    expect(res.status).toBe(expectedStatus);
    expect(res.body.error.code).toBe(code);
    expect(JSON.stringify(res.body)).not.toMatch(/bad key|test-key-not-real/);
  });

  it('handles client-side timeouts and network failures', async () => {
    const { token } = await registerUser();
    mockFetch(() => { throw Object.assign(new Error('aborted'), { name: 'TimeoutError' }); });
    const t = await request(app).post('/api/voice/transcribe').set(auth(token)).attach('audio', makeWav(1), 'a.wav');
    expect(t.status).toBe(504);
    expect(t.body.error.code).toBe('GNANI_TIMEOUT');
    vi.restoreAllMocks();
    mockFetch(() => { throw new TypeError('fetch failed'); });
    const n = await request(app).post('/api/voice/transcribe').set(auth(token)).attach('audio', makeWav(1), 'a.wav');
    expect(n.body.error.code).toBe('GNANI_NETWORK_ERROR');
  });

  it('rejects an unexpected success body instead of inventing a transcript', async () => {
    const { token } = await registerUser();
    mockFetch(() => json(200, { success: true, text: 'wrong field' }));
    const res = await request(app).post('/api/voice/transcribe').set(auth(token)).attach('audio', makeWav(1), 'a.wav');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('GNANI_INVALID_RESPONSE');
  });

  it('returns 503 when no API key is configured', async () => {
    process.env.GNANI_API_KEY = '';
    resetEnvCache();
    const { token } = await registerUser();
    const spy = mockFetch(() => json(200, {}));
    const res = await request(app).post('/api/voice/transcribe').set(auth(token)).attach('audio', makeWav(1), 'a.wav');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('GNANI_NOT_CONFIGURED');
    expect(spy).not.toHaveBeenCalled();
  });

  it('records the last call outcome for the status indicator', async () => {
    const { token } = await registerUser();
    mockFetch(() => json(401, { detail: { error_code: 'INVALID_API_KEY', message: 'x', status_code: 401 } }));
    await request(app).post('/api/voice/transcribe').set(auth(token)).attach('audio', makeWav(1), 'a.wav');
    const health = await request(app).get('/api/health');
    expect(health.body.gnani.stt.lastErrorCode).toBe('GNANI_AUTH_FAILED');
  });
});

describe('POST /api/voice/speak (Timbre, mocked)', () => {
  it('sends the documented body and streams binary audio back unchanged', async () => {
    const { token } = await registerUser({ preferredLanguage: 'hi' });
    const fakeMp3 = Buffer.concat([Buffer.from('ID3'), Buffer.from([0x04, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(500, 7)]);
    let sent: Record<string, unknown> | undefined;
    let url = '';
    mockFetch(async (u, init) => {
      url = u;
      sent = JSON.parse(init.body as string);
      return new Response(new Uint8Array(fakeMp3), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    });
    const res = await request(app).post('/api/voice/speak').set(auth(token)).send({ text: 'आपको कुल ₹58,300 मिलेंगे।' })
      .buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); })
      .expect(200);
    expect(url).toBe('https://gnani.test/api/v1/tts/inference');
    expect(sent).toMatchObject({ model: 'timbre-v2.5', voice: 'Nalini', language: 'hi-IN', audio_config: { container: 'mp3' } });
    expect(res.headers['content-type']).toBe('audio/mpeg');
    expect(Buffer.compare(res.body as Buffer, fakeMp3)).toBe(0);
  });

  it('uses a voice whose preferred language matches (English -> Devika)', async () => {
    const { token } = await registerUser({ preferredLanguage: 'en' });
    let sent: Record<string, unknown> | undefined;
    mockFetch(async (_u, init) => { sent = JSON.parse(init.body as string); return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } }); });
    await request(app).post('/api/voice/speak').set(auth(token)).send({ text: 'Net payable ₹58,300.' }).expect(200);
    expect(sent).toMatchObject({ voice: 'Devika', language: 'en-IN' });
  });

  it('maps TTS errors and rejects non-audio responses', async () => {
    const { token } = await registerUser();
    mockFetch(() => json(400, { success: false, message: 'Invalid request: voice', status_code: 400 }));
    const bad = await request(app).post('/api/voice/speak').set(auth(token)).send({ text: 'hello' });
    expect(bad.status).toBe(400);
    vi.restoreAllMocks();
    mockFetch(() => json(401, { detail: { error_code: 'INVALID_API_KEY', message: 'x', status_code: 401 } }));
    expect((await request(app).post('/api/voice/speak').set(auth(token)).send({ text: 'hello' })).body.error.code).toBe('GNANI_AUTH_FAILED');
    vi.restoreAllMocks();
    mockFetch(() => new Response('<html>oops</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
    expect((await request(app).post('/api/voice/speak').set(auth(token)).send({ text: 'hello' })).body.error.code).toBe('GNANI_INVALID_RESPONSE');
  });

  it('validates text length', async () => {
    const { token } = await registerUser();
    expect((await request(app).post('/api/voice/speak').set(auth(token)).send({ text: '' })).status).toBe(400);
    expect((await request(app).post('/api/voice/speak').set(auth(token)).send({ text: 'x'.repeat(601) })).status).toBe(400);
  });
});

describe('voice extraction and queries', () => {
  it('extracts from an edited transcript', async () => {
    const { token } = await registerUser();
    const res = await request(app).post('/api/voice/extract').set(auth(token)).send({ transcript: '30 quintal chana 5200 rupaye quintal' }).expect(200);
    expect(res.body.draft).toMatchObject({ cropName: 'Gram', quantity: 30, ratePerUnit: 5200 });
    expect(res.body.missingFields).toEqual([]);
  });

  it('answers "Mera kitna paisa pending hai?" from the user\'s own data only', async () => {
    const alice = await registerUser({ preferredLanguage: 'hi' });
    const bob = await registerUser();
    await request(app).post('/api/transactions').set(auth(alice.token)).send({ ...WHEAT, confirmed: true }).expect(201);
    await request(app).post('/api/transactions').set(auth(bob.token)).send({ ...WHEAT, quantity: 100, confirmed: true }).expect(201);
    const res = await request(app).post('/api/voice/query').set(auth(alice.token)).send({ question: 'Mera kitna paisa pending hai?' }).expect(200);
    expect(res.body.intent).toBe('pending_total');
    expect(res.body.data.outstandingPaise).toBe(5_830_000);
    expect(res.body.answerText).toContain('₹58,300');
  });

  it('answers crop sales for this month', async () => {
    const { token } = await registerUser({ preferredLanguage: 'en' });
    await request(app).post('/api/transactions').set(auth(token)).send({ ...WHEAT, confirmed: true }).expect(201);
    await request(app).post('/api/transactions').set(auth(token)).send({ ...WHEAT, transactionDate: '2025-01-10', confirmed: true }).expect(201);
    const res = await request(app).post('/api/voice/query').set(auth(token)).send({ question: 'Is mahine kitni gehun ki sale hui?' }).expect(200);
    expect(res.body).toMatchObject({ intent: 'crop_sales', crop: 'Wheat', period: 'this_month' });
    expect(res.body.data.grossPaise).toBe(6_000_000);
  });

  it('lists unpaid transactions', async () => {
    const { token } = await registerUser();
    await request(app).post('/api/transactions').set(auth(token)).send({ ...WHEAT, confirmed: true }).expect(201);
    const res = await request(app).post('/api/voice/query').set(auth(token)).send({ question: 'Kaunse transactions ka payment abhi nahi aaya?' }).expect(200);
    expect(res.body.intent).toBe('unpaid_list');
    expect(res.body.data.total).toBe(1);
  });
});

import { getLanguage } from '@mandimitra/shared';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { mapGnaniError, timeoutOrNetworkError } from './gnani-errors.js';
import { recordFailure, recordSuccess } from './gnani-status.js';

/**
 * Gnani Timbre text-to-speech (REST).
 * Docs: https://docs.gnani.ai/api/TTS/tts-inference  (verified 2026-11-13)
 *   POST {base}/api/v1/tts/inference, JSON, header X-API-Key-ID
 *   Success: 200 with raw binary audio (audio/mpeg for container=mp3).
 * timbre-v2.5 voices each have one preferred language, so the voice is chosen per language
 * (see APP_LANGUAGES in @mandimitra/shared).
 */

export const MAX_TTS_CHARS = 600;

export interface SynthesisResult {
  audio: Buffer;
  contentType: string;
  voice: string;
  language: string;
}

export async function synthesize(text: string, appLanguage: string): Promise<SynthesisResult> {
  const e = env();
  if (!e.GNANI_API_KEY.trim()) {
    throw new AppError(503, 'GNANI_NOT_CONFIGURED', 'Voice generation is not configured on the server (GNANI_API_KEY is missing).');
  }
  const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) throw new AppError(400, 'TTS_EMPTY_TEXT', 'There is no text to read aloud.');
  if (clean.length > MAX_TTS_CHARS) throw new AppError(400, 'TTS_TEXT_TOO_LONG', `Text is too long to read aloud (max ${MAX_TTS_CHARS} characters).`);

  const lang = getLanguage(appLanguage);
  const payload = {
    text: clean,
    model: e.GNANI_TTS_MODEL,
    voice: lang.ttsVoice,
    language: lang.ttsLanguage,
    speed: 0.95,
    audio_config: { container: 'mp3', sample_rate: 24000, bitrate: '64k' },
  };

  let res: Response;
  try {
    res = await fetch(`${e.GNANI_BASE_URL}/api/v1/tts/inference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key-ID': e.GNANI_API_KEY },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(e.GNANI_TIMEOUT_MS),
    });
  } catch (err) {
    const mapped = timeoutOrNetworkError('tts', err);
    recordFailure('tts', mapped.code);
    throw mapped;
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    const body: unknown = contentType.includes('json') ? await res.json().catch(() => undefined) : undefined;
    const mapped = mapGnaniError('tts', res.status, body);
    recordFailure('tts', mapped.code);
    logger.warn('Timbre TTS request failed', { status: res.status, code: mapped.code });
    throw mapped;
  }
  if (!contentType.startsWith('audio/') && !contentType.startsWith('application/octet-stream')) {
    recordFailure('tts', 'GNANI_INVALID_RESPONSE');
    throw new AppError(502, 'GNANI_INVALID_RESPONSE', 'Voice generation returned an unexpected response.');
  }
  const audio = Buffer.from(await res.arrayBuffer());
  if (audio.length === 0) {
    recordFailure('tts', 'GNANI_EMPTY_AUDIO');
    throw new AppError(502, 'GNANI_EMPTY_AUDIO', 'Voice generation returned no audio.');
  }
  recordSuccess('tts');
  return { audio, contentType: contentType.split(';')[0] || 'audio/mpeg', voice: lang.ttsVoice, language: lang.ttsLanguage };
}

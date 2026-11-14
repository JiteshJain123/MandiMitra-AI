import { z } from 'zod';
import { AUTO_DETECT_LANGUAGE, getLanguage } from '@mandimitra/shared';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { ValidatedAudio } from './audio-validation.service.js';
import { mapGnaniError, timeoutOrNetworkError } from './gnani-errors.js';
import { recordFailure, recordSuccess } from './gnani-status.js';

/**
 * Gnani Prisma speech-to-text (REST).
 * Docs: https://docs.gnani.ai/api/STT/speech-to-text  (verified 2026-11-13)
 *   POST {base}/stt/v3, multipart/form-data, header X-API-Key-ID
 *   fields: audio_file, model, language_code, format, keyterms (v3.0)
 */

const successSchema = z.object({
  success: z.literal(true),
  request_id: z.string(),
  transcript: z.string(),
  model: z.string().optional(),
  detected_language_code: z.string().optional(),
  truncated: z.boolean().optional(),
  processing_time: z.number().optional(),
  end_to_end_latency: z.number().optional(),
});

export interface TranscriptionResult {
  transcript: string;
  requestId: string;
  model?: string;
  detectedLanguageCode?: string;
  truncated: boolean;
  processingTimeSeconds?: number;
  languageCodeSent: string;
  formatSent: string;
}

/** Domain words passed as Prisma v3.0 `keyterms` to improve recognition of mandi vocabulary. */
const MANDI_KEYTERMS = [
  'quintal', 'commission', 'transport', 'hammali', 'tulai', 'aadhat', 'mandi', 'rate', 'bhav',
  'gehu', 'chana', 'sarson', 'soyabean', 'bajra', 'makka', 'dhan', 'kapas',
];

export interface TranscribeOptions {
  /** App language code (e.g. "hi", "hinglish") or "auto" for Prisma automatic language identification. */
  language: string;
}

export function isGnaniConfigured(): boolean {
  return env().GNANI_API_KEY.trim().length > 0;
}

export function resolveSttLanguage(language: string): string {
  const e = env();
  if (language === 'auto') {
    if (e.GNANI_STT_MODEL !== 'prisma-v3.0') {
      throw new AppError(400, 'AUTO_DETECT_UNSUPPORTED', 'Automatic language detection needs the prisma-v3.0 model.');
    }
    return AUTO_DETECT_LANGUAGE;
  }
  const code = getLanguage(language).sttLanguageCode;
  if (code.includes(',') && e.GNANI_STT_MODEL !== 'prisma-v3.0') return code.split(',')[0] as string;
  return code;
}

export async function transcribe(audio: Buffer, meta: ValidatedAudio, opts: TranscribeOptions): Promise<TranscriptionResult> {
  const e = env();
  if (!isGnaniConfigured()) {
    throw new AppError(503, 'GNANI_NOT_CONFIGURED', 'Speech recognition is not configured on the server (GNANI_API_KEY is missing).');
  }
  const languageCode = resolveSttLanguage(opts.language);
  const isV3 = e.GNANI_STT_MODEL === 'prisma-v3.0';
  const format = !isV3 && (e.GNANI_STT_FORMAT === 'codemix' || e.GNANI_STT_FORMAT === 'transliterate') ? 'transcribe' : e.GNANI_STT_FORMAT;

  const form = new FormData();
  form.append('audio_file', new Blob([new Uint8Array(audio)], { type: meta.mimeType }), `recording.${meta.extension}`);
  if (e.GNANI_STT_MODEL !== 'prisma-v2.5') form.append('model', e.GNANI_STT_MODEL);
  form.append('language_code', languageCode);
  form.append('format', format);
  if (isV3) form.append('keyterms', MANDI_KEYTERMS.join(','));

  let res: Response;
  try {
    res = await fetch(`${e.GNANI_BASE_URL}/stt/v3`, {
      method: 'POST',
      headers: { 'X-API-Key-ID': e.GNANI_API_KEY },
      body: form,
      signal: AbortSignal.timeout(e.GNANI_TIMEOUT_MS),
    });
  } catch (err) {
    const mapped = timeoutOrNetworkError('stt', err);
    recordFailure('stt', mapped.code);
    throw mapped;
  }

  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const mapped = mapGnaniError('stt', res.status, body);
    recordFailure('stt', mapped.code);
    logger.warn('Prisma STT request failed', { status: res.status, code: mapped.code });
    throw mapped;
  }
  const parsed = successSchema.safeParse(body);
  if (!parsed.success) {
    recordFailure('stt', 'GNANI_INVALID_RESPONSE');
    throw new AppError(502, 'GNANI_INVALID_RESPONSE', 'Speech recognition returned an unexpected response.');
  }
  recordSuccess('stt');
  const d = parsed.data;
  return {
    transcript: d.transcript.trim(),
    requestId: d.request_id,
    model: d.model,
    detectedLanguageCode: d.detected_language_code,
    truncated: d.truncated === true,
    processingTimeSeconds: d.processing_time,
    languageCodeSent: languageCode,
    formatSent: format,
  };
}

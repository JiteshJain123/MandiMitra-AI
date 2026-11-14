import { AppError } from '../lib/errors.js';

/**
 * Normalises the several documented Gnani error body shapes into one AppError.
 * Shapes: {success:false,error:{type,message}} | {detail:[...]} | {detail:{error_code,message}} |
 *         {error,code,message} | {success:false,message,status_code} (TTS)
 * The upstream message is never forwarded verbatim to clients.
 */
export function extractGnaniErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const b = body as Record<string, unknown>;
  const err = b.error;
  if (err && typeof err === 'object' && typeof (err as Record<string, unknown>).type === 'string') {
    return (err as Record<string, string>).type;
  }
  if (typeof b.code === 'string') return b.code;
  const detail = b.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && typeof (detail as Record<string, unknown>).error_code === 'string') {
    return (detail as Record<string, string>).error_code;
  }
  if (Array.isArray(detail)) return 'VALIDATION_ERROR';
  return undefined;
}

const AUDIO_MESSAGES: Record<string, string> = {
  EMPTY_AUDIO: 'The recording was empty. Please record again.',
  UNSUPPORTED_AUDIO_FORMAT: 'The speech service does not support this audio format.',
  AUDIO_CONVERSION_ERROR: 'The speech service could not read this audio. Please record again.',
  MAX_AUDIO_DURATION_EXCEEDED: 'Recordings can be at most 30 seconds.',
  INVALID_LANGUAGE_CODE: 'The selected language is not supported for speech recognition.',
  MODEL_UNSUPPORTED_LANGUAGE: 'The selected language is not supported by the speech model.',
};

export function mapGnaniError(service: 'stt' | 'tts', httpStatus: number, body: unknown): AppError {
  const upstreamCode = extractGnaniErrorCode(body) ?? `HTTP_${httpStatus}`;
  const label = service === 'stt' ? 'Speech recognition' : 'Voice generation';
  const details = { service, upstreamStatus: httpStatus, upstreamCode };

  if (httpStatus === 401 || httpStatus === 403) {
    return new AppError(502, 'GNANI_AUTH_FAILED', `${label} is not available: the server's Gnani API key was rejected.`, details);
  }
  if (httpStatus === 402) {
    return new AppError(502, 'GNANI_INSUFFICIENT_CREDIT', `${label} is not available: the Gnani account has insufficient credit.`, details);
  }
  if (httpStatus === 429) {
    return new AppError(429, 'GNANI_RATE_LIMITED', `${label} is busy. Please wait a few seconds and try again.`, details);
  }
  if (httpStatus === 504 || upstreamCode === 'UPSTREAM_TIMEOUT') {
    return new AppError(504, 'GNANI_TIMEOUT', `${label} took too long. Please try again.`, details);
  }
  if (httpStatus === 400 || httpStatus === 422) {
    const msg = AUDIO_MESSAGES[upstreamCode] ?? `${label} rejected the request.`;
    return new AppError(400, `GNANI_${upstreamCode}`, msg, details);
  }
  if (httpStatus === 503) {
    return new AppError(503, 'GNANI_UNAVAILABLE', `${label} is temporarily unavailable. Please try again shortly.`, details);
  }
  return new AppError(502, 'GNANI_UPSTREAM_ERROR', `${label} failed. Please try again.`, details);
}

export function timeoutOrNetworkError(service: 'stt' | 'tts', err: unknown): AppError {
  const label = service === 'stt' ? 'Speech recognition' : 'Voice generation';
  const name = err instanceof Error ? err.name : '';
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new AppError(504, 'GNANI_TIMEOUT', `${label} took too long. Please try again.`, { service });
  }
  return new AppError(502, 'GNANI_NETWORK_ERROR', `Could not reach the ${label.toLowerCase()} service.`, { service });
}

import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } from '@mandimitra/shared';
import { AppError } from '../lib/errors.js';

/** Formats accepted by Gnani Prisma REST (docs.gnani.ai, 2026-11-13). */
export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'flac' | 'm4a' | 'aac';

export interface ValidatedAudio {
  format: AudioFormat;
  mimeType: string;
  extension: string;
  /** Only known for WAV (parsed from the header). */
  durationSeconds?: number;
}

const MIME: Record<AudioFormat, string> = {
  wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac',
};

const ascii = (buf: Buffer, start: number, len: number) => buf.subarray(start, start + len).toString('latin1');

/** Detects the container from magic bytes; the client-supplied MIME type is not trusted. */
export function detectAudioFormat(buf: Buffer): AudioFormat | 'webm' | null {
  if (buf.length < 12) return null;
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WAVE') return 'wav';
  if (ascii(buf, 0, 4) === 'OggS') return 'ogg';
  if (ascii(buf, 0, 4) === 'fLaC') return 'flac';
  if (ascii(buf, 4, 4) === 'ftyp') return 'm4a';
  if (ascii(buf, 0, 3) === 'ID3') return 'mp3';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  if (buf[0] === 0xff && ((buf[1] as number) & 0xf6) === 0xf0) return 'aac'; // ADTS
  if (buf[0] === 0xff && ((buf[1] as number) & 0xe0) === 0xe0) return 'mp3'; // MPEG frame sync
  return null;
}

/** Reads the duration of a PCM WAV file from its fmt and data chunks. */
export function wavDurationSeconds(buf: Buffer): number | undefined {
  let offset = 12;
  let byteRate: number | undefined;
  while (offset + 8 <= buf.length) {
    const id = ascii(buf, offset, 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ' && offset + 16 <= buf.length) byteRate = buf.readUInt32LE(offset + 16);
    if (id === 'data') {
      if (!byteRate) return undefined;
      const dataSize = Math.min(size, buf.length - offset - 8);
      return dataSize / byteRate;
    }
    offset += 8 + size + (size % 2);
  }
  return undefined;
}

export function validateAudio(buf: Buffer | undefined): ValidatedAudio {
  if (!buf || buf.length === 0) throw new AppError(400, 'AUDIO_MISSING', 'No audio was received. Please record again.');
  if (buf.length > MAX_AUDIO_BYTES) {
    throw new AppError(413, 'AUDIO_TOO_LARGE', `Audio file is too large (max ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} MB).`);
  }
  const format = detectAudioFormat(buf);
  if (format === 'webm') {
    throw new AppError(415, 'AUDIO_UNSUPPORTED_FORMAT', 'WebM audio is not supported by the speech service. Please use WAV, MP3, OGG, FLAC or M4A.');
  }
  if (!format) {
    throw new AppError(415, 'AUDIO_UNSUPPORTED_FORMAT', 'This does not look like a supported audio file (WAV, MP3, OGG, FLAC, AAC, M4A).');
  }
  let durationSeconds: number | undefined;
  if (format === 'wav') {
    durationSeconds = wavDurationSeconds(buf);
    if (durationSeconds === undefined) throw new AppError(400, 'AUDIO_INVALID', 'The WAV file is damaged or incomplete.');
    if (durationSeconds < 0.3) throw new AppError(400, 'AUDIO_TOO_SHORT', 'The recording is too short. Please speak for at least a second.');
    if (durationSeconds > MAX_AUDIO_SECONDS + 0.5) {
      throw new AppError(400, 'AUDIO_TOO_LONG', `Recordings can be at most ${MAX_AUDIO_SECONDS} seconds.`);
    }
  }
  return { format, mimeType: MIME[format], extension: format, durationSeconds };
}
